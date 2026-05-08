"""X / Twitter duplicate-post guard.

Reads/writes ``data/last_tweet_state.json`` and decides whether the
posting script should attempt a tweet given the current normalized
quote and a candidate tweet text.

This module is purely advisory: it never makes an HTTP call. The caller
(``scripts/python/post_gold_price.py``) is responsible for invoking
the X API. We only:

  1. Compute a SHA-256 hash of the candidate tweet text.
  2. Compare against ``last_tweet_state.json`` to decide if posting
     would create a duplicate (X rejects update text equal to a recent
     post with HTTP 403 / error code 187).
  3. Apply price-movement and forced-summary thresholds.

Skip rules (see ``decide(...)``):
  * gold price not fresh → skip unless ALLOW_STALE_TWEET=true
  * provider timestamp unchanged → skip unless force-summary window due
  * tweet text hash equal to last hash → skip
  * price movement below threshold → skip unless force-summary due
  * fallback/cached source with same price+timestamp → skip
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

SCHEMA_VERSION = 1


@dataclass
class TweetState:
    schema_version: int = SCHEMA_VERSION
    last_tweet_id: Optional[str] = None
    last_tweet_time_utc: Optional[str] = None
    last_tweet_text_hash: Optional[str] = None
    last_price_usd_oz: Optional[float] = None
    last_provider: Optional[str] = None
    last_provider_timestamp_utc: Optional[str] = None
    last_source_type: Optional[str] = None
    last_post_reason: Optional[str] = None


def _truthy(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name, "")
    if raw == "":
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "on")


def _envf(name: str, default: float) -> float:
    raw = os.environ.get(name, "")
    if raw == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _envi(name: str, default: int) -> int:
    raw = os.environ.get(name, "")
    if raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def hash_tweet(text: str) -> str:
    """SHA-256 hex digest of the tweet text (whitespace-normalized)."""
    canon = " ".join((text or "").split())
    return hashlib.sha256(canon.encode("utf-8")).hexdigest()


def _same_price(a: Any, b: Any) -> Optional[bool]:
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        return None
    return round(float(a), 2) == round(float(b), 2)


def load_state(path: Path) -> TweetState:
    if not path.exists():
        return TweetState()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return TweetState()
    if not isinstance(raw, dict):
        return TweetState()
    return TweetState(
        schema_version=int(raw.get("schema_version") or SCHEMA_VERSION),
        last_tweet_id=raw.get("last_tweet_id"),
        last_tweet_time_utc=raw.get("last_tweet_time_utc"),
        last_tweet_text_hash=raw.get("last_tweet_text_hash"),
        last_price_usd_oz=(float(raw["last_price_usd_oz"])
                           if isinstance(raw.get("last_price_usd_oz"), (int, float))
                           else None),
        last_provider=raw.get("last_provider"),
        last_provider_timestamp_utc=raw.get("last_provider_timestamp_utc"),
        last_source_type=raw.get("last_source_type"),
        last_post_reason=raw.get("last_post_reason"),
    )


def save_state(path: Path, state: TweetState) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    payload = asdict(state)
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def _minutes_since(iso: Optional[str], now: Optional[datetime] = None) -> Optional[float]:
    if not iso or not isinstance(iso, str):
        return None
    raw = iso[:-1] + "+00:00" if iso.endswith("Z") else iso
    try:
        last = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    now = now or datetime.now(timezone.utc)
    return (now - last).total_seconds() / 60.0


@dataclass
class Decision:
    should_post: bool
    skip_reason: Optional[str]
    tweet_hash: str
    price_move_usd: Optional[float]
    price_move_pct: Optional[float]
    provider_timestamp_changed: Optional[bool]


def decide(
    state: TweetState,
    *,
    quote: Dict[str, Any],
    tweet_text: str,
    now: Optional[datetime] = None,
) -> Decision:
    """Decide whether to post.

    ``quote`` is the normalized gold-price payload from ``fetch_gold_price.py``.
    """
    h = hash_tweet(tweet_text)
    cur_price = quote.get("xau_usd_per_oz")
    cur_ts = quote.get("timestamp_utc")
    is_fresh = bool(quote.get("is_fresh"))
    is_fallback = bool(quote.get("is_fallback"))
    source_type = quote.get("source_type")

    move_usd: Optional[float] = None
    move_pct: Optional[float] = None
    if isinstance(cur_price, (int, float)) and isinstance(state.last_price_usd_oz, (int, float)) and state.last_price_usd_oz:
        move_usd = float(cur_price) - float(state.last_price_usd_oz)
        move_pct = (move_usd / float(state.last_price_usd_oz)) * 100.0
    same_price = _same_price(cur_price, state.last_price_usd_oz)

    ts_changed: Optional[bool] = None
    if cur_ts and state.last_provider_timestamp_utc:
        ts_changed = cur_ts != state.last_provider_timestamp_utc
    elif cur_ts and not state.last_provider_timestamp_utc:
        ts_changed = True

    if not _truthy("SKIP_DUPLICATE_TWEETS", default=True):
        # Duplicate guard explicitly disabled — still return decision data.
        return Decision(True, None, h, move_usd, move_pct, ts_changed)

    allow_stale = _truthy("ALLOW_STALE_TWEET", default=False)
    force_post = _truthy("FORCE_POST", default=False)
    min_move_usd = _envf("MIN_TWEET_MOVE_USD", 1.00)
    min_move_pct = _envf("MIN_TWEET_MOVE_PCT", 0.03)
    min_interval_minutes = _envi("MIN_TWEET_INTERVAL_MINUTES", 55)
    force_summary_min = _envi("FORCE_SUMMARY_AFTER_MINUTES", 60)

    minutes_since_last = _minutes_since(state.last_tweet_time_utc, now)
    force_summary_due = (
        minutes_since_last is None or minutes_since_last >= force_summary_min
    )

    # Rule 1: not fresh → skip unless explicit override.
    if not is_fresh and not allow_stale:
        return Decision(False, "stale_quote", h, move_usd, move_pct, ts_changed)

    # First-ever post: nothing to compare against, just allow.
    if state.last_tweet_text_hash is None:
        return Decision(True, None, h, move_usd, move_pct, ts_changed)

    # Rule 2: cooldown — keep scheduled + manual GitHub runs from double-posting.
    if (
        not force_post
        and minutes_since_last is not None
        and minutes_since_last < min_interval_minutes
    ):
        return Decision(False, "cooldown_active", h, move_usd, move_pct, ts_changed)

    # Rule 3: same provider sample (price + timestamp) → always skip.
    if same_price is True and ts_changed is False:
        return Decision(False, "provider_sample_unchanged", h, move_usd, move_pct, ts_changed)

    # Rule 4: provider timestamp unchanged → skip unless forced summary due.
    if ts_changed is False and not force_summary_due:
        return Decision(False, "provider_timestamp_unchanged", h, move_usd, move_pct, ts_changed)

    # Rule 5: identical text hash → ALWAYS skip (X rejects this anyway).
    if h == state.last_tweet_text_hash:
        return Decision(False, "duplicate_text_hash", h, move_usd, move_pct, ts_changed)

    # Rule 6: fallback/cache with same price → skip. Evaluated before the
    # price-move threshold so a fallback replaying yesterday's price doesn't
    # masquerade as "below threshold" (it isn't a real micro-move; it's the
    # provider serving cached data).
    if is_fallback or source_type in ("cache_last_known", "spot_delayed"):
        if same_price:
            return Decision(False, "fallback_no_change", h, move_usd, move_pct, ts_changed)

    # Rule 7: small price movement → skip unless forced summary due.
    if move_usd is not None and move_pct is not None:
        if abs(move_usd) < min_move_usd and abs(move_pct) < min_move_pct and not force_summary_due:
            return Decision(False, "price_move_below_threshold", h, move_usd, move_pct, ts_changed)

    return Decision(True, None, h, move_usd, move_pct, ts_changed)


def update_state_after_post(
    state: TweetState,
    *,
    quote: Dict[str, Any],
    tweet_text: str,
    tweet_id: Optional[str],
    reason: str,
    now: Optional[datetime] = None,
) -> TweetState:
    now_dt = now or datetime.now(timezone.utc)
    state.last_tweet_id = tweet_id
    state.last_tweet_time_utc = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    state.last_tweet_text_hash = hash_tweet(tweet_text)
    cur_price = quote.get("xau_usd_per_oz")
    if isinstance(cur_price, (int, float)):
        state.last_price_usd_oz = float(cur_price)
    state.last_provider = quote.get("provider")
    state.last_provider_timestamp_utc = quote.get("timestamp_utc")
    state.last_source_type = quote.get("source_type")
    state.last_post_reason = reason
    return state
