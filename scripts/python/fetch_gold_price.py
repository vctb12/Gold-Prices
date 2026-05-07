#!/usr/bin/env python3
"""Production gold-price fetch orchestrator (provider-adapter version).

Tries providers from ``$GOLD_PROVIDER_ORDER`` (or ``--providers``) in order,
respecting per-provider circuit-breaker state. Writes:

  * ``data/gold_price.json``         — normalized canonical schema (always
                                        rewritten so downstream code can
                                        observe ``is_fresh: false``)
  * ``data/last_gold_price.json``    — only when a fresh quote is found
  * ``data/provider_state.json``     — circuit-breaker bookkeeping
  * GitHub Actions outputs (``$GITHUB_OUTPUT``):
      fresh, provider, price, timestamp_utc, should_post, reason

This is intentionally separate from the legacy ``scripts/fetch_gold_price.py``
to keep the existing GoldPriceZ-only pipeline untouched while teams test
the new adapter chain. Once the bakeoff selects a winner, ``post_gold.yml``
can be flipped to call this script instead.

Soft-fail: if no provider is fresh, exit 0 unless
``SOFT_FAIL_ON_NO_FRESH_PRICE=false``. The output ``fresh=false`` lets the
workflow decide what to do.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_REPO_ROOT / "scripts" / "python"))

from gold_providers import fetch_provider, list_known_providers  # noqa: E402
from gold_providers.base import (  # noqa: E402
    env_bool,
    env_int,
    env_str,
    iso_z,
    parse_timestamp,
    utc_now_dt,
)
from gold_providers.normalize import normalize_quote  # noqa: E402

DATA_DIR = _REPO_ROOT / "data"
GOLD_PRICE_FILE = DATA_DIR / "gold_price.json"
LAST_GOLD_PRICE_FILE = DATA_DIR / "last_gold_price.json"
PROVIDER_STATE_FILE = DATA_DIR / "provider_state.json"

DEFAULT_PROVIDER_ORDER = (
    "gold_api_com,twelvedata_xauusd,fmp_gcusd"
)

# Circuit-breaker tuning
CB_FAILURE_THRESHOLD = 3
CB_FAILURE_OPEN_MINUTES = 30
CB_RATE_LIMIT_OPEN_MINUTES = 60
KARAT_PURITY = {
    "24k": 1.0,
    "22k": 22 / 24,
    "21k": 21 / 24,
    "18k": 18 / 24,
}


# ── Provider state I/O ───────────────────────────────────────────────────────

def _load_state() -> Dict[str, Any]:
    if not PROVIDER_STATE_FILE.exists():
        return {}
    try:
        raw = json.loads(PROVIDER_STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return raw if isinstance(raw, dict) else {}


def _save_state(state: Dict[str, Any]) -> None:
    PROVIDER_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = PROVIDER_STATE_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    tmp.replace(PROVIDER_STATE_FILE)


def _circuit_open(entry: Dict[str, Any], now: datetime) -> bool:
    open_until = entry.get("circuit_open_until_utc")
    if not open_until:
        return False
    dt = parse_timestamp(open_until)
    if dt is None:
        return False
    return now < dt


def _record_success(state: Dict[str, Any], provider: str, now: datetime) -> None:
    entry = state.setdefault(provider, {})
    entry["consecutive_failures"] = 0
    entry["last_success_utc"] = iso_z(now)
    entry["circuit_open_until_utc"] = None
    entry["last_error_category"] = None


def _record_failure(state: Dict[str, Any], provider: str, category: str, now: datetime) -> None:
    entry = state.setdefault(provider, {})
    entry["consecutive_failures"] = int(entry.get("consecutive_failures", 0)) + 1
    entry["last_failure_utc"] = iso_z(now)
    entry["last_error_category"] = category
    if category in ("rate_limited", "quota_exhausted"):
        open_until = now + timedelta(minutes=CB_RATE_LIMIT_OPEN_MINUTES)
        entry["circuit_open_until_utc"] = iso_z(open_until)
    elif entry["consecutive_failures"] >= CB_FAILURE_THRESHOLD:
        open_until = now + timedelta(minutes=CB_FAILURE_OPEN_MINUTES)
        entry["circuit_open_until_utc"] = iso_z(open_until)


# ── Provider iteration ───────────────────────────────────────────────────────

def _resolve_order(arg_providers: Optional[str]) -> List[str]:
    raw = arg_providers or env_str("GOLD_PROVIDER_ORDER", DEFAULT_PROVIDER_ORDER)
    names = [p.strip() for p in raw.split(",") if p.strip()]
    known = set(list_known_providers())
    return [n for n in names if n in known]


def _try_provider(name: str, state: Dict[str, Any], now: datetime) -> Tuple[Optional[Dict[str, Any]], str]:
    """Return (normalized_quote_or_None, decision_note)."""
    entry = state.get(name, {})
    if _circuit_open(entry, now):
        return None, f"circuit_open_until={entry.get('circuit_open_until_utc')}"
    raw = fetch_provider(name)
    if not raw.get("success"):
        cat = raw.get("error_category") or "unknown_error"
        _record_failure(state, name, cat, now)
        return None, f"error={cat}"
    normalized = normalize_quote(raw)
    _record_success(state, name, now)
    if not normalized.get("is_fresh"):
        return normalized, "stale"
    return normalized, "fresh"


# ── Output helpers ────────────────────────────────────────────────────────────

def _atomic_write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def _emit_actions_outputs(outputs: Dict[str, Any]) -> None:
    target = os.environ.get("GITHUB_OUTPUT")
    if not target:
        return
    try:
        with open(target, "a", encoding="utf-8") as fh:
            for k, v in outputs.items():
                if v is None:
                    v_str = ""
                elif isinstance(v, bool):
                    v_str = "true" if v else "false"
                else:
                    v_str = str(v)
                fh.write(f"{k}={v_str}\n")
    except OSError:
        pass


def _with_legacy_wrapper(normalized: Dict[str, Any]) -> Dict[str, Any]:
    """Return normalized payload plus legacy compatibility fields."""
    payload = dict(normalized)
    xau = payload.get("xau_usd_per_oz")
    aed_peg = payload.get("aed_peg", 3.6725)
    if not isinstance(xau, (int, float)) or xau <= 0:
        return payload

    xau = float(xau)
    usd_per_gram_24k = xau / 31.1034768
    aed_per_gram_24k = payload.get("aed_per_gram_24k")
    if not isinstance(aed_per_gram_24k, (int, float)) or aed_per_gram_24k <= 0:
        aed_per_gram_24k = usd_per_gram_24k * float(aed_peg)

    karats_aed_per_gram = {
        code: round(float(aed_per_gram_24k) * purity, 2)
        for code, purity in KARAT_PURITY.items()
    }
    provider_ts = payload.get("timestamp_utc")
    source_updated_at_gmt = None
    if isinstance(provider_ts, str) and provider_ts:
        try:
            dt = parse_timestamp(provider_ts)
            if dt is not None:
                source_updated_at_gmt = dt.strftime("%d-%m-%Y %I:%M:%S %p").lower()
        except Exception:
            source_updated_at_gmt = None

    payload.update({
        "source": payload.get("provider"),
        "source_updated_at_gmt": source_updated_at_gmt,
        "gold": {
            "ounce_usd": round(xau, 2),
            "ounce_aed": round(xau * float(aed_peg), 2),
            "gram_aed": round(float(aed_per_gram_24k), 2),
            "day_low_usd": None,
            "day_high_usd": None,
            "ask_usd": payload.get("ask") if isinstance(payload.get("ask"), (int, float)) else round(xau, 2),
            "bid_usd": payload.get("bid") if isinstance(payload.get("bid"), (int, float)) else round(xau, 2),
        },
        "karats_aed_per_gram": karats_aed_per_gram,
        "status": "ok" if payload.get("is_fresh") else "stale",
    })
    return payload


def _decide_should_post(
    normalized: Optional[Dict[str, Any]],
    note: str,
) -> Tuple[bool, str]:
    if normalized is None:
        return False, f"no_provider_succeeded ({note})"
    if not normalized.get("is_fresh"):
        if env_bool("ALLOW_STALE_PRICE", default=False):
            return True, "stale_allowed_by_env"
        return False, "stale_price"
    return True, "fresh"


# ── Main ─────────────────────────────────────────────────────────────────────

def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Fetch normalized gold price via provider adapters")
    p.add_argument("--providers", type=str, default="",
                   help="Override GOLD_PROVIDER_ORDER (comma-separated names)")
    p.add_argument("--dry-run", action="store_true",
                   help="Don't write any data files")
    args = p.parse_args(argv)

    providers = _resolve_order(args.providers or None)
    if not providers:
        print("ERROR: no providers configured (GOLD_PROVIDER_ORDER empty)", file=sys.stderr)
        return 1 if not env_bool("SOFT_FAIL_ON_NO_FRESH_PRICE", default=True) else 0

    state = _load_state()
    now = utc_now_dt()

    chosen: Optional[Dict[str, Any]] = None
    chosen_provider: Optional[str] = None
    notes: List[str] = []
    is_fallback = False
    # Retain the first stale-but-valid quote we see in priority order so a
    # second HTTP pass isn't necessary if no provider returns fresh.
    first_stale: Optional[Dict[str, Any]] = None
    first_stale_provider: Optional[str] = None

    # Single pass: any fresh provider wins. Stale quotes are remembered.
    for name in providers:
        normalized, note = _try_provider(name, state, now)
        notes.append(f"{name}={note}")
        if normalized is None:
            continue
        if normalized.get("is_fresh"):
            chosen = normalized
            chosen_provider = name
            break
        if first_stale is None:
            first_stale = normalized
            first_stale_provider = name

    # Accept stale only if explicitly allowed.
    if chosen is None and first_stale is not None and env_bool("ALLOW_STALE_PRICE", default=False):
        chosen = first_stale
        chosen_provider = first_stale_provider
        is_fallback = True
        notes.append(f"accepted_stale_from={first_stale_provider}")

    if not args.dry_run:
        _save_state(state)

    if not args.dry_run:
        if chosen is not None:
            payload = _with_legacy_wrapper(chosen)
            payload["is_fallback"] = bool(is_fallback)
            _atomic_write_json(GOLD_PRICE_FILE, payload)
            if chosen.get("is_fresh"):
                _atomic_write_json(LAST_GOLD_PRICE_FILE, payload)
        else:
            # Write a structured "no fresh provider" payload but only if no
            # existing file is present, to avoid clobbering legacy data.
            if not GOLD_PRICE_FILE.exists():
                _atomic_write_json(GOLD_PRICE_FILE, {
                    "schema_version": 1,
                    "provider": None,
                    "is_fresh": False,
                    "is_fallback": True,
                    "fetched_at_utc": iso_z(now),
                    "notes": "no provider produced a fresh quote",
                })

    should_post, reason = _decide_should_post(chosen, "; ".join(notes))

    outputs = {
        "fresh": bool(chosen and chosen.get("is_fresh")),
        "provider": chosen_provider or "",
        "price": (chosen.get("xau_usd_per_oz") if chosen else ""),
        "timestamp_utc": (chosen.get("timestamp_utc") if chosen else ""),
        "should_post": should_post,
        "reason": reason,
    }
    _emit_actions_outputs(outputs)

    print(json.dumps({"summary": outputs, "trace": notes}, indent=2))

    if chosen is None and not env_bool("SOFT_FAIL_ON_NO_FRESH_PRICE", default=True):
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
