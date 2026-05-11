#!/usr/bin/env python3
"""
scripts/post_gold_price.py

Reads the canonical gold-price data file written by
`scripts/fetch_gold_price.py` and posts a
formatted update to X / Twitter using tweepy.

This script does NOT call any gold-price API directly. It reads
`data/gold_price.json`, which is committed by the
`.github/workflows/gold-price-fetch.yml` workflow on its normal schedule.

Required environment variables (set as GitHub Secrets):
  TWITTER_API_KEY           – X Developer Portal: API Key (Consumer Key)
  TWITTER_API_SECRET        – X Developer Portal: API Key Secret
  TWITTER_ACCESS_TOKEN      – X Developer Portal: Access Token (read-write)
  TWITTER_ACCESS_TOKEN_SECRET – X Developer Portal: Access Token Secret

Workflow cron schedule (.github/workflows/post_gold.yml):
  - hourly while the global gold market is open
  - posts only when the committed spot price changes
  - keeps explicit market open/close schedule entries for event tweets"""

import hashlib
import os
import sys
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

# ── Config ────────────────────────────────────────────────────────────────────
AED_RATE = 3.6725  # UAE Dirham is pegged to USD
SITE_URL  = "https://goldtickerlive.com/"
UAE_TZ    = timezone(timedelta(hours=4))
TROY_OZ_GRAMS = 31.1034768
MARKET_OPEN_EVENT_CRON = '3 21 * * 0'
MARKET_CLOSE_EVENT_CRON = '3 21 * * 5'
DEFAULT_CLOSED_MARKET_MAX_STALE_HOURS = 48
SHORTCUT_TRIGGER_SPAM_WINDOW_MINUTES = 2
MARKET_REOPENS_UAE_LABEL = "Mon 1:00 AM UAE"
SPIKE_THRESHOLD_PCT = 1.5  # abs % change that triggers an alert headline

# Canonical data file written by scripts/fetch_gold_price.py
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
GOLD_PRICE_FILE = _REPO_ROOT / "data" / "gold_price.json"
STATE_FILE = _REPO_ROOT / "data" / "last_gold_price.json"
LAST_TWEET_STATE_FILE = _REPO_ROOT / "data" / "last_tweet_state.json"

# Optional new tweet-guard module (additive to the existing price-change /
# content-hash guards). Imported lazily so unit tests that don't need it
# still work if the module is missing.
try:
    sys.path.insert(0, str(_REPO_ROOT / "scripts" / "python"))
    import tweet_guard  # type: ignore  # noqa: E402
except Exception:  # pragma: no cover — guard is optional
    tweet_guard = None  # type: ignore

TWITTER_API_KEY = os.environ.get('TWITTER_API_KEY', '')
TWITTER_API_SECRET = os.environ.get('TWITTER_API_SECRET', '')
TWITTER_ACCESS_TOKEN = os.environ.get('TWITTER_ACCESS_TOKEN', '')
TWITTER_ACCESS_TOKEN_SECRET = os.environ.get('TWITTER_ACCESS_TOKEN_SECRET', '')


@dataclass
class RunResult:
    outcome: str
    status: str
    post_type: Optional[str] = None
    template_used: Optional[str] = None
    price_usd_oz: Optional[float] = None
    tweet_length: Optional[int] = None
    content_hash: Optional[str] = None
    skip_reason: Optional[str] = None
    operator_action: Optional[str] = None
    reset_date: Optional[str] = None
    retry_after_seconds: Optional[str] = None
    trigger_source: Optional[str] = None
    trigger_nonce: Optional[str] = None
    detail: Optional[str] = None


def _run_result_path():
    raw = os.environ.get("POST_GOLD_RESULT_PATH", "").strip()
    return Path(raw) if raw else None


def _atomic_write_text(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    try:
        tmp.write_text(text, encoding="utf-8")
        tmp.replace(path)
    except Exception as exc:
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass
        print(f"⚠️  Failed to atomically write {path} ({type(exc).__name__}): {exc}")
        raise


def _persist_run_result(result):
    path = _run_result_path()
    if path is None:
        return
    try:
        _atomic_write_text(path, json.dumps(asdict(result), indent=2) + "\n")
    except Exception as exc:  # pragma: no cover — best-effort
        print(f"⚠️  Failed to persist run result to {path} ({type(exc).__name__}): {exc}")


def emit_run_result(result):
    _persist_run_result(result)
    print("=== RUN RESULT ===")
    ordered_fields = [
        ("outcome", result.outcome),
        ("status", result.status),
        ("post_type", result.post_type),
        ("template_used", result.template_used),
        ("price", f"${result.price_usd_oz:,.2f}/oz" if isinstance(result.price_usd_oz, (int, float)) else None),
        ("tweet_length", result.tweet_length),
        ("content_hash", result.content_hash),
        ("skip_reason", result.skip_reason),
        ("operator_action", result.operator_action),
        ("reset_date", result.reset_date),
        ("retry_after_seconds", result.retry_after_seconds),
        ("trigger_source", result.trigger_source),
        ("trigger_nonce", result.trigger_nonce),
        ("detail", result.detail),
    ]
    for label, value in ordered_fields:
        if value is None:
            continue
        print(f"{label + ':':<20} {value}")
    print("===================")


def finish_run(result, exit_code=0):
    emit_run_result(result)
    sys.exit(exit_code)


def _snapshot_text_file(path):
    try:
        return {
            "exists": path.exists(),
            "text": path.read_text(encoding="utf-8") if path.exists() else None,
        }
    except Exception as exc:  # pragma: no cover — best-effort
        print(f"⚠️  Failed to snapshot {path} ({type(exc).__name__}): {exc}")
        return {
            "exists": path.exists(),
            "text": None,
        }


def _restore_text_file(path, snapshot):
    if snapshot is None:
        return
    try:
        if snapshot.get("exists"):
            text = snapshot.get("text")
            if text is not None:
                _atomic_write_text(path, text)
            else:
                print(f"⚠️  Skipping restore for {path}: snapshot text was unavailable.")
        elif path.exists():
            path.unlink()
    except Exception as exc:  # pragma: no cover — best-effort
        print(f"⚠️  Failed to restore {path} ({type(exc).__name__}): {exc}")



# ── Content hash ──────────────────────────────────────────────────────────────
def compute_content_hash(text):
    """Return first 12 chars of SHA256 hex digest of text."""
    return hashlib.sha256(text.encode()).hexdigest()[:12]


# ── State file I/O ─────────────────────────────────────────────────────────────
def _load_last_price():
    """Return (price, posted_at_utc, content_hash) from STATE_FILE.

    Missing file, corrupt JSON, non-dict, or missing/invalid price → (None, None, None).
    Old schema with only `price` → (price, None, None).
    New schema → (price, posted_at_utc_iso_string, content_hash_or_None).
    """
    if not STATE_FILE.exists():
        return (None, None, None)
    try:
        raw = json.loads(STATE_FILE.read_text())
    except Exception:
        print("⚠️  last_gold_price.json is corrupt; ignoring previous-price state.")
        return (None, None, None)
    if not isinstance(raw, dict):
        return (None, None, None)
    price = raw.get("price")
    if not isinstance(price, (int, float)) or price <= 0:
        return (None, None, None)
    posted_at_utc = raw.get("posted_at_utc")
    if not isinstance(posted_at_utc, str) or not posted_at_utc:
        posted_at_utc = None
    content_hash = raw.get("content_hash")
    if not isinstance(content_hash, str) or not content_hash:
        content_hash = None
    return (float(price), posted_at_utc, content_hash)


def _save_last_price(price, posted_at_utc=None, content_hash=None):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    if posted_at_utc is None:
        posted_at_utc = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    payload = {"price": price, "posted_at_utc": posted_at_utc}
    if content_hash is not None:
        payload["content_hash"] = content_hash
    try:
        STATE_FILE.write_text(json.dumps(payload))
    except Exception as err:
        print(f"⚠️  Failed to save state to {STATE_FILE}: {err}")
        print("   The tweet was posted successfully but duplicate-guard state was not saved.")


def _previous_post_from_guard_state(guard_state):
    if guard_state is None:
        return None
    if not isinstance(getattr(guard_state, "last_price_usd_oz", None), (int, float)):
        return None
    return (
        float(guard_state.last_price_usd_oz),
        guard_state.last_tweet_time_utc,
        guard_state.last_tweet_text_hash,
    )


def get_gold_price(previous_post=None):
    """Read gold price from data/gold_price.json (written by
    scripts/fetch_gold_price.py from goldpricez.com) and shape it
    the way the rest of this file expects."""
    if not GOLD_PRICE_FILE.exists():
        raise FileNotFoundError(
            f"{GOLD_PRICE_FILE} not found. "
            "The gold-price-fetch.yml workflow must run first to populate it."
        )

    raw = json.loads(GOLD_PRICE_FILE.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("gold_price.json is not a JSON object")

    gold = raw.get("gold") or {}
    price = raw.get("xau_usd_per_oz")
    if not isinstance(price, (int, float)) or price <= 0:
        price = gold.get("ounce_usd")
    if not isinstance(price, (int, float)) or price <= 0:
        raise ValueError("gold_price.json missing or invalid spot price (xau_usd_per_oz / gold.ounce_usd)")
    price = float(price)

    previous_price, previous_posted_at_utc, previous_content_hash = previous_post or _load_last_price()
    chp = None
    if previous_price and previous_price > 0:
        chp = ((price - previous_price) / previous_price) * 100

    # Prefer the per-gram AED value already computed by the fetcher; fall
    # back to local math if absent.
    karats_aed = raw.get("karats_aed_per_gram") if isinstance(raw.get("karats_aed_per_gram"), dict) else {}
    g24_aed = karats_aed.get("24k")
    if not isinstance(g24_aed, (int, float)) or g24_aed <= 0:
        g24_aed = raw.get("aed_per_gram_24k")
    if not isinstance(g24_aed, (int, float)) or g24_aed <= 0:
        g24_aed = gold.get("gram_aed")
    if isinstance(g24_aed, (int, float)) and g24_aed > 0:
        g24 = float(g24_aed) / AED_RATE  # USD/g to keep downstream _aed() happy
    else:
        g24 = price / TROY_OZ_GRAMS
    g22 = g24 * (22 / 24)
    g21 = g24 * (21 / 24)
    g18 = g24 * (18 / 24)

    return {
        "price": price,
        "price_gram_24k": g24,
        "price_gram_22k": g22,
        "price_gram_21k": g21,
        "price_gram_20k": g24 * (20 / 24),
        "price_gram_18k": g18,
        "price_gram_16k": g24 * (16 / 24),
        "price_gram_14k": g24 * (14 / 24),
        "chp": chp,
        "prev_price": previous_price,
        "prev_posted_at_utc": previous_posted_at_utc,
        "prev_content_hash": previous_content_hash,
    }


def _provider_timestamp_iso(raw_data):
    if not isinstance(raw_data, dict):
        return None
    for key in ("timestamp_utc", "fetched_at_utc"):
        value = raw_data.get(key)
        if isinstance(value, str) and value:
            return value
    legacy = raw_data.get("source_updated_at_gmt")
    if not isinstance(legacy, str) or not legacy:
        return None
    try:
        parsed = datetime.strptime(legacy.strip().upper(), "%d-%m-%Y %I:%M:%S %p").replace(
            tzinfo=timezone.utc
        )
        return parsed.strftime('%Y-%m-%dT%H:%M:%SZ')
    except Exception:
        return None


def _parse_provider_timestamp(raw_data):
    parsed = None
    source_label = "provider timestamp"
    value = raw_data.get("source_updated_at_gmt") if isinstance(raw_data, dict) else None
    if value:
        try:
            parsed = datetime.strptime(str(value).strip().upper(), "%d-%m-%Y %I:%M:%S %p")
            parsed = parsed.replace(tzinfo=timezone.utc)
            source_label = "source_updated_at_gmt"
        except Exception:
            parsed = None
    if parsed is None and isinstance(raw_data, dict):
        for key in ("timestamp_utc", "fetched_at_utc"):
            candidate = raw_data.get(key)
            if not candidate or not isinstance(candidate, str):
                continue
            try:
                iso = candidate[:-1] + "+00:00" if candidate.endswith("Z") else candidate
                parsed = datetime.fromisoformat(iso)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                else:
                    parsed = parsed.astimezone(timezone.utc)
                source_label = key
                break
            except Exception:
                continue
    return parsed, source_label, value


def get_staleness_details(raw_data, _now=None):
    parsed, source_label, original_value = _parse_provider_timestamp(raw_data)
    if parsed is None:
        msg = f"WARN: could not parse provider timestamp source_updated_at_gmt={original_value!r}"
        return {
            "action": "parse_error",
            "message": msg,
            "age_hours": None,
            "age_str": None,
            "timestamp_utc": None,
            "source_label": source_label,
        }

    now = _now if _now is not None else datetime.now(timezone.utc)
    age = now - parsed
    age_secs = age.total_seconds()
    age_hours = age_secs / 3600
    iso = parsed.strftime('%Y-%m-%dT%H:%M:%SZ')
    h = int(age_secs // 3600)
    m = int((age_secs % 3600) // 60)
    age_str = f"{h}:{m:02d}"

    if age_hours <= 4:
        action = 'ok'
        msg = None
    elif age_hours <= 12:
        action = 'warn'
        msg = f"WARN: UPSTREAM STALE: {source_label} is {age_str} old (last: {iso})"
    else:
        action = 'skip'
        msg = f"ERROR: UPSTREAM SEVERELY STALE: {source_label} is {age_str} old (last: {iso})"
    return {
        "action": action,
        "message": msg,
        "age_hours": age_hours,
        "age_str": age_str,
        "timestamp_utc": iso,
        "source_label": source_label,
    }


# ── Staleness check ────────────────────────────────────────────────────────────
def check_staleness(raw_data, _now=None):
    """Check whether upstream gold price data is too old to post.

    Reads `source_updated_at_gmt` from raw_data (format: "DD-MM-YYYY HH:MM:SS am/pm", GMT).

    Returns (action, message):
      'ok'          – age ≤ 4 h, no action needed.
      'warn'        – 4 h < age ≤ 12 h, caller should log and continue.
      'skip'        – age > 12 h, caller should log and skip posting.
      'parse_error' – could not parse field, caller should log and continue.

    Pass `_now` (a tz-aware UTC datetime) to pin the clock in tests.
    """
    details = get_staleness_details(raw_data, _now=_now)
    return (details["action"], details["message"])


# ── Duplicate guard ────────────────────────────────────────────────────────────
def check_duplicate_guard(price, prev_price, prev_posted_at_utc, post_type, _now=None):
    """Check if this post would duplicate the previous one.

    Returns (should_skip, reason_str).

    The X bot is price-change driven: scheduled and manual runs should
    publish only when the committed spot price differs from the previous
    successful post. Market open/close event copy is still duplicate-guarded
    so a delayed or repeated scheduled event cannot repost the same price.

    Pass `_now` (a tz-aware UTC datetime) to pin the clock in tests.
    """
    if prev_price is None:
        return (False, None)
    if round(price, 2) != round(prev_price, 2):
        return (False, None)

    age_note = ""
    minutes_ago = None
    try:
        if prev_posted_at_utc:
            ts = prev_posted_at_utc
            if ts.endswith('Z'):
                ts = ts[:-1] + '+00:00'
            last_dt = datetime.fromisoformat(ts)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            now = _now if _now is not None else datetime.now(timezone.utc)
            minutes_ago = (now - last_dt).total_seconds() / 60
            age_note = (
                f" since {last_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}"
                f" ({int(minutes_ago)} min ago)"
            )
    except Exception:
        age_note = ""

    if post_type == 'market_closed_reference':
        # Emit a richer operator-friendly message for the closed-market case.
        trigger_source = os.environ.get('POST_TRIGGER_SOURCE', '').strip().lower() or 'unknown'
        trigger_nonce = os.environ.get('POST_TRIGGER_NONCE', '').strip() or '(none)'
        refresh_price_first = os.environ.get('REFRESH_PRICE_FIRST', 'false')
        minutes_age_str = str(int(minutes_ago)) if minutes_ago is not None else 'unknown'
        reason = (
            f"SKIP: market_closed_reference — same closing/reference price already posted\n"
            f"├── current_price:        ${price:,.2f}\n"
            f"├── previous_price:       ${prev_price:,.2f}\n"
            f"├── previous_post_ts:     {prev_posted_at_utc or 'unknown'}\n"
            f"├── minutes_since_post:   {minutes_age_str}\n"
            f"├── selected_post_type:   {post_type}\n"
            f"├── source:               {trigger_source}\n"
            f"├── trigger_nonce:        {trigger_nonce}\n"
            f"├── refresh_price_first:  {refresh_price_first}\n"
            f"└── action:               SKIPPED — use allow_same_price_closed_market_repost=true to override (manual/operator only)"
        )
    else:
        reason = (
            f"SKIP: price-change guard — {post_type} price ${price:,.2f}"
            f" unchanged{age_note}"
        )
    return (True, reason)


def is_allow_same_price_closed_market_repost(event_name=None, trigger_source=None):
    """Return True when the operator has explicitly enabled same-price repost override.

    This allows a manual/operator workflow_dispatch run for market_closed_reference
    to bypass the price-change guard even when the closing price is unchanged.
    It does NOT bypass duplicate_text_hash, cooldown (unless force_post), or X's own
    duplicate detection. Only applies when all three conditions hold:
      1. ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST=true in the environment.
      2. The run is a workflow_dispatch from a manual or shortcut operator.
      3. Scheduled runs are always excluded.
    """
    if not _env_truthy('ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST', default=False):
        return False
    return is_operator_market_hours_bypass(event_name=event_name, trigger_source=trigger_source)


def is_market_open_time(now=None):
    """Return True from Sunday 21:00 UTC through Friday 20:59:59 UTC."""
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    now = now.astimezone(timezone.utc)
    weekday = now.weekday()  # 0=Mon … 6=Sun
    hour = now.hour

    if weekday in (0, 1, 2, 3):
        return True
    if weekday == 4:
        return hour < 21
    if weekday == 6:
        return hour >= 21
    return False


def is_operator_market_hours_bypass(event_name=None, trigger_source=None):
    """Return True for workflow_dispatch runs from manual or shortcut operators."""
    event = (event_name or os.environ.get('GITHUB_EVENT_NAME', '')).strip().lower()
    source = (trigger_source or os.environ.get('POST_TRIGGER_SOURCE', '')).strip().lower()
    return event == 'workflow_dispatch' and source in ('manual', 'shortcut')


def should_skip_market_closed(post_type, now=None, event_name=None, trigger_source=None):
    """Skip scheduled hourly price posts outside 24/5 market hours."""
    if post_type in ('market_open', 'market_close'):
        return (False, None)
    if post_type == 'market_closed_reference':
        return (
            False,
            "Manual workflow_dispatch trigger; market-hours guard bypassed for operator-triggered run.",
        )
    if is_market_open_time(now):
        return (False, None)
    if is_operator_market_hours_bypass(event_name=event_name, trigger_source=trigger_source):
        return (
            False,
            "Manual workflow_dispatch trigger; market-hours guard bypassed for operator-triggered run.",
        )
    return (
        True,
        "SKIP: market closed — regular hourly price posts run only "
        "from Sunday 21:00 UTC through Friday 20:59 UTC",
    )


def select_post_type(base_post_type, market_open, operator_trigger):
    if base_post_type in ('market_open', 'market_close'):
        return base_post_type
    if not market_open and operator_trigger:
        return 'market_closed_reference'
    return 'hourly'


def _env_float(name, default):
    raw = os.environ.get(name, '')
    if raw == '':
        return float(default)
    try:
        return float(raw)
    except ValueError:
        print(f"WARN: invalid {name}={raw!r}; falling back to {float(default):g}")
        return float(default)


def _env_truthy(name, default=False):
    raw = os.environ.get(name, '')
    if raw == '':
        return bool(default)
    return str(raw).strip().lower() in ('1', 'true', 'yes', 'on')


def should_allow_closed_market_stale_reference(
    *,
    post_type,
    market_open,
    operator_trigger,
    staleness_details,
    price,
):
    if post_type != 'market_closed_reference' or market_open or not operator_trigger:
        return False
    if not isinstance(price, (int, float)) or price <= 0:
        return False
    timestamp_utc = staleness_details.get("timestamp_utc")
    age_hours = staleness_details.get("age_hours")
    if not timestamp_utc or age_hours is None:
        return False
    max_hours = _env_float("CLOSED_MARKET_MAX_STALE_HOURS", DEFAULT_CLOSED_MARKET_MAX_STALE_HOURS)
    return age_hours <= max_hours


# ── Step 2: Format the tweet ─────────────────────────────────────────────────


# ── Helpers ───────────────────────────────────────────────────────────────────
def _parse_fields(data):
    price = data.get('price')
    g24   = data.get('price_gram_24k')
    g22   = data.get('price_gram_22k')
    g21   = data.get('price_gram_21k')
    g18   = data.get('price_gram_18k')
    chp   = data.get('chp')
    if not all([price, g24, g22, g21, g18]):
        raise ValueError("gold_price.json missing required price fields")
    # Additional karats derived from 24K purity ratio when not supplied
    g20 = data.get('price_gram_20k') or g24 * (20 / 24)
    g16 = data.get('price_gram_16k') or g24 * (16 / 24)
    g14 = data.get('price_gram_14k') or g24 * (14 / 24)
    return price, g24, g22, g21, g20, g18, g16, g14, chp

def _aed(gram_usd):
    return f'{gram_usd * AED_RATE:.2f}'

def _change_str(chp):
    if chp is None:
        return ''
    sign = '+' if chp >= 0 else ''
    return f' ({sign}{chp:.2f}%)'

def _delta_str(price, prev_price):
    """Absolute $ delta + % delta suffix for the hourly 24K line.

    Returns "" if prev_price is None, " ±$0.00 (0.00%)" if abs delta < $0.01,
    otherwise " +$X.XX (+Y.YY%)" or " -$X.XX (-Y.YY%)".
    """
    if prev_price is None:
        return ''
    delta = price - prev_price
    if abs(delta) < 0.01:
        return ' ±$0.00 (0.00%)'
    pct = (delta / prev_price) * 100 if prev_price else 0.0
    sign = '+' if delta > 0 else '-'
    return f' {sign}${abs(delta):,.2f} ({sign}{abs(pct):.2f}%)'

def _prev_line(prev_price, prev_posted_at_utc):
    """Return the "Prev: $X,XXX.XX at H:MM AM/PM UAE\\n" line, or "" if unavailable."""
    if prev_price is None or prev_posted_at_utc is None:
        return ''
    try:
        ts = prev_posted_at_utc
        if ts.endswith('Z'):
            ts = ts[:-1] + '+00:00'
        dt = datetime.fromisoformat(ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        uae_time_str = dt.astimezone(UAE_TZ).strftime('%I:%M %p').lstrip('0')
    except Exception:
        return ''
    return f'Prev: ${prev_price:,.2f} at {uae_time_str} UAE\n'

def _trend_emoji(chp):
    if chp is None: return '📊'
    if chp > 0:     return '📈'
    if chp < 0:     return '📉'
    return '➡️'

def _spike_headline(chp, date_str):
    """Return a catchy alert headline when |chp| >= SPIKE_THRESHOLD_PCT, else None."""
    if chp is None or abs(chp) < SPIKE_THRESHOLD_PCT:
        return None
    if chp >= 3.0:
        return f"🚀 GOLD SPIKES +{chp:.1f}% — {date_str}"
    elif chp > 0:
        return f"⚡️ GOLD SURGES +{chp:.1f}% — {date_str}"
    elif chp <= -3.0:
        return f"🔥 GOLD PLUNGES {chp:.1f}% — {date_str}"
    else:
        return f"⚠️ GOLD DROPS {chp:.1f}% — {date_str}"

def _uae_datetime():
    now = datetime.now(UAE_TZ)
    return _format_uae_date_time_parts(now)


def _format_uae_date_time_parts(dt):
    # Platform-agnostic day formatting; avoids %-d portability issues.
    local_dt = dt.astimezone(UAE_TZ)
    date_str = f"{local_dt.strftime('%b')} {local_dt.day} {local_dt.year}"
    time_str = local_dt.strftime('%I:%M %p').lstrip('0')
    return date_str, time_str


def _format_uae_full_stamp(dt):
    date_str, time_str = _format_uae_date_time_parts(dt)
    return f"{date_str} · {time_str}"


def _format_uae_compact_stamp(dt):
    local_dt = dt.astimezone(UAE_TZ)
    time_str = local_dt.strftime('%I:%M %p').lstrip('0')
    return f"{local_dt.strftime('%b')} {local_dt.day} · {time_str}"


def _uae_time_from_iso(ts):
    try:
        raw = ts[:-1] + '+00:00' if ts.endswith('Z') else ts
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return _format_uae_full_stamp(dt)
    except Exception as exc:
        print(
            f"WARN: unable to format source timestamp {ts!r}"
            f" ({type(exc).__name__}: {exc}); using raw value"
        )
        return ts


def _uae_compact_time_from_iso(ts):
    try:
        raw = ts[:-1] + '+00:00' if ts.endswith('Z') else ts
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return _format_uae_compact_stamp(dt)
    except Exception as exc:
        print(
            f"WARN: unable to format compact source timestamp {ts!r}"
            f" ({type(exc).__name__}: {exc}); using raw value"
        )
        return ts


# ── Detect post type ──────────────────────────────────────────────────────────
def get_post_type(_now=None, schedule_cron=None):
    """Return event type based on the intended schedule, not delayed start time."""
    if schedule_cron == MARKET_OPEN_EVENT_CRON:
        return 'market_open'
    if schedule_cron == MARKET_CLOSE_EVENT_CRON:
        return 'market_close'

    now = _now if _now is not None else datetime.now(timezone.utc)
    weekday = now.weekday()  # 0=Mon … 6=Sun
    hour = now.hour
    minute = now.minute

    # Local/manual fallback: only classify the first few minutes of the event
    # hour as an event to avoid duplicate event tweets on repeated runs.
    if weekday == 6 and hour == 21 and minute < 6:
        return 'market_open'
    if weekday == 4 and hour == 21 and minute < 6:
        return 'market_close'
    return 'hourly'


# ── Tweet templates ───────────────────────────────────────────────────────────
def format_hourly_tweet(data):
    price, g24, g22, g21, g20, g18, g16, g14, chp = _parse_fields(data)
    prev_price = data.get('prev_price')
    prev_posted_at_utc = data.get('prev_posted_at_utc')
    date_str, time_str = _uae_datetime()
    trend = _trend_emoji(chp)
    spike = _spike_headline(chp, date_str)
    header = spike if spike else f"{trend} Gold Update — {date_str}"
    if prev_price is None:
        spot_line = f"24K · ${price:,.2f}/oz"
    else:
        spot_line = f"24K · ${price:,.2f}/oz {trend}{_delta_str(price, prev_price)}"
    tweet = (
        f"{header}\n"
        f"\n"
        f"🕐 {time_str} (UAE · GMT+4)\n"
        f"\n"
        f"Spot XAU/USD\n"
        f"{spot_line}\n"
        f"{_prev_line(prev_price, prev_posted_at_utc)}"
        f"\n"
        f"🇦🇪 AED/g\n"
        f"24K  {_aed(g24)}\n"
        f"22K  {_aed(g22)}\n"
        f"21K  {_aed(g21)}\n"
        f"20K  {_aed(g20)}\n"
        f"18K  {_aed(g18)}\n"
        f"16K  {_aed(g16)}\n"
        f"14K  {_aed(g14)}\n"
        f"\n"
        f"Spot ref · Not retail price\n"
        f"\n"
        f"goldtickerlive.com\n"
        f"\n"
        f"#GoldPrice #Gold #UAE #Dubai"
    )
    return tweet

def format_market_open_tweet(data):
    price, g24, g22, g21, g20, g18, g16, g14, chp = _parse_fields(data)
    return (
        f"🟢 Gold Market Is Now Open\n"
        f"🕐 Monday · 1:00 AM (UAE · GMT+4)\n"
        f"\n"
        f"Opening Spot XAU/USD\n"
        f"24K · ${price:,.2f}/oz{_change_str(chp)}\n"
        f"\n"
        f"🇦🇪 AED/g\n"
        f"24K  {_aed(g24)}\n"
        f"22K  {_aed(g22)}\n"
        f"21K  {_aed(g21)}\n"
        f"20K  {_aed(g20)}\n"
        f"18K  {_aed(g18)}\n"
        f"16K  {_aed(g16)}\n"
        f"14K  {_aed(g14)}\n"
        f"\n"
        f"New week. Track live prices 👇\n"
        f"\n"
        f"goldtickerlive.com\n"
        f"\n"
        f"#GoldPrice #Gold #XAU #UAE #Dubai"
    )

def format_market_close_tweet(data):
    price, g24, g22, g21, g20, g18, g16, g14, chp = _parse_fields(data)
    return (
        f"🔴 Gold Market Is Now Closed\n"
        f"🕐 Saturday · 1:00 AM (UAE · GMT+4)\n"
        f"\n"
        f"Closing Spot XAU/USD\n"
        f"24K · ${price:,.2f}/oz{_change_str(chp)}\n"
        f"\n"
        f"🇦🇪 AED/g\n"
        f"24K  {_aed(g24)}\n"
        f"22K  {_aed(g22)}\n"
        f"21K  {_aed(g21)}\n"
        f"20K  {_aed(g20)}\n"
        f"18K  {_aed(g18)}\n"
        f"16K  {_aed(g16)}\n"
        f"14K  {_aed(g14)}\n"
        f"\n"
        f"Reopens Monday 1:00 AM 🌙\n"
        f"\n"
        f"goldtickerlive.com\n"
        f"\n"
        f"#GoldPrice #Gold #XAU #UAE #Dubai"
    )

def format_market_closed_reference_tweet(data):
    """Format a clean market-closed reference post from cached spot data.

    Public tweet uses closing/last-known wording.  Stale cache age is kept
    in workflow logs only (via stale_age_hours in the data dict) and is NOT
    included in the public post body.
    """
    price, g24, g22, g21, g20, g18, g16, g14, chp = _parse_fields(data)
    source_updated_at = data.get('source_updated_at_utc') or 'timestamp unavailable'
    stale_age_hours = data.get('stale_age_hours')
    if isinstance(stale_age_hours, (int, float)):
        print(f"   [log] cache age: {stale_age_hours:.1f}h (not shown in public post)")
    date_str, time_str = _uae_datetime()
    return (
        f"🔴 Gold Market Closed\n"
        f"{date_str} · {time_str} UAE\n"
        f"\n"
        f"Spot ref XAU/USD\n"
        f"24K · ${price:,.2f}/oz{_change_str(chp)}\n"
        f"\n"
        f"🇦🇪 AED/g\n"
        f"24K  {_aed(g24)}\n"
        f"22K  {_aed(g22)}\n"
        f"21K  {_aed(g21)}\n"
        f"20K  {_aed(g20)}\n"
        f"18K  {_aed(g18)}\n"
        f"16K  {_aed(g16)}\n"
        f"14K  {_aed(g14)}\n"
        f"\n"
        f"Reopens {MARKET_REOPENS_UAE_LABEL} 🌙\n"
        f"Updated {_uae_compact_time_from_iso(source_updated_at)} UAE\n"
        f"\n"
        f"Spot ref · Not retail\n"
        f"\n"
        f"goldtickerlive.com\n"
        f"\n"
        f"#GoldPrice #XAU #UAE"
    )


def format_hourly_tweet_compact(data):
    price, g24, g22, g21, g20, g18, g16, g14, chp = _parse_fields(data)
    prev_price = data.get('prev_price')
    prev_posted_at_utc = data.get('prev_posted_at_utc')
    date_str, time_str = _uae_datetime()
    trend = _trend_emoji(chp)
    spike = _spike_headline(chp, date_str)
    header = spike if spike else f"{trend} Gold Update · {date_str}"
    spot_line = f"24K ${price:,.2f}/oz"
    if prev_price is not None:
        spot_line += _delta_str(price, prev_price)
    prev_line = ""
    if prev_price is not None and prev_posted_at_utc:
        try:
            raw_prev = prev_posted_at_utc[:-1] + '+00:00' if prev_posted_at_utc.endswith('Z') else prev_posted_at_utc
            prev_dt = datetime.fromisoformat(raw_prev)
            if prev_dt.tzinfo is None:
                prev_dt = prev_dt.replace(tzinfo=timezone.utc)
            prev_line = f"Prev ${prev_price:,.2f} · {_format_uae_compact_stamp(prev_dt)} UAE\n"
        except Exception:
            prev_line = f"Prev ${prev_price:,.2f}\n"
    return (
        f"{header}\n"
        f"{time_str} UAE\n"
        f"\n"
        f"Spot XAU/USD\n"
        f"{spot_line}\n"
        f"{prev_line}"
        f"\n"
        f"🇦🇪 AED/g\n"
        f"24K {_aed(g24)} · 22K {_aed(g22)}\n"
        f"21K {_aed(g21)} · 20K {_aed(g20)}\n"
        f"18K {_aed(g18)} · 16K {_aed(g16)} · 14K {_aed(g14)}\n"
        f"\n"
        f"Spot ref · Not retail\n"
        f"goldtickerlive.com\n"
        f"#GoldPrice #XAU #UAE"
    )


def format_market_open_tweet_compact(data):
    price, g24, g22, g21, g20, g18, g16, g14, chp = _parse_fields(data)
    return (
        f"🟢 Gold Market Open\n"
        f"{MARKET_REOPENS_UAE_LABEL}\n"
        f"\n"
        f"Opening Spot XAU/USD\n"
        f"24K ${price:,.2f}/oz{_change_str(chp)}\n"
        f"\n"
        f"🇦🇪 AED/g\n"
        f"24K {_aed(g24)} · 22K {_aed(g22)}\n"
        f"21K {_aed(g21)} · 20K {_aed(g20)}\n"
        f"18K {_aed(g18)} · 16K {_aed(g16)} · 14K {_aed(g14)}\n"
        f"\n"
        f"Track live prices\n"
        f"goldtickerlive.com\n"
        f"#GoldPrice #XAU #UAE"
    )


def format_market_close_tweet_compact(data):
    price, g24, g22, g21, g20, g18, g16, g14, chp = _parse_fields(data)
    return (
        f"🔴 Gold Market Closed\n"
        f"Sat 1:00 AM UAE\n"
        f"\n"
        f"Closing Spot XAU/USD\n"
        f"24K ${price:,.2f}/oz{_change_str(chp)}\n"
        f"\n"
        f"🇦🇪 AED/g\n"
        f"24K {_aed(g24)} · 22K {_aed(g22)}\n"
        f"21K {_aed(g21)} · 20K {_aed(g20)}\n"
        f"18K {_aed(g18)} · 16K {_aed(g16)} · 14K {_aed(g14)}\n"
        f"\n"
        f"Reopens {MARKET_REOPENS_UAE_LABEL}\n"
        f"goldtickerlive.com\n"
        f"#GoldPrice #XAU #UAE"
    )


def _tweet_max_chars():
    """Return the active character limit.

    Reads TWEET_MAX_CHARS from the environment (default: 25000 for X Premium).
    Set to 280 for a standard non-Premium account to restore compact-fallback
    behaviour.  The value is clamped to [280, 25000].
    """
    raw = os.environ.get('TWEET_MAX_CHARS', '25000').strip()
    try:
        return max(280, min(25000, int(raw)))
    except (ValueError, TypeError):
        return 25000


def _render_tweet(data, post_type):
    """Format a tweet and enforce the active character limit.

    When TWEET_MAX_CHARS is 280 (non-Premium account) the function tries the
    standard template first and falls back to the compact variant if the
    standard template exceeds the limit.  For X Premium accounts (default
    25,000-char limit) the standard template is always used.

    If all available variants still exceed the active limit the longest
    variant is returned with a warning — the X API will reject it if the
    account is not Premium, which is the correct fail-fast behaviour.
    """
    max_chars = _tweet_max_chars()
    print(f"   Post type: {post_type}  |  tweet_max_chars: {max_chars}")

    if post_type == 'market_open':
        variants = [('market_open', format_market_open_tweet),
                    ('market_open_compact', format_market_open_tweet_compact)]
    elif post_type == 'market_close':
        variants = [('market_close', format_market_close_tweet),
                    ('market_close_compact', format_market_close_tweet_compact)]
    elif post_type == 'market_closed_reference':
        variants = [('market_closed_reference', format_market_closed_reference_tweet)]
    else:
        variants = [('hourly', format_hourly_tweet),
                    ('hourly_compact', format_hourly_tweet_compact)]

    last_variant_name = variants[0][0]
    last_tweet = ""
    for variant_name, formatter in variants:
        candidate = formatter(data)
        last_variant_name = variant_name
        last_tweet = candidate
        if len(candidate) <= max_chars:
            if variant_name != variants[0][0]:
                print(f"   template_variant: {variant_name} (compact fallback; standard exceeded {max_chars}-char limit)")
            return {
                "text": candidate,
                "template_used": variant_name,
                "tweet_length": len(candidate),
                "fits_limit": True,
            }

    # All variants exceed the limit — return the last (most compact) one with a warning.
    tweet_len = len(last_tweet)
    print(
        f"⚠️  tweet_length={tweet_len} > {max_chars} — all variants exceed the active limit;"
        f" posting anyway (X API will reject if account is not Premium)."
    )
    return {
        "text": last_tweet,
        "template_used": last_variant_name,
        "tweet_length": tweet_len,
        "fits_limit": False,
    }


def format_tweet(data, post_type, return_meta=False):
    rendered = _render_tweet(data, post_type)
    if return_meta:
        return rendered
    return rendered["text"]


def get_template_name(post_type):
    if post_type == 'market_open':
        return 'market_open'
    if post_type == 'market_close':
        return 'market_close'
    if post_type == 'market_closed_reference':
        return 'market_closed_reference'
    return 'hourly'


def build_guard_quote(raw_data, data, *, staleness_action, post_type, closed_market_stale_allowed):
    """Build the tweet-guard quote payload with closed-market reference overrides."""
    source_type = (
        raw_data.get("source_type") if isinstance(raw_data, dict) else None
    ) or "spot_reference"
    is_fresh = staleness_action == 'ok'
    if closed_market_stale_allowed and post_type == 'market_closed_reference':
        source_type = 'market_closed_reference'
        is_fresh = True
    return {
        "xau_usd_per_oz": data['price'],
        "timestamp_utc": _provider_timestamp_iso(raw_data),
        "is_fresh": is_fresh,
        "is_fallback": False,
        "provider": (
            (raw_data.get("provider") if isinstance(raw_data, dict) else None)
            or (raw_data.get("source") if isinstance(raw_data, dict) else None)
            or "goldpricez"
        ),
        "source_type": source_type,
    }


# ── Step 3: Post to X / Twitter ──────────────────────────────────────────────
def _log_tweet_error(exc, text, post_type):
    """Log structured diagnostic info for a Tweepy exception. Never logs secrets."""
    sha = os.environ.get('GITHUB_SHA', '')
    sha_short = sha[:7] if sha else 'local'
    resp = getattr(exc, 'response', None)
    print("=== TWEET ERROR ===")
    print(f"  exception:     {type(exc).__name__}")
    print(f"  status_code:   {getattr(resp, 'status_code', 'n/a')}")
    print(f"  response_body: {getattr(resp, 'text', 'n/a')}")
    print(f"  api_errors:    {getattr(exc, 'api_errors', 'n/a')}")
    print(f"  api_messages:  {getattr(exc, 'api_messages', 'n/a')}")
    print(f"  api_codes:     {getattr(exc, 'api_codes', 'n/a')}")
    print(f"  post_length:   {len(text)}")
    print(f"  post_type:     {post_type}")
    print(f"  event:         {os.environ.get('GITHUB_EVENT_NAME', 'local')}")
    print(f"  actor:         {os.environ.get('GITHUB_ACTOR', 'local')}")
    print(f"  sha:           {sha_short}")
    print(f"  content_hash:  {compute_content_hash(text)}")
    print("===================")


def _parse_x_api_problem(exc):
    resp = getattr(exc, 'response', None)
    raw_text = getattr(resp, 'text', '')
    try:
        payload = json.loads(raw_text) if isinstance(raw_text, str) and raw_text.strip() else {}
    except Exception:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    problem = {}
    for key in ("title", "detail", "type", "reset_date"):
        value = payload.get(key)
        problem[key] = str(value).strip() if value is not None else ""
    return problem


def _is_spend_cap_problem(problem):
    title = problem.get("title", "").lower()
    detail = problem.get("detail", "").lower()
    type_url = problem.get("type", "").lower()
    return (
        title == "spendcapreached"
        or "spend cap" in detail
        or "/problems/credits" in type_url
    )


def classify_post_exception(exc, *, post_type, template_used, price, tweet_length, trigger_source, trigger_nonce):
    exc_name = type(exc).__name__
    operator_action = "inspect_x_workflow_logs"
    status = "failed"
    outcome = "FAILED_X_API"
    retry_after = None
    if exc_name == "Unauthorized":
        outcome = "FAILED_UNAUTHORIZED"
        status = "operator_action_needed"
        operator_action = "rotate_or_restore_x_credentials"
    elif exc_name == "TooManyRequests":
        outcome = "FAILED_RATE_LIMIT"
        status = "operator_action_needed"
        operator_action = "wait_for_x_rate_limit_reset"
        resp = getattr(exc, "response", None)
        retry_after = getattr(resp, "headers", {}).get("Retry-After") if resp is not None else None
    elif exc_name == "BadRequest":
        outcome = "FAILED_BAD_REQUEST"
        operator_action = "inspect_x_payload_and_response"
    elif exc_name == "Forbidden":
        outcome = "FAILED_FORBIDDEN"
        operator_action = "inspect_duplicate_or_account_policy_state"
    return RunResult(
        outcome=outcome,
        status=status,
        post_type=post_type,
        template_used=template_used,
        price_usd_oz=price,
        tweet_length=tweet_length,
        trigger_source=trigger_source,
        trigger_nonce=trigger_nonce or "(none)",
        operator_action=operator_action,
        retry_after_seconds=retry_after,
        detail=exc_name,
    )


def post_tweet(text, post_type='hourly'):
    """Post the tweet using tweepy (X API v2)."""
    import tweepy

    client = tweepy.Client(
        consumer_key=TWITTER_API_KEY,
        consumer_secret=TWITTER_API_SECRET,
        access_token=TWITTER_ACCESS_TOKEN,
        access_token_secret=TWITTER_ACCESS_TOKEN_SECRET,
    )
    try:
        client.create_tweet(text=text)
        print("✅ Tweet posted successfully")
        return {"posted": True}
    except tweepy.errors.Forbidden as exc:
        _log_tweet_error(exc, text, post_type)
        problem = _parse_x_api_problem(exc)
        if _is_spend_cap_problem(problem):
            reset_date = problem.get("reset_date") or "unknown"
            print("   SKIP: X API spend cap reached; no post was sent.")
            print(f"   Billing cycle reset date: {reset_date}")
            print("   Increase the spend cap in the developer console or wait for the reset date.")
            return {
                "posted": False,
                "skip_reason": "spend_cap_reached",
                "reset_date": reset_date,
            }
        print("   Likely cause: duplicate/near-duplicate content, or automation-rule violation."
              " Check recent posts from @GoldTickerLive.")
        raise
    except tweepy.errors.Unauthorized as exc:
        _log_tweet_error(exc, text, post_type)
        print("   Likely cause: invalid or revoked credentials."
              " Regenerate tokens in the X Developer Portal.")
        raise
    except tweepy.errors.BadRequest as exc:
        _log_tweet_error(exc, text, post_type)
        raise
    except tweepy.errors.TooManyRequests as exc:
        _log_tweet_error(exc, text, post_type)
        resp = getattr(exc, 'response', None)
        retry_after = getattr(resp, 'headers', {}).get('Retry-After') if resp is not None else None
        if retry_after is not None:
            print(f"   Retry-After: {retry_after}s")
        raise
    except tweepy.errors.TweepyException as exc:
        _log_tweet_error(exc, text, post_type)
        raise


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    # 1. Validate env vars
    missing = []
    for name, value in [
        ('TWITTER_API_KEY', TWITTER_API_KEY),
        ('TWITTER_API_SECRET', TWITTER_API_SECRET),
        ('TWITTER_ACCESS_TOKEN', TWITTER_ACCESS_TOKEN),
        ('TWITTER_ACCESS_TOKEN_SECRET', TWITTER_ACCESS_TOKEN_SECRET),
    ]:
        if not value:
            missing.append(name)

    if missing:
        count = len(missing)
        print(f"⚠️  {count} required environment variable(s) not set.")
        print("   Set these as GitHub Secrets in Settings → Secrets → Actions.")
        print("   Skipping tweet.")
        finish_run(
            RunResult(
                outcome="SKIPPED_MISSING_CREDENTIALS",
                status="skip",
                operator_action="set_missing_x_secrets",
                detail=", ".join(missing),
            ),
            exit_code=0,
        )

    # 2. Load raw gold price data
    if not GOLD_PRICE_FILE.exists():
        print(f"FATAL: {GOLD_PRICE_FILE} not found."
              " The gold-price-fetch.yml workflow must run first to populate it.")
        finish_run(
            RunResult(
                outcome="FAILED_MISSING_GOLD_PRICE_FILE",
                status="fatal",
                operator_action="run_gold_price_fetch_workflow_first",
                detail=str(GOLD_PRICE_FILE),
            ),
            exit_code=1,
        )
    try:
        raw_data = json.loads(GOLD_PRICE_FILE.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as _json_exc:
        print(f"FATAL: {GOLD_PRICE_FILE} unreadable — {_json_exc}")
        finish_run(
            RunResult(
                outcome="FAILED_UNREADABLE_GOLD_PRICE_FILE",
                status="fatal",
                operator_action="repair_gold_price_json",
                detail=str(_json_exc),
            ),
            exit_code=1,
        )
    source_ts = _provider_timestamp_iso(raw_data) or (
        raw_data.get("source_updated_at_gmt", "n/a") if isinstance(raw_data, dict) else "n/a"
    )
    refresh_price_first = os.environ.get('REFRESH_PRICE_FIRST', 'false')
    trigger_nonce = os.environ.get('POST_TRIGGER_NONCE', '').strip()
    run_id = os.environ.get('GITHUB_RUN_ID', '').strip()
    run_attempt = os.environ.get('GITHUB_RUN_ATTEMPT', '').strip()
    force_post_enabled = _env_truthy('FORCE_POST', default=False)
    allow_same_price_repost = os.environ.get('ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST', 'false')
    guard_state = tweet_guard.load_state(LAST_TWEET_STATE_FILE) if tweet_guard is not None else None
    shortcut_state_snapshot = _snapshot_text_file(LAST_TWEET_STATE_FILE)
    shortcut_attempt_recorded = False

    # Pre-compute force_summary_due from guard state for the RUN CONTEXT block.
    _force_summary_min = int(os.environ.get('FORCE_SUMMARY_AFTER_MINUTES', '60') or '60')
    _minutes_since_last: Optional[float] = None
    _force_summary_due: Optional[bool] = None
    if tweet_guard is not None and guard_state is not None:
        _minutes_since_last = tweet_guard._minutes_since(guard_state.last_tweet_time_utc)
        _force_summary_due = (
            _minutes_since_last is None or _minutes_since_last >= _force_summary_min
        )

    # 3. Compute post type from the intended cron schedule when available.
    # GitHub scheduled workflows can start late, so using github.event.schedule
    # prevents repeated event tweets during the whole delayed start hour.
    schedule_cron = os.environ.get('GITHUB_EVENT_SCHEDULE', '').strip() or None
    trigger_source = (
        os.environ.get('POST_TRIGGER_SOURCE', '').strip().lower()
        or ('scheduled' if schedule_cron else 'manual')
    )
    base_post_type = get_post_type(schedule_cron=schedule_cron)
    market_open = is_market_open_time()
    operator_trigger = is_operator_market_hours_bypass(
        event_name=os.environ.get('GITHUB_EVENT_NAME'),
        trigger_source=trigger_source,
    )
    post_type = select_post_type(base_post_type, market_open, operator_trigger)
    template_used = get_template_name(post_type)

    # 4. Print RUN CONTEXT block
    sha = os.environ.get('GITHUB_SHA', '')
    _gs_price = f"${guard_state.last_price_usd_oz:,.4f}/oz" if (guard_state and guard_state.last_price_usd_oz is not None) else "none"
    _gs_time = guard_state.last_tweet_time_utc if (guard_state and guard_state.last_tweet_time_utc) else "none"
    _gs_hash = guard_state.last_tweet_text_hash[:12] if (guard_state and guard_state.last_tweet_text_hash) else "none"
    _mins_str = f"{_minutes_since_last:.2f}" if _minutes_since_last is not None else "none"
    _ltp_utc = guard_state.last_provider_timestamp_utc if (guard_state and guard_state.last_provider_timestamp_utc) else "none"
    print("=== RUN CONTEXT ===")
    print(f"event:        {os.environ.get('GITHUB_EVENT_NAME', 'local')}")
    print(f"sha:          {sha[:7] if sha else 'local'}")
    print(f"actor:        {os.environ.get('GITHUB_ACTOR', 'local')}")
    print(f"schedule:     {schedule_cron or 'manual/local'}")
    print(f"source:       {trigger_source}")
    print(f"refresh_price_first:                    {refresh_price_first}")
    print(f"trigger_nonce:                          {trigger_nonce or '(none)'}")
    print(f"dry_run:      {os.environ.get('DRY_RUN_TWEET', 'false')}")
    print(f"force_post:   {os.environ.get('FORCE_POST', 'false')}")
    print(f"allow_same_price_closed_market_repost:  {allow_same_price_repost}")
    print(f"github.run_id:            {run_id or 'local'}")
    print(f"github.run_attempt:       {run_attempt or 'local'}")
    print(f"market_open:               {market_open}")
    print(f"operator_trigger:          {operator_trigger}")
    print(f"post_type:                 {base_post_type}")
    print(f"selected_post_type:        {post_type}")
    print(f"template_used:             {template_used}")
    print(f"data_file:    data/gold_price.json (exists={GOLD_PRICE_FILE.exists()})")
    print(f"state_file:   data/last_gold_price.json (exists={STATE_FILE.exists()})")
    print(f"guard_state:  data/last_tweet_state.json (exists={LAST_TWEET_STATE_FILE.exists()})")
    print(f"source_ts:    {source_ts}")
    print(f"--- guard state (data/last_tweet_state.json) ---")
    print(f"last_price_usd_oz (guard):              {_gs_price}")
    print(f"last_tweet_time_utc (guard):            {_gs_time}")
    print(f"last_provider_timestamp_utc (guard):    {_ltp_utc}")
    print(f"last_tweet_text_hash (guard, 12ch):     {_gs_hash}")
    print(f"minutes_since_last_tweet:               {_mins_str}")
    print(f"force_summary_due:                      {_force_summary_due}")
    print(f"force_summary_after_minutes:            {_force_summary_min}")
    print("===================")

    # 4a. Shortcut-triggered workflow_dispatch anti-spam guard. Record the
    # latest Shortcut attempt before the normal stale/duplicate/cooldown guards
    # so accidental iPhone Shortcut floods self-throttle on the next run.
    if tweet_guard is not None and guard_state is not None and trigger_source == 'shortcut':
        skip, reason = tweet_guard.should_skip_recent_shortcut_attempt(
            guard_state,
            trigger_source=trigger_source,
            window_minutes=SHORTCUT_TRIGGER_SPAM_WINDOW_MINUTES,
            force_post=force_post_enabled,
        )
        if reason:
            print(reason)
        if skip:
            finish_run(
                RunResult(
                    outcome="SKIPPED_SHORTCUT_ANTI_SPAM",
                    status="skip",
                    skip_reason="shortcut_anti_spam",
                    post_type=post_type,
                    template_used=template_used,
                    trigger_source=trigger_source,
                    trigger_nonce=trigger_nonce or "(none)",
                ),
                exit_code=0,
            )
        is_dry_run_tweet = os.getenv("DRY_RUN_TWEET", "").strip().lower() == "true"
        if is_dry_run_tweet:
            print("shortcut_attempt_recorded: false (dry run)")
        else:
            try:
                guard_state = tweet_guard.record_trigger_attempt(
                    guard_state,
                    trigger_source=trigger_source,
                    trigger_nonce=trigger_nonce,
                    run_id=run_id,
                    run_attempt=run_attempt,
                )
                tweet_guard.save_state(LAST_TWEET_STATE_FILE, guard_state)
                shortcut_attempt_recorded = True
                print("shortcut_attempt_recorded: true")
            except Exception as exc:  # pragma: no cover — best-effort
                print(f"⚠️  Failed to record shortcut trigger attempt: {exc}")

    # 5. Load gold price (includes previous-state fields from data/last_gold_price.json)
    # NOTE: data/last_gold_price.json uses a legacy schema {"price":..., "posted_at_utc":...}.
    # fetch_gold_price.py also writes to this file with the full normalized payload when a fresh
    # quote is found — the two schemas are incompatible. If refresh_price_first=true ran before
    # this step, the file may have been overwritten by the fetcher, causing _load_last_price() to
    # return (None, None, None) and "Previous post (legacy): none". The authoritative duplicate-
    # guard state (including last price and tweet time) lives in data/last_tweet_state.json and
    # is shown in the guard state section above.
    print("📡 Reading gold price from data/gold_price.json (canonical price payload)…")
    previous_post = _previous_post_from_guard_state(guard_state)
    data = get_gold_price(previous_post=previous_post)
    print(f"   Spot: ${data['price']:,.2f}/oz")
    if previous_post is not None:
        print(
            f"   Previous post (authoritative data/last_tweet_state.json): "
            f"${data['prev_price']:,.4f}/oz at {data.get('prev_posted_at_utc') or 'n/a'}"
        )
        if STATE_FILE.exists():
            print("   Legacy data/last_gold_price.json retained for compatibility; tweet guard state remains authoritative.")
    elif data.get('prev_price') is not None:
        print(f"   Previous post (legacy data/last_gold_price.json): ${data['prev_price']:,.2f}/oz at {data.get('prev_posted_at_utc') or 'n/a'}")
    else:
        print("   Previous post: none")

    # 6. Staleness check
    staleness_details = get_staleness_details(raw_data)
    staleness_action = staleness_details["action"]
    staleness_msg = staleness_details["message"]
    if staleness_msg:
        print(staleness_msg)
    closed_market_stale_allowed = should_allow_closed_market_stale_reference(
        post_type=post_type,
        market_open=market_open,
        operator_trigger=operator_trigger,
        staleness_details=staleness_details,
        price=data['price'],
    )
    stale_age_hours = staleness_details.get("age_hours")
    stale_age_label = "n/a" if stale_age_hours is None else f"{stale_age_hours:.2f}"
    print(f"stale_age_hours:          {stale_age_label}")
    print(f"closed_market_stale_allowed: {closed_market_stale_allowed}")
    if staleness_action == 'skip' and not closed_market_stale_allowed:
        finish_run(
            RunResult(
                outcome="SKIPPED_STALE_QUOTE",
                status="skip",
                skip_reason="stale_quote",
                post_type=post_type,
                template_used=template_used,
                price_usd_oz=data['price'],
                trigger_source=trigger_source,
                trigger_nonce=trigger_nonce or "(none)",
            ),
            exit_code=0,
        )
    if staleness_action == 'parse_error' and post_type == 'market_closed_reference':
        print(
            "SKIP: market-closed reference post requires a valid source timestamp"
            f" ({staleness_msg or 'provider timestamp missing or invalid'})."
        )
        finish_run(
            RunResult(
                outcome="SKIPPED_INVALID_PROVIDER_TIMESTAMP",
                status="skip",
                skip_reason="provider_timestamp_parse_error",
                post_type=post_type,
                template_used=template_used,
                price_usd_oz=data['price'],
                trigger_source=trigger_source,
                trigger_nonce=trigger_nonce or "(none)",
            ),
            exit_code=0,
        )

    # 7. 24/5 market-hours guard for regular price posts
    skip, reason = should_skip_market_closed(
        post_type,
        event_name=os.environ.get('GITHUB_EVENT_NAME'),
        trigger_source=trigger_source,
    )
    if reason:
        print(reason)
    if skip:
        finish_run(
            RunResult(
                outcome="SKIPPED_MARKET_CLOSED",
                status="skip",
                skip_reason="market_closed",
                post_type=post_type,
                template_used=template_used,
                price_usd_oz=data['price'],
                trigger_source=trigger_source,
                trigger_nonce=trigger_nonce or "(none)",
            ),
            exit_code=0,
        )

    if post_type == 'market_closed_reference':
        data['source_updated_at_utc'] = staleness_details.get("timestamp_utc")
        data['stale_age_hours'] = stale_age_hours

    # 8. Price-change guard
    skip, reason = check_duplicate_guard(
        data['price'],
        data['prev_price'],
        data['prev_posted_at_utc'],
        post_type,
    )
    if skip:
        print(reason)
        # For market_closed_reference, the operator may explicitly allow a
        # same-price repost via allow_same_price_closed_market_repost=true.
        # This only applies to manual/operator workflow_dispatch runs;
        # it still respects duplicate_text_hash, cooldown, and X duplicate rules.
        if (
            post_type == 'market_closed_reference'
            and is_allow_same_price_closed_market_repost(
                event_name=os.environ.get('GITHUB_EVENT_NAME'),
                trigger_source=trigger_source,
            )
        ):
            print(
                "allow_same_price_closed_market_repost=true — price-change guard bypassed "
                "for this manual/operator market_closed_reference run. "
                "duplicate_text_hash, cooldown, and X duplicate rules still apply."
            )
        else:
            finish_run(
                RunResult(
                    outcome="SKIPPED_PRICE_CHANGE_GUARD",
                    status="skip",
                    skip_reason="price_change_guard",
                    post_type=post_type,
                    template_used=template_used,
                    price_usd_oz=data['price'],
                    trigger_source=trigger_source,
                    trigger_nonce=trigger_nonce or "(none)",
                ),
                exit_code=0,
            )

    # 9. Format tweet
    tweet_metadata = format_tweet(data, post_type, return_meta=True)
    if isinstance(tweet_metadata, str):
        tweet_metadata = {
            "text": tweet_metadata,
            "template_used": template_used,
            "tweet_length": len(tweet_metadata),
            "fits_limit": len(tweet_metadata) <= 280,
        }
    tweet = tweet_metadata["text"]
    template_used = tweet_metadata["template_used"]
    tweet_length = tweet_metadata["tweet_length"]
    print("📝 Generated tweet:")
    print(tweet)
    print(f"   ({tweet_length} characters)")

    # 10. Content-hash guard
    tweet_hash = compute_content_hash(tweet)
    prev_hash = data.get('prev_content_hash')
    if (
        prev_hash is not None
        and tweet_hash == prev_hash
        and data['prev_posted_at_utc'] is not None
    ):
        print(
            f"SKIP: content-hash guard — tweet content identical to last post"
            f" (hash {tweet_hash})"
        )
        finish_run(
            RunResult(
                outcome="SKIPPED_DUPLICATE_CONTENT_HASH",
                status="skip",
                skip_reason="content_hash_duplicate",
                post_type=post_type,
                template_used=template_used,
                price_usd_oz=data['price'],
                tweet_length=tweet_length,
                content_hash=tweet_hash,
                trigger_source=trigger_source,
                trigger_nonce=trigger_nonce or "(none)",
            ),
            exit_code=0,
        )

    # 10b. New X duplicate-prevention guard (additive). Skips on:
    #      • provider timestamp unchanged (GoldPriceZ freezing case)
    #      • exact tweet-text hash match
    #      • sub-threshold price movement when no force-summary window is due
    #      • fallback/cache source with same price+timestamp
    # Controlled by SKIP_DUPLICATE_TWEETS (default true). Set false to bypass.
    if tweet_guard is not None:
        guard_quote = build_guard_quote(
            raw_data,
            data,
            staleness_action=staleness_action,
            post_type=post_type,
            closed_market_stale_allowed=closed_market_stale_allowed,
        )
        decision = tweet_guard.decide(guard_state, quote=guard_quote, tweet_text=tweet)
        should_bypass_threshold = (
            not decision.should_post
            and decision.skip_reason == "price_move_below_threshold"
            and post_type == "market_closed_reference"
            and is_allow_same_price_closed_market_repost(
                event_name=os.environ.get('GITHUB_EVENT_NAME'),
                trigger_source=trigger_source,
            )
        )
        if not decision.should_post:
            if should_bypass_threshold:
                print(
                    "allow_same_price_closed_market_repost=true — tweet-guard "
                    "price_move_below_threshold bypassed for this manual/operator "
                    "market_closed_reference run. duplicate_text_hash, cooldown, "
                    "and X duplicate rules still apply."
                )
            else:
                skip_msg = (
                    f"SKIP: tweet-guard — {decision.skip_reason}"
                    f" (hash={decision.tweet_hash[:12]}, move=${decision.price_move_usd or 0:.2f},"
                    f" ts_changed={decision.provider_timestamp_changed})"
                )
                if decision.skip_reason == "price_move_below_threshold":
                    # Provide context-specific guidance so operators understand why force_post alone
                    # is not enough and what to do next.
                    mins_str = f"{decision.minutes_since_last:.1f}" if decision.minutes_since_last is not None else "unknown"
                    skip_msg += (
                        f"\n   post_type:              {post_type}"
                        f"\n   force_summary_due:      {decision.force_summary_due}"
                        f"\n   minutes_since_last:     {mins_str}"
                        f"\n   force_summary_after:    {_force_summary_min} min"
                        f"\n   force_post:             {force_post_enabled}"
                        f"\n   Note: force_post=True bypasses cooldown only, NOT price_move_below_threshold."
                    )
                    if post_type == "market_closed_reference":
                        skip_msg += (
                            f"\n   SKIP: market_closed_reference same closing/reference price already posted"
                            f" and force_summary_due=False."
                            f"\n   To allow same-price market_closed_reference repost:"
                            f" set allow_same_price_closed_market_repost=true in workflow_dispatch inputs."
                        )
                    else:
                        skip_msg += (
                            f"\n   Wait for force_summary_due=True (>={_force_summary_min} min since last post)"
                            f" or for the price to move by ≥${_env_float('MIN_TWEET_MOVE_USD', 1.0):.2f}"
                            f" (>{_env_float('MIN_TWEET_MOVE_PCT', 0.03):.2f}%)."
                        )
                elif decision.should_post is False and post_type == "market_closed_reference":
                    # For other skip reasons on market_closed_reference, add brief context.
                    skip_msg += f"\n   post_type: {post_type}, force_summary_due={decision.force_summary_due}"
                print(skip_msg)
                finish_run(
                    RunResult(
                        outcome="SKIPPED_TWEET_GUARD",
                        status="skip",
                        skip_reason=decision.skip_reason,
                        post_type=post_type,
                        template_used=template_used,
                        price_usd_oz=data['price'],
                        tweet_length=tweet_length,
                        content_hash=decision.tweet_hash[:12],
                        trigger_source=trigger_source,
                        trigger_nonce=trigger_nonce or "(none)",
                    ),
                    exit_code=0,
                )
        # Log why a same-price market_closed_reference was allowed through.
        if post_type == "market_closed_reference" and decision.price_move_usd is not None and abs(decision.price_move_usd) < 0.01:
            if decision.force_summary_due:
                print(
                    "  [guard] PASS: same-price market_closed_reference allowed because"
                    f" force_summary_due=True (minutes_since_last={decision.minutes_since_last:.1f},"
                    f" FORCE_SUMMARY_AFTER_MINUTES={_force_summary_min})"
                )
            elif _env_truthy('ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST', default=False):
                print(
                    "  [guard] PASS: same-price market_closed_reference allowed because"
                    " allow_same_price_closed_market_repost=True and duplicate/cooldown guards passed."
                )
        if str(os.environ.get('DRY_RUN_TWEET', '')).strip().lower() in ('1', 'true', 'yes'):
            print("DRY_RUN_TWEET=true — would post; skipping actual X call")
            print(f"   would-post hash: {decision.tweet_hash[:12]}")
            finish_run(
                RunResult(
                    outcome="DRY_RUN_READY",
                    status="skip",
                    skip_reason="dry_run",
                    post_type=post_type,
                    template_used=template_used,
                    price_usd_oz=data['price'],
                    tweet_length=tweet_length,
                    content_hash=decision.tweet_hash[:12],
                    trigger_source=trigger_source,
                    trigger_nonce=trigger_nonce or "(none)",
                ),
                exit_code=0,
            )

    # 10c. Dry-run guard (applied unconditionally; also catches the case where
    #      tweet_guard is unavailable and was not imported above).
    if str(os.environ.get('DRY_RUN_TWEET', '')).strip().lower() in ('1', 'true', 'yes'):
        print("DRY_RUN_TWEET=true — would post; skipping actual X call")
        print(f"   would-post hash: {tweet_hash}")
        finish_run(
            RunResult(
                outcome="DRY_RUN_READY",
                status="skip",
                skip_reason="dry_run",
                post_type=post_type,
                template_used=template_used,
                price_usd_oz=data['price'],
                tweet_length=tweet_length,
                content_hash=tweet_hash,
                trigger_source=trigger_source,
                trigger_nonce=trigger_nonce or "(none)",
            ),
            exit_code=0,
        )

    # 11. Post tweet
    try:
        post_result = post_tweet(tweet, post_type=post_type)
    except Exception as exc:
        emit_run_result(
            classify_post_exception(
                exc,
                post_type=post_type,
                template_used=template_used,
                price=data['price'],
                tweet_length=tweet_length,
                trigger_source=trigger_source,
                trigger_nonce=trigger_nonce,
            )
        )
        raise
    if isinstance(post_result, dict) and not post_result.get("posted", False):
        if shortcut_attempt_recorded:
            _restore_text_file(LAST_TWEET_STATE_FILE, shortcut_state_snapshot)
        finish_run(
            RunResult(
                outcome="OPERATOR_ACTION_SPEND_CAP",
                status="operator_action_needed",
                skip_reason=post_result.get("skip_reason"),
                operator_action="increase_x_spend_cap_or_wait_for_reset",
                reset_date=post_result.get('reset_date', 'unknown'),
                post_type=post_type,
                template_used=template_used,
                price_usd_oz=data['price'],
                tweet_length=tweet_length,
                trigger_source=trigger_source,
                trigger_nonce=trigger_nonce or "(none)",
            ),
            exit_code=0,
        )

    # 12. Save state (only reached on successful post)
    _save_last_price(data["price"], content_hash=tweet_hash)
    if tweet_guard is not None:
        try:
            new_state = tweet_guard.update_state_after_post(
                guard_state,  # noqa: F821 — defined when tweet_guard is loaded
                quote=guard_quote,  # noqa: F821
                tweet_text=tweet,
                tweet_id=None,
                reason=f"{trigger_source}_price_moved",
            )
            tweet_guard.save_state(LAST_TWEET_STATE_FILE, new_state)
        except Exception as exc:  # pragma: no cover — best-effort
            print(f"⚠️  Failed to update last_tweet_state.json: {exc}")

    emit_run_result(
        RunResult(
            outcome="POSTED",
            status="posted",
            post_type=post_type,
            template_used=template_used,
            price_usd_oz=data['price'],
            tweet_length=tweet_length,
            content_hash=tweet_hash,
            trigger_source=trigger_source,
            trigger_nonce=trigger_nonce or "(none)",
        )
    )


if __name__ == '__main__':
    main()
