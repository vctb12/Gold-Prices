#!/usr/bin/env python3
"""Provider bakeoff — run providers over time and log real behavior.

Reads the provider list from ``--providers`` or ``$GOLD_PROVIDER_ORDER``,
calls each in sequence, normalizes the result, and appends one JSONL row
per provider per round to ``--output`` (default
``data/provider_bakeoff_log.jsonl``).

Modes:
  --once                          one round, exit
  --duration-hours N              loop for N hours, sample every
                                  --interval-seconds (default 360 = 6 min)
                                  Use small N for local tests, e.g. 0.5

Examples:
  # All known providers, one round (CI / local smoke)
  python scripts/python/provider_bakeoff.py --once
  # 30 minutes local @ 60s
  python scripts/python/provider_bakeoff.py --duration-hours 0.5 --interval-seconds 60
  # Subset
  python scripts/python/provider_bakeoff.py --once --providers metal_sentinel,goldpricez

Never logs API keys. Raw response bodies are NOT logged unless
``BAKEOFF_LOG_RAW=true``; otherwise only a sha256 hash of the parsed body
is recorded in ``raw_sample_hash``.

Exit codes:
  0 — at least one provider produced usable data, OR every provider
      cleanly returned a structured error (the bakeoff itself succeeded).
  1 — internal error (argument parsing, file write failure, etc.).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(_REPO_ROOT / "scripts" / "python"))

from gold_providers import fetch_provider, list_known_providers  # noqa: E402
from gold_providers.base import iso_z, utc_now_dt, utc_now_iso  # noqa: E402
from gold_providers.normalize import normalize_quote  # noqa: E402

DEFAULT_OUTPUT = _REPO_ROOT / "data" / "provider_bakeoff_log.jsonl"
DEFAULT_SCORECARD_OUTPUT = _REPO_ROOT / "data" / "provider_scorecard.json"


def _hash_sample(body: Any) -> Optional[str]:
    if body is None:
        return None
    try:
        canon = json.dumps(body, sort_keys=True, default=str).encode("utf-8")
    except (TypeError, ValueError):
        return None
    return hashlib.sha256(canon).hexdigest()


def _resolve_providers(arg_providers: Optional[str]) -> List[str]:
    if arg_providers:
        raw = arg_providers
    else:
        raw = os.environ.get("GOLD_PROVIDER_ORDER", "")
    names = [p.strip() for p in raw.split(",") if p.strip()] if raw else []
    if not names:
        names = list_known_providers()
    known = set(list_known_providers())
    return [n for n in names if n in known]


def _previous_sample_for(provider: str, log_path: Path) -> Optional[Dict[str, Any]]:
    """Read the last JSONL entry for ``provider`` (best-effort)."""
    if not log_path.exists():
        return None
    last: Optional[Dict[str, Any]] = None
    try:
        with log_path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except ValueError:
                    continue
                if obj.get("provider") == provider:
                    last = obj
    except OSError:
        return None
    return last


def _same_price(a: Any, b: Any) -> Optional[bool]:
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        return None
    return round(float(a), 4) == round(float(b), 4)


def _sample_change(price_changed: Optional[bool], ts_changed: Optional[bool]) -> Optional[bool]:
    if price_changed is None and ts_changed is None:
        return None
    return bool(price_changed or ts_changed)


def _usable_for_posting(normalized: Dict[str, Any]) -> bool:
    return bool(
        normalized.get("is_fresh")
        and isinstance(normalized.get("xau_usd_per_oz"), (int, float))
        and normalized.get("timestamp_utc")
        and normalized.get("fetched_at_utc")
    )


def run_round(
    providers: List[str],
    output_path: Path,
    log_raw: bool,
) -> List[Dict[str, Any]]:
    """Execute one bakeoff round; append one JSONL row per provider."""
    run_id = utc_now_iso()
    rows: List[Dict[str, Any]] = []
    output_path.parent.mkdir(parents=True, exist_ok=True)

    for name in providers:
        previous = _previous_sample_for(name, output_path)
        attempted_at = utc_now_dt()
        result = fetch_provider(name)

        row: Dict[str, Any] = {
            "run_id": run_id,
            "provider": name,
            "attempted_at_utc": iso_z(attempted_at),
        }

        if not result.get("success"):
            row.update({
                "success": False,
                "http_status": result.get("http_status"),
                "response_time_ms": result.get("response_time_ms"),
                "latency_ms": result.get("response_time_ms"),
                "raw_symbol": None,
                "source_type": None,
                "price_usd_oz": None,
                "parsed_xau_usd_oz": None,
                "provider_timestamp_utc": None,
                "fetched_at_utc": iso_z(attempted_at),
                "local_fetch_timestamp_utc": iso_z(attempted_at),
                "freshness_seconds": None,
                "freshness_age_seconds": None,
                "is_fresh": False,
                "did_price_change_vs_previous_provider_sample": None,
                "did_timestamp_change_vs_previous_provider_sample": None,
                "did_provider_sample_change_vs_previous_provider_sample": None,
                "usable_for_posting": False,
                "rate_limit_remaining": result.get("rate_limit_remaining"),
                "rate_limit_reset": result.get("rate_limit_reset"),
                "error_category": result.get("error_category"),
                "error_message": result.get("error_message"),
                "raw_sample_hash": None,
            })
        else:
            normalized = normalize_quote(result)
            prev_price = previous.get("price_usd_oz") if previous else None
            prev_ts = previous.get("provider_timestamp_utc") if previous else None
            cur_price = normalized.get("xau_usd_per_oz")
            cur_ts = normalized.get("timestamp_utc")
            price_changed = (
                None if prev_price is None or cur_price is None else not _same_price(prev_price, cur_price)
            )
            ts_changed = (
                None if prev_ts is None or cur_ts is None
                else prev_ts != cur_ts
            )
            sample_changed = _sample_change(price_changed, ts_changed)
            usable_for_posting = _usable_for_posting(normalized)
            row.update({
                "success": True,
                "http_status": result.get("http_status"),
                "response_time_ms": result.get("response_time_ms"),
                "latency_ms": result.get("response_time_ms"),
                "raw_symbol": normalized.get("raw_symbol"),
                "source_type": normalized.get("source_type"),
                "price_usd_oz": cur_price,
                "parsed_xau_usd_oz": cur_price,
                "provider_timestamp_utc": cur_ts,
                "fetched_at_utc": normalized.get("fetched_at_utc"),
                "local_fetch_timestamp_utc": normalized.get("fetched_at_utc"),
                "freshness_seconds": normalized.get("freshness_seconds"),
                "freshness_age_seconds": normalized.get("freshness_seconds"),
                "is_fresh": normalized.get("is_fresh"),
                "did_price_change_vs_previous_provider_sample": price_changed,
                "did_timestamp_change_vs_previous_provider_sample": ts_changed,
                "did_provider_sample_change_vs_previous_provider_sample": sample_changed,
                "usable_for_posting": usable_for_posting,
                "rate_limit_remaining": result.get("rate_limit_remaining"),
                "rate_limit_reset": result.get("rate_limit_reset"),
                "error_category": None,
                "error_message": None,
                "raw_sample_hash": _hash_sample(result.get("raw_sample") or {
                    "price_usd_oz": cur_price,
                    "timestamp_utc": cur_ts,
                }),
            })
            if log_raw and result.get("raw_sample") is not None:
                row["raw_sample"] = result.get("raw_sample")

        rows.append(row)

    # Append all rows atomically (best-effort: single open).
    with output_path.open("a", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, separators=(",", ":")) + "\n")

    return rows


def _print_summary(rows: List[Dict[str, Any]]) -> None:
    print(f"\n=== Bakeoff round @ {rows[0]['run_id'] if rows else '?'} ===", flush=True)
    for r in rows:
        if r["success"]:
            ts = r.get("provider_timestamp_utc") or "no-ts"
            fresh = "fresh" if r["is_fresh"] else "stale"
            price = r.get("price_usd_oz")
            usable = "usable" if r.get("usable_for_posting") else "hold"
            print(
                f"  ✓ {r['provider']:<22} ${price:>10.2f}  {ts}  "
                f"({fresh}, {usable}, {r.get('response_time_ms')}ms)",
                flush=True,
            )
        else:
            print(
                f"  ✗ {r['provider']:<22} {r.get('error_category'):<22} "
                f"http={r.get('http_status')} ({r.get('response_time_ms') or 0}ms)",
                flush=True,
            )


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Gold-price provider bakeoff")
    p.add_argument("--once", action="store_true", help="Run a single round and exit")
    p.add_argument("--duration-hours", type=float, default=0.0,
                   help="Total runtime in hours (e.g. 24, 48, or 0.5 for tests)")
    p.add_argument("--interval-seconds", type=int, default=360,
                   help="Seconds between rounds (default 360 = 6 minutes)")
    p.add_argument("--providers", type=str, default="",
                   help="Comma-separated provider names (else $GOLD_PROVIDER_ORDER else all known)")
    p.add_argument("--output", type=str, default=str(DEFAULT_OUTPUT),
                   help="Path to JSONL log (appended)")
    p.add_argument("--scorecard-output", type=str, default=str(DEFAULT_SCORECARD_OUTPUT),
                   help="Path the scorecard generator should write to")
    p.add_argument("--log-raw", action="store_true",
                   help="Log raw response bodies (also via BAKEOFF_LOG_RAW=true)")
    p.add_argument("--write-scorecard", action="store_true",
                   help="Generate scorecard JSON after the last round")
    args = p.parse_args(argv)

    providers = _resolve_providers(args.providers)
    if not providers:
        print("ERROR: no providers configured (check --providers / GOLD_PROVIDER_ORDER)",
              file=sys.stderr)
        return 1

    log_raw = args.log_raw or str(os.environ.get("BAKEOFF_LOG_RAW", "")).lower() in ("1", "true", "yes")
    output_path = Path(args.output)

    print(f"providers: {providers}")
    print(f"output:    {output_path}")
    print(f"log_raw:   {log_raw}")

    if args.once or args.duration_hours <= 0:
        rows = run_round(providers, output_path, log_raw)
        _print_summary(rows)
        if args.write_scorecard:
            _maybe_write_scorecard(output_path, Path(args.scorecard_output))
        return 0

    deadline = time.time() + (args.duration_hours * 3600.0)
    interval = max(15, args.interval_seconds)
    round_no = 0
    while time.time() < deadline:
        round_no += 1
        rows = run_round(providers, output_path, log_raw)
        _print_summary(rows)
        if args.write_scorecard:
            _maybe_write_scorecard(output_path, Path(args.scorecard_output))
        # Sleep up to next round, but break early if deadline hits.
        next_at = time.time() + interval
        if next_at >= deadline:
            break
        time.sleep(max(1.0, next_at - time.time()))

    print(f"\nBakeoff complete: {round_no} round(s).", flush=True)
    return 0


def _maybe_write_scorecard(log_path: Path, scorecard_path: Path) -> None:
    try:
        from provider_scorecard import generate_scorecard, write_scorecard  # noqa: WPS433
    except ImportError:
        return
    try:
        sc = generate_scorecard(log_path)
        write_scorecard(sc, scorecard_path)
        print(f"  scorecard updated: {scorecard_path}", flush=True)
    except Exception as exc:  # never fail the bakeoff over scorecard issues
        print(f"  WARN: scorecard generation failed: {exc}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
