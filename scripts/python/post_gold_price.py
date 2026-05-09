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
from pathlib import Path
from datetime import datetime, timezone, timedelta

# ── Config ────────────────────────────────────────────────────────────────────
AED_RATE = 3.6725  # UAE Dirham is pegged to USD
SITE_URL  = "https://goldtickerlive.com/"
UAE_TZ    = timezone(timedelta(hours=4))
TROY_OZ_GRAMS = 31.1034768
MARKET_OPEN_EVENT_CRON = '3 21 * * 0'
MARKET_CLOSE_EVENT_CRON = '3 21 * * 5'

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

def get_gold_price():
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

    previous_price, previous_posted_at_utc, previous_content_hash = _load_last_price()
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
        "price_gram_18k": g18,
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
    if parsed is None:
        msg = f"WARN: could not parse provider timestamp source_updated_at_gmt={value!r}"
        return ('parse_error', msg)

    now = _now if _now is not None else datetime.now(timezone.utc)
    age = now - parsed
    age_secs = age.total_seconds()
    age_hours = age_secs / 3600
    iso = parsed.strftime('%Y-%m-%dT%H:%M:%SZ')
    h = int(age_secs // 3600)
    m = int((age_secs % 3600) // 60)
    age_str = f"{h}:{m:02d}"

    if age_hours <= 4:
        return ('ok', None)
    if age_hours <= 12:
        msg = f"WARN: UPSTREAM STALE: {source_label} is {age_str} old (last: {iso})"
        return ('warn', msg)
    msg = f"ERROR: UPSTREAM SEVERELY STALE: {source_label} is {age_str} old (last: {iso})"
    return ('skip', msg)


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

    reason = (
        f"SKIP: price-change guard — {post_type} price ${price:,.2f}"
        f" unchanged{age_note}"
    )
    return (True, reason)


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
    return price, g24, g22, g21, g18, chp

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
    """Return the "Prev: $X,XXX.XX at H:MM AM/PM\\n\\n" line, or "" if unavailable."""
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
    return f'Prev: ${prev_price:,.2f} at {uae_time_str}\n\n'

def _trend_emoji(chp):
    if chp is None: return '📊'
    if chp > 0:     return '📈'
    if chp < 0:     return '📉'
    return '➡️'

def _uae_datetime():
    now = datetime.now(UAE_TZ)
    date_str = now.strftime('%b %-d, %Y')
    time_str = now.strftime('%I:%M %p').lstrip('0')
    return date_str, time_str


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
    # hour as an event to avoid repeated event tweets on a 6-minute cadence.
    if weekday == 6 and hour == 21 and minute < 6:
        return 'market_open'
    if weekday == 4 and hour == 21 and minute < 6:
        return 'market_close'
    return 'hourly'


# ── Tweet templates ───────────────────────────────────────────────────────────
def format_hourly_tweet(data):
    price, g24, g22, g21, g18, chp = _parse_fields(data)
    prev_price = data.get('prev_price')
    prev_posted_at_utc = data.get('prev_posted_at_utc')
    date_str, time_str = _uae_datetime()
    if prev_price is None:
        spot_line = f"24K · ${price:,.2f}/oz"
    else:
        spot_line = f"24K · ${price:,.2f}/oz {_trend_emoji(chp)}{_delta_str(price, prev_price)}"
    tweet = (
        f"📍 Gold Price Update {_trend_emoji(chp)} - {date_str}\n"
        f"\n"
        f"🕐 {time_str} (UAE · GMT+4)\n"
        f"\n"
        f"Spot XAU/USD\n"
        f"{spot_line}\n"
        f"{_prev_line(prev_price, prev_posted_at_utc)}"
        f"\n"
        f"🇦🇪 Prices:\n"
        f"24K  {_aed(g24)} AED/g\n"
        f"22K  {_aed(g22)} AED/g\n"
        f"21K  {_aed(g21)} AED/g\n"
        f"18K  {_aed(g18)} AED/g\n"
        f"\n"
        f"{_trend_emoji(chp)} goldtickerlive.com\n"
        f"Spot rate · Not retail price\n"
        f"\n"
        f"#GoldPrice #Gold #UAE #Dubai"
    )
    return tweet

def format_market_open_tweet(data):
    price, g24, g22, g21, g18, chp = _parse_fields(data)
    return (
        f"🟢 Gold Market Is Now Open\n"
        f"🕐 Monday · 1:00 AM (UAE · GMT+4)\n"
        f"\n"
        f"Opening Spot XAU/USD\n"
        f"24K · ${price:,.2f}/oz{_change_str(chp)}\n"
        f"\n"
        f"🇦🇪 Prices:\n"
        f"24K  {_aed(g24)} AED/g\n"
        f"22K  {_aed(g22)} AED/g\n"
        f"21K  {_aed(g21)} AED/g\n"
        f"18K  {_aed(g18)} AED/g\n"
        f"\n"
        f"New week. Track live prices 👇\n"
        f"📲: goldtickerlive.com\n"
        f"\n"
        f"#GoldPrice #Gold #XAU #UAE #Dubai"
    )

def format_market_close_tweet(data):
    price, g24, g22, g21, g18, chp = _parse_fields(data)
    return (
        f"🔴 Gold Market Is Now Closed\n"
        f"🕐 Saturday · 1:00 AM (UAE · GMT+4)\n"
        f"\n"
        f"Closing Spot XAU/USD\n"
        f"24K · ${price:,.2f}/oz{_change_str(chp)}\n"
        f"\n"
        f"🇦🇪 Prices:\n"
        f"24K  {_aed(g24)} AED/g\n"
        f"22K  {_aed(g22)} AED/g\n"
        f"21K  {_aed(g21)} AED/g\n"
        f"18K  {_aed(g18)} AED/g\n"
        f"\n"
        f"Reopens Monday 1:00 AM 🌙\n"
        f"🖥️: goldtickerlive.com\n"
        f"\n"
        f"#GoldPrice #Gold #XAU #UAE #Dubai"
    )

def format_tweet(data, post_type):
    print(f"   Post type: {post_type}")
    if post_type == 'market_open':
        return format_market_open_tweet(data)
    if post_type == 'market_close':
        return format_market_close_tweet(data)
    return format_hourly_tweet(data)


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
    except tweepy.errors.Forbidden as exc:
        _log_tweet_error(exc, text, post_type)
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
        sys.exit(0)  # Exit 0 so the workflow doesn't report as failed

    # 2. Load raw gold price data
    if not GOLD_PRICE_FILE.exists():
        print(f"⚠️  {GOLD_PRICE_FILE} not found."
              " The gold-price-fetch.yml workflow must run first to populate it.")
        sys.exit(0)
    raw_data = json.loads(GOLD_PRICE_FILE.read_text(encoding="utf-8"))
    source_ts = _provider_timestamp_iso(raw_data) or (
        raw_data.get("source_updated_at_gmt", "n/a") if isinstance(raw_data, dict) else "n/a"
    )

    # 3. Compute post type from the intended cron schedule when available.
    # GitHub scheduled workflows can start late, so using github.event.schedule
    # prevents repeated event tweets during the whole delayed start hour.
    schedule_cron = os.environ.get('GITHUB_EVENT_SCHEDULE', '').strip() or None
    trigger_source = os.environ.get('POST_TRIGGER_SOURCE', '').strip() or (
        'scheduled' if schedule_cron else 'manual'
    )
    post_type = get_post_type(schedule_cron=schedule_cron)

    # 4. Print RUN CONTEXT block
    sha = os.environ.get('GITHUB_SHA', '')
    print("=== RUN CONTEXT ===")
    print(f"event:        {os.environ.get('GITHUB_EVENT_NAME', 'local')}")
    print(f"sha:          {sha[:7] if sha else 'local'}")
    print(f"actor:        {os.environ.get('GITHUB_ACTOR', 'local')}")
    print(f"schedule:     {schedule_cron or 'manual/local'}")
    print(f"source:       {trigger_source}")
    print(f"dry_run:      {os.environ.get('DRY_RUN_TWEET', 'false')}")
    print(f"force_post:   {os.environ.get('FORCE_POST', 'false')}")
    print(f"post_type:    {post_type}")
    print("data_file:    data/gold_price.json")
    print(f"source_ts:    {source_ts}")
    print("===================")

    # 5. Staleness check
    staleness_action, staleness_msg = check_staleness(raw_data)
    if staleness_msg:
        print(staleness_msg)
    if staleness_action == 'skip':
        sys.exit(0)

    # 6. Load gold price (includes previous-state fields)
    print("📡 Reading gold price from data/gold_price.json (canonical price payload)…")
    data = get_gold_price()
    print(f"   Spot: ${data['price']:,.2f}/oz")
    if data.get('prev_price') is not None:
        print(f"   Previous post: ${data['prev_price']:,.2f}/oz at {data.get('prev_posted_at_utc') or 'n/a'}")
    else:
        print("   Previous post: none")

    # 7. 24/5 market-hours guard for regular price posts
    skip, reason = should_skip_market_closed(
        post_type,
        event_name=os.environ.get('GITHUB_EVENT_NAME'),
        trigger_source=trigger_source,
    )
    if reason:
        print(reason)
    if skip:
        sys.exit(0)

    # 8. Price-change guard
    skip, reason = check_duplicate_guard(
        data['price'],
        data['prev_price'],
        data['prev_posted_at_utc'],
        post_type,
    )
    if skip:
        print(reason)
        sys.exit(0)

    # 9. Format tweet
    tweet = format_tweet(data, post_type)
    print("📝 Generated tweet:")
    print(tweet)
    print(f"   ({len(tweet)} characters)")

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
        sys.exit(0)

    # 10b. New X duplicate-prevention guard (additive). Skips on:
    #      • provider timestamp unchanged (GoldPriceZ freezing case)
    #      • exact tweet-text hash match
    #      • sub-threshold price movement when no force-summary window is due
    #      • fallback/cache source with same price+timestamp
    # Controlled by SKIP_DUPLICATE_TWEETS (default true). Set false to bypass.
    if tweet_guard is not None:
        guard_quote = {
            "xau_usd_per_oz": data['price'],
            "timestamp_utc": _provider_timestamp_iso(raw_data),
            "is_fresh": staleness_action == 'ok',
            "is_fallback": False,
            "provider": (
                (raw_data.get("provider") if isinstance(raw_data, dict) else None)
                or (raw_data.get("source") if isinstance(raw_data, dict) else None)
                or "goldpricez"
            ),
            "source_type": (
                raw_data.get("source_type") if isinstance(raw_data, dict) else None
            ) or "spot_reference",
        }
        guard_state = tweet_guard.load_state(LAST_TWEET_STATE_FILE)
        decision = tweet_guard.decide(guard_state, quote=guard_quote, tweet_text=tweet)
        if not decision.should_post:
            print(
                f"SKIP: tweet-guard — {decision.skip_reason}"
                f" (hash={decision.tweet_hash[:12]}, move=${decision.price_move_usd or 0:.2f},"
                f" ts_changed={decision.provider_timestamp_changed})"
            )
            sys.exit(0)
        if str(os.environ.get('DRY_RUN_TWEET', '')).strip().lower() in ('1', 'true', 'yes'):
            print("DRY_RUN_TWEET=true — would post; skipping actual X call")
            print(f"   would-post hash: {decision.tweet_hash[:12]}")
            sys.exit(0)

    # 11. Post tweet
    post_tweet(tweet, post_type=post_type)

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


if __name__ == '__main__':
    main()
