"""Tests for scripts/python/post_gold_price.py hourly tweet formatting."""
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

# Make scripts/python importable (matches repo convention for Python entrypoints)
_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT / "scripts" / "python"))

import post_gold_price as pg  # noqa: E402


# ── _delta_str ────────────────────────────────────────────────────────────────
def test_delta_str_positive():
    assert pg._delta_str(100.00, 99.50) == " +$0.50 (+0.50%)"


def test_delta_str_negative():
    assert pg._delta_str(99.50, 100.00) == " -$0.50 (-0.50%)"


def test_delta_str_flat():
    assert pg._delta_str(100.00, 100.00) == " ±$0.00 (0.00%)"


def test_delta_str_no_previous():
    assert pg._delta_str(100.00, None) == ""


# ── _prev_line ────────────────────────────────────────────────────────────────
def test_prev_line_present():
    # 2026-04-24T10:00:00Z → UAE (GMT+4) = 14:00 = "2:00 PM"
    line = pg._prev_line(4669.34, "2026-04-24T10:00:00Z")
    assert "Prev: $4,669.34 at" in line
    assert "2:00 PM" in line


def test_prev_line_missing_timestamp():
    assert pg._prev_line(4669.34, None) == ""


def test_prev_line_missing_price():
    assert pg._prev_line(None, "2026-04-24T10:00:00Z") == ""


# ── state file I/O ────────────────────────────────────────────────────────────
def test_save_last_price_writes_both_fields(tmp_path, monkeypatch):
    state_file = tmp_path / "last_gold_price.json"
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    pg._save_last_price(4681.84)
    payload = json.loads(state_file.read_text())
    assert payload["price"] == 4681.84
    assert "posted_at_utc" in payload
    assert re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$", payload["posted_at_utc"])


def test_load_last_price_old_schema(tmp_path, monkeypatch):
    state_file = tmp_path / "last_gold_price.json"
    state_file.write_text(json.dumps({"price": 100.0}))
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    price, posted_at_utc, content_hash = pg._load_last_price()
    assert price == 100.0
    assert posted_at_utc is None
    assert content_hash is None


def test_load_last_price_corrupt(tmp_path, monkeypatch, capsys):
    state_file = tmp_path / "last_gold_price.json"
    state_file.write_text("{{{")
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    # Must not raise.
    price, posted_at_utc, content_hash = pg._load_last_price()
    assert price is None
    assert posted_at_utc is None
    assert content_hash is None


# ── format_hourly_tweet ───────────────────────────────────────────────────────
def _sample_data(prev_price=None, prev_posted_at_utc=None, chp=None):
    return {
        "price": 4681.84,
        "price_gram_24k": 150.38,
        "price_gram_22k": 137.85,
        "price_gram_21k": 131.58,
        "price_gram_18k": 112.78,
        "chp": chp,
        "prev_price": prev_price,
        "prev_posted_at_utc": prev_posted_at_utc,
    }


def test_hourly_tweet_reasonable_length_and_content():
    # With 7 karats, the tweet is longer than the legacy 280-char limit but
    # well within X Premium's 25,000-char limit. Detect runaway growth at 1000.
    data = _sample_data(
        prev_price=4669.34,
        prev_posted_at_utc="2026-04-24T10:00:00Z",
        chp=0.2677,
    )
    tweet = pg.format_hourly_tweet(data)
    assert len(tweet) < 1000, f"Tweet is {len(tweet)} chars — runaway growth detected"
    assert len(tweet) > 100, "Tweet is unexpectedly short"
    # Must include all 7 karats
    for karat in ("24K", "22K", "21K", "20K", "18K", "16K", "14K"):
        assert karat in tweet, f"Missing karat {karat} from tweet"
    # Lead emoji must be the trend emoji (not the static pin emoji)
    assert "📈" in tweet
    assert "📍" not in tweet


def test_hourly_tweet_first_run_omits_prev_and_delta():
    data = _sample_data(prev_price=None, prev_posted_at_utc=None, chp=None)
    tweet = pg.format_hourly_tweet(data)
    assert "📊" in tweet
    assert "Prev:" not in tweet
    assert "(+" not in tweet
    assert "(-" not in tweet


# ── _spike_headline ──────────────────────────────────────────────────────────
def test_spike_headline_below_threshold_returns_none():
    assert pg._spike_headline(1.0, "May 11 2026") is None
    assert pg._spike_headline(-1.0, "May 11 2026") is None
    assert pg._spike_headline(0.0, "May 11 2026") is None
    assert pg._spike_headline(None, "May 11 2026") is None


def test_spike_headline_positive_large_move():
    h = pg._spike_headline(2.3, "May 11 2026")
    assert h is not None
    assert "2.3" in h
    assert "GOLD" in h
    assert "+" in h


def test_spike_headline_positive_huge_move():
    h = pg._spike_headline(3.5, "May 11 2026")
    assert h is not None
    assert "3.5" in h
    assert "GOLD" in h
    assert "SPIKE" in h.upper() or "SURGE" in h.upper() or "RALLY" in h.upper() or "SOAR" in h.upper()


def test_spike_headline_negative_large_move():
    h = pg._spike_headline(-1.8, "May 11 2026")
    assert h is not None
    assert "1.8" in h
    assert "GOLD" in h


def test_spike_headline_negative_huge_move():
    h = pg._spike_headline(-3.5, "May 11 2026")
    assert h is not None
    assert "3.5" in h
    assert "GOLD" in h


def test_hourly_tweet_spike_headline_replaces_normal_header():
    """When |chp| >= SPIKE_THRESHOLD_PCT, the spike headline replaces the normal header."""
    data = _sample_data(prev_price=4588.84, prev_posted_at_utc="2026-04-24T10:00:00Z", chp=2.0)
    tweet = pg.format_hourly_tweet(data)
    assert "📍" not in tweet          # Static pin emoji must never appear
    # Spike headline must be the first non-blank line
    first_line = [l for l in tweet.splitlines() if l][0]
    assert "GOLD" in first_line.upper()
    assert "2.0" in first_line
    # The trend emoji (📈) must still appear in the spot line (prev_price is set)
    assert "📈" in tweet


def test_hourly_tweet_prev_line_directly_under_spot():
    """Previous price line must appear directly after the spot price line."""
    data = _sample_data(prev_price=4669.34, prev_posted_at_utc="2026-04-24T10:00:00Z", chp=0.27)
    tweet = pg.format_hourly_tweet(data)
    lines = tweet.splitlines()
    spot_idx = next(i for i, l in enumerate(lines) if "$4,681.84/oz" in l)
    prev_idx = next(i for i, l in enumerate(lines) if "Prev:" in l)
    # Prev line must immediately follow the spot line (no blank between them)
    assert prev_idx == spot_idx + 1, "Prev line is not directly under the spot price line"


# ── _load_last_price 3-tuple ──────────────────────────────────────────────────
def test_load_last_price_returns_three_tuple(tmp_path, monkeypatch):
    state_file = tmp_path / "last_gold_price.json"
    state_file.write_text(json.dumps({"price": 100.0}))
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    result = pg._load_last_price()
    assert len(result) == 3
    assert result[0] == 100.0
    assert result[1] is None
    assert result[2] is None


# ── Duplicate guard tests ─────────────────────────────────────────────────────
_NOW = datetime(2026, 4, 24, 13, 0, 0, tzinfo=timezone.utc)
_30_MIN_AGO = (_NOW - timedelta(minutes=30)).strftime('%Y-%m-%dT%H:%M:%SZ')
_70_MIN_AGO = (_NOW - timedelta(minutes=70)).strftime('%Y-%m-%dT%H:%M:%SZ')


def test_duplicate_guard_same_price_recent_hourly():
    skip, reason = pg.check_duplicate_guard(
        price=4701.73,
        prev_price=4701.73,
        prev_posted_at_utc=_30_MIN_AGO,
        post_type='hourly',
        _now=_NOW,
    )
    assert skip is True
    assert "4,701.73" in reason
    assert "SKIP: price-change guard" in reason


def test_duplicate_guard_same_price_old_hourly_still_skips():
    skip, reason = pg.check_duplicate_guard(
        price=4701.73,
        prev_price=4701.73,
        prev_posted_at_utc=_70_MIN_AGO,
        post_type='hourly',
        _now=_NOW,
    )
    assert skip is True
    assert "unchanged" in reason


def test_duplicate_guard_price_changed_recent_hourly():
    skip, _ = pg.check_duplicate_guard(
        price=4701.75,
        prev_price=4701.73,
        prev_posted_at_utc=_30_MIN_AGO,
        post_type='hourly',
        _now=_NOW,
    )
    assert skip is False


def test_duplicate_guard_market_open_same_price_skips():
    skip, reason = pg.check_duplicate_guard(
        price=4701.73,
        prev_price=4701.73,
        prev_posted_at_utc=_30_MIN_AGO,
        post_type='market_open',
        _now=_NOW,
    )
    assert skip is True
    assert "market_open" in reason


def test_duplicate_guard_market_close_same_price_skips():
    skip, reason = pg.check_duplicate_guard(
        price=4701.73,
        prev_price=4701.73,
        prev_posted_at_utc=_30_MIN_AGO,
        post_type='market_close',
        _now=_NOW,
    )
    assert skip is True
    assert "market_close" in reason


def test_duplicate_guard_market_closed_reference_same_price_skips_with_detailed_log(monkeypatch):
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "shortcut")
    monkeypatch.setenv("POST_TRIGGER_NONCE", "test-nonce-001")
    monkeypatch.setenv("REFRESH_PRICE_FIRST", "false")
    skip, reason = pg.check_duplicate_guard(
        price=4724.10,
        prev_price=4724.10,
        prev_posted_at_utc=_30_MIN_AGO,
        post_type='market_closed_reference',
        _now=_NOW,
    )
    assert skip is True
    # Detailed log fields must be present
    assert "market_closed_reference" in reason
    assert "same closing/reference price already posted" in reason
    assert "$4,724.10" in reason
    assert "previous_price" in reason
    assert "current_price" in reason
    assert "minutes_since_post" in reason
    assert "source" in reason
    assert "shortcut" in reason
    assert "trigger_nonce" in reason
    assert "test-nonce-001" in reason
    assert "refresh_price_first" in reason
    assert "allow_same_price_closed_market_repost" in reason


def test_is_allow_same_price_closed_market_repost_false_by_default(monkeypatch):
    monkeypatch.delenv("ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST", raising=False)
    assert pg.is_allow_same_price_closed_market_repost(
        event_name='workflow_dispatch', trigger_source='manual'
    ) is False


def test_is_allow_same_price_closed_market_repost_true_for_manual(monkeypatch):
    monkeypatch.setenv("ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST", "true")
    assert pg.is_allow_same_price_closed_market_repost(
        event_name='workflow_dispatch', trigger_source='manual'
    ) is True


def test_is_allow_same_price_closed_market_repost_true_for_shortcut(monkeypatch):
    monkeypatch.setenv("ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST", "true")
    assert pg.is_allow_same_price_closed_market_repost(
        event_name='workflow_dispatch', trigger_source='shortcut'
    ) is True


def test_is_allow_same_price_closed_market_repost_false_for_scheduled(monkeypatch):
    monkeypatch.setenv("ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST", "true")
    # Scheduled runs have no workflow_dispatch event
    assert pg.is_allow_same_price_closed_market_repost(
        event_name='schedule', trigger_source='scheduled'
    ) is False


def test_is_allow_same_price_closed_market_repost_false_for_non_operator_dispatch(monkeypatch):
    monkeypatch.setenv("ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST", "true")
    # workflow_dispatch but source is not manual/shortcut
    assert pg.is_allow_same_price_closed_market_repost(
        event_name='workflow_dispatch', trigger_source='scheduled'
    ) is False


def test_duplicate_guard_no_previous_state():
    skip, _ = pg.check_duplicate_guard(
        price=4701.73,
        prev_price=None,
        prev_posted_at_utc=None,
        post_type='hourly',
        _now=_NOW,
    )
    assert skip is False


# ── 24/5 market cadence tests ─────────────────────────────────────────────────
def test_get_post_type_uses_intended_schedule_for_delayed_market_close():
    delayed = datetime(2026, 4, 24, 21, 52, 0, tzinfo=timezone.utc)
    assert pg.get_post_type(
        _now=delayed,
        schedule_cron=pg.MARKET_CLOSE_EVENT_CRON,
    ) == 'market_close'


def test_get_post_type_does_not_repeat_market_close_after_first_window():
    delayed = datetime(2026, 4, 24, 21, 52, 0, tzinfo=timezone.utc)
    assert pg.get_post_type(_now=delayed) == 'hourly'


def test_get_post_type_manual_event_window_is_narrow():
    event_time = datetime(2026, 4, 24, 21, 5, 0, tzinfo=timezone.utc)
    after_window = datetime(2026, 4, 24, 21, 6, 0, tzinfo=timezone.utc)
    assert pg.get_post_type(_now=event_time) == 'market_close'
    assert pg.get_post_type(_now=after_window) == 'hourly'


def test_market_open_time_covers_24_5_window():
    assert pg.is_market_open_time(datetime(2026, 4, 26, 20, 59, 0, tzinfo=timezone.utc)) is False
    assert pg.is_market_open_time(datetime(2026, 4, 26, 21, 0, 0, tzinfo=timezone.utc)) is True
    assert pg.is_market_open_time(datetime(2026, 4, 29, 12, 0, 0, tzinfo=timezone.utc)) is True
    assert pg.is_market_open_time(datetime(2026, 5, 1, 20, 59, 0, tzinfo=timezone.utc)) is True
    assert pg.is_market_open_time(datetime(2026, 5, 1, 21, 0, 0, tzinfo=timezone.utc)) is False
    assert pg.is_market_open_time(datetime(2026, 5, 2, 12, 0, 0, tzinfo=timezone.utc)) is False


def test_market_closed_guard_skips_scheduled_runs():
    saturday = datetime(2026, 5, 2, 12, 0, 0, tzinfo=timezone.utc)
    skip, reason = pg.should_skip_market_closed(
        'hourly',
        now=saturday,
        event_name='schedule',
        trigger_source='scheduled',
    )
    assert skip is True
    assert "market closed" in reason
    assert "regular hourly price posts" in reason
    assert pg.should_skip_market_closed('market_close', now=saturday) == (False, None)


def test_market_closed_guard_bypasses_workflow_dispatch_shortcut_runs():
    saturday = datetime(2026, 5, 2, 12, 0, 0, tzinfo=timezone.utc)
    skip, reason = pg.should_skip_market_closed(
        'hourly',
        now=saturday,
        event_name='workflow_dispatch',
        trigger_source='shortcut',
    )
    assert skip is False
    assert reason == "Manual workflow_dispatch trigger; market-hours guard bypassed for operator-triggered run."


def test_select_post_type_uses_closed_market_reference_for_operator_run():
    assert pg.select_post_type('hourly', market_open=False, operator_trigger=True) == 'market_closed_reference'
    assert pg.select_post_type('hourly', market_open=True, operator_trigger=True) == 'hourly'
    assert pg.select_post_type('market_open', market_open=False, operator_trigger=True) == 'market_open'


def test_closed_market_stale_reference_allowed_within_max_hours(monkeypatch):
    monkeypatch.setenv("CLOSED_MARKET_MAX_STALE_HOURS", "48")
    details = pg.get_staleness_details({"timestamp_utc": "2026-05-01T12:00:00Z"}, _now=datetime(2026, 5, 2, 12, 0, 0, tzinfo=timezone.utc))
    assert pg.should_allow_closed_market_stale_reference(
        post_type='market_closed_reference',
        market_open=False,
        operator_trigger=True,
        staleness_details=details,
        price=4700.0,
    ) is True


def test_closed_market_stale_reference_allows_exact_max_hour_boundary(monkeypatch):
    monkeypatch.setenv("CLOSED_MARKET_MAX_STALE_HOURS", "48")
    details = pg.get_staleness_details({"timestamp_utc": "2026-04-30T12:00:00Z"}, _now=datetime(2026, 5, 2, 12, 0, 0, tzinfo=timezone.utc))
    assert pg.should_allow_closed_market_stale_reference(
        post_type='market_closed_reference',
        market_open=False,
        operator_trigger=True,
        staleness_details=details,
        price=4700.0,
    ) is True


def test_closed_market_stale_reference_rejects_old_or_missing_timestamp(monkeypatch):
    monkeypatch.setenv("CLOSED_MARKET_MAX_STALE_HOURS", "48")
    old_details = pg.get_staleness_details({"timestamp_utc": "2026-04-29T11:00:00Z"}, _now=datetime(2026, 5, 2, 12, 0, 0, tzinfo=timezone.utc))
    missing_details = pg.get_staleness_details({}, _now=_NOW)
    assert pg.should_allow_closed_market_stale_reference(
        post_type='market_closed_reference',
        market_open=False,
        operator_trigger=True,
        staleness_details=old_details,
        price=4700.0,
    ) is False
    assert pg.should_allow_closed_market_stale_reference(
        post_type='market_closed_reference',
        market_open=False,
        operator_trigger=True,
        staleness_details=missing_details,
        price=4700.0,
    ) is False


# ── Content-hash tests ────────────────────────────────────────────────────────
def test_content_hash_computed_stable():
    h1 = pg.compute_content_hash("hello world")
    h2 = pg.compute_content_hash("hello world")
    assert h1 == h2
    assert len(h1) == 12
    assert h1 != pg.compute_content_hash("different text")


def test_content_hash_stored_on_save(tmp_path, monkeypatch):
    state_file = tmp_path / "last_gold_price.json"
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    pg._save_last_price(4701.73, content_hash="abc123def456")
    payload = json.loads(state_file.read_text())
    assert payload["content_hash"] == "abc123def456"


def test_content_hash_missing_in_old_state(tmp_path, monkeypatch):
    state_file = tmp_path / "last_gold_price.json"
    state_file.write_text(json.dumps({"price": 4701.73, "posted_at_utc": "2026-04-24T12:00:00Z"}))
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    price, posted_at_utc, content_hash = pg._load_last_price()
    assert price == 4701.73
    assert posted_at_utc == "2026-04-24T12:00:00Z"
    assert content_hash is None  # graceful, no crash


# ── gold_price.json schema compatibility ───────────────────────────────────────
def test_get_gold_price_supports_legacy_schema(tmp_path, monkeypatch):
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    gold_file.write_text(
        json.dumps(
            {
                "fetched_at_utc": "2026-05-07T12:00:00Z",
                "gold": {"ounce_usd": 4736.36, "gram_aed": 558.40},
            }
        )
    )
    state_file.write_text(json.dumps({"price": 4700.0}))
    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)

    data = pg.get_gold_price()
    assert data["price"] == 4736.36
    assert data["prev_price"] == 4700.0
    assert data["price_gram_24k"] > 0


def test_get_gold_price_supports_normalized_schema(tmp_path, monkeypatch):
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4731.2,
                "timestamp_utc": "2026-05-07T10:34:52Z",
                "fetched_at_utc": "2026-05-07T10:35:03Z",
                "aed_per_gram_24k": 558.4,
                "karats_aed_per_gram": {
                    "24k": 558.4,
                    "22k": 511.87,
                    "21k": 488.6,
                    "18k": 418.8,
                },
            }
        )
    )
    state_file.write_text(json.dumps({"price": 4725.0}))
    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)

    data = pg.get_gold_price()
    assert data["price"] == 4731.2
    assert data["prev_price"] == 4725.0
    assert data["price_gram_24k"] > 0


# ── Staleness tests ───────────────────────────────────────────────────────────
def _staleness_ts(hours_ago, now=None):
    """Return source_updated_at_gmt string for `hours_ago` hours before `now`."""
    if now is None:
        now = _NOW
    ts = now - timedelta(hours=hours_ago)
    # Format matches goldpricez: "DD-MM-YYYY HH:MM:SS am/pm"
    return ts.strftime("%d-%m-%Y %I:%M:%S %p").lower()


def test_staleness_fresh():
    raw = {"source_updated_at_gmt": _staleness_ts(0.5)}
    action, msg = pg.check_staleness(raw, _now=_NOW)
    assert action == 'ok'
    assert msg is None


def test_staleness_warn_zone(capsys):
    raw = {"source_updated_at_gmt": _staleness_ts(6)}
    action, msg = pg.check_staleness(raw, _now=_NOW)
    assert action == 'warn'
    assert msg is not None
    assert "WARN: UPSTREAM STALE" in msg
    assert "6:00" in msg or "6:" in msg


def test_staleness_severe():
    raw = {"source_updated_at_gmt": _staleness_ts(24)}
    action, msg = pg.check_staleness(raw, _now=_NOW)
    assert action == 'skip'
    assert msg is not None
    assert "ERROR: UPSTREAM SEVERELY STALE" in msg


def test_staleness_unparseable():
    raw = {"source_updated_at_gmt": "not-a-date"}
    action, msg = pg.check_staleness(raw, _now=_NOW)
    assert action == 'parse_error'
    assert msg is not None
    assert "WARN: could not parse" in msg
    assert "not-a-date" in msg


def test_staleness_missing_field():
    raw = {}  # no source_updated_at_gmt key
    action, msg = pg.check_staleness(raw, _now=_NOW)
    assert action == 'parse_error'
    assert msg is not None
    assert "WARN: could not parse" in msg


def test_staleness_supports_normalized_timestamp_utc():
    raw = {"timestamp_utc": (_NOW - timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%SZ')}
    action, msg = pg.check_staleness(raw, _now=_NOW)
    assert action == 'ok'
    assert msg is None


def test_market_closed_reference_template_uses_closing_wording():
    tweet = pg.format_market_closed_reference_tweet(
        {
            **_sample_data(prev_price=4669.34, prev_posted_at_utc="2026-04-24T10:00:00Z", chp=0.2677),
            "source_updated_at_utc": "2026-05-08T20:06:54Z",
            "stale_age_hours": 9.6,
        }
    )
    assert "🔴 Gold Market Closed" in tweet
    assert "Spot ref XAU/USD" in tweet
    assert "Updated " in tweet
    assert "Spot ref · Not retail" in tweet
    # Stale age must NOT appear in the public tweet body
    assert "Cached reference" not in tweet
    assert "9.6h old" not in tweet
    # Must include AED karat prices
    assert "🇦🇪 AED/g" in tweet
    # Must include reopens line
    assert "Reopens Mon" in tweet
    # Must include site URL
    # The URL is the penultimate visible line; the last visible line is the hashtag block.
    visible_lines = [line for line in tweet.splitlines() if line]
    assert visible_lines[-2] == "goldtickerlive.com"


def test_build_guard_quote_marks_closed_market_reference_as_fresh():
    raw = {
        "provider": "gold_api_com",
        "timestamp_utc": "2026-05-08T20:06:54Z",
        "source_type": "spot_reference",
    }
    data = _sample_data()
    quote = pg.build_guard_quote(
        raw,
        data,
        staleness_action='skip',
        post_type='market_closed_reference',
        closed_market_stale_allowed=True,
    )
    assert quote["is_fresh"] is True
    assert quote["source_type"] == "market_closed_reference"


def test_build_guard_quote_keeps_market_open_stale_blocking():
    raw = {
        "provider": "gold_api_com",
        "timestamp_utc": "2026-05-08T20:06:54Z",
        "source_type": "spot_reference",
    }
    data = _sample_data()
    quote = pg.build_guard_quote(
        raw,
        data,
        staleness_action='warn',
        post_type='hourly',
        closed_market_stale_allowed=False,
    )
    assert quote["is_fresh"] is False
    assert quote["source_type"] == "spot_reference"


# ── Error-logging tests ───────────────────────────────────────────────────────
def test_tweet_403_logs_response_body(capsys, monkeypatch):
    import tweepy

    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.text = '{"detail":"This request looks automated"}'
    mock_response.headers = {}

    exc = tweepy.errors.Forbidden(response=mock_response)

    mock_client = MagicMock()
    mock_client.create_tweet.side_effect = exc

    with patch('tweepy.Client', return_value=mock_client):
        try:
            pg.post_tweet("test tweet text", post_type='hourly')
        except tweepy.errors.Forbidden:
            pass
        else:
            raise AssertionError("Expected Forbidden to be re-raised")

    out = capsys.readouterr().out
    assert '{"detail":"This request looks automated"}' in out
    assert "Likely cause: duplicate" in out
    assert "=== TWEET ERROR ===" in out


def test_tweet_403_spend_cap_returns_skip_payload(capsys):
    import tweepy

    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.text = json.dumps(
        {
            "title": "SpendCapReached",
            "detail": "Your enrolled account has reached its billing cycle spend cap.",
            "reset_date": "2026-05-13",
            "type": "https://api.twitter.com/2/problems/credits",
        }
    )
    mock_response.headers = {}

    exc = tweepy.errors.Forbidden(response=mock_response)

    mock_client = MagicMock()
    mock_client.create_tweet.side_effect = exc

    with patch('tweepy.Client', return_value=mock_client):
        result = pg.post_tweet("test tweet text", post_type='market_closed_reference')

    out = capsys.readouterr().out
    assert result == {
        "posted": False,
        "skip_reason": "spend_cap_reached",
        "reset_date": "2026-05-13",
    }
    assert "SKIP: X API spend cap reached" in out
    assert "Billing cycle reset date: 2026-05-13" in out
    assert "=== TWEET ERROR ===" in out


def test_tweet_429_logs_retry_after(capsys, monkeypatch):
    import tweepy

    mock_response = MagicMock()
    mock_response.status_code = 429
    mock_response.text = '{"detail":"Too Many Requests"}'
    mock_response.headers = {'Retry-After': '60'}

    exc = tweepy.errors.TooManyRequests(response=mock_response)

    mock_client = MagicMock()
    mock_client.create_tweet.side_effect = exc

    with patch('tweepy.Client', return_value=mock_client):
        try:
            pg.post_tweet("test tweet text", post_type='hourly')
        except tweepy.errors.TooManyRequests:
            pass
        else:
            raise AssertionError("Expected TooManyRequests to be re-raised")

    out = capsys.readouterr().out
    assert "Retry-After: 60s" in out
    assert "=== TWEET ERROR ===" in out


def test_main_dry_run_does_not_post(tmp_path, monkeypatch, capsys):
    fresh_now = datetime.now(timezone.utc)
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4731.2,
                "timestamp_utc": (fresh_now - timedelta(seconds=20)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "fetched_at_utc": fresh_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 558.4,
                "karats_aed_per_gram": {
                    "24k": 558.4,
                    "22k": 511.87,
                    "21k": 488.6,
                    "18k": 418.8,
                },
            }
        )
    )
    state_file.write_text(json.dumps({"price": 4700.0, "posted_at_utc": "2026-05-07T09:00:00Z"}))
    tweet_state_file.write_text(json.dumps({"schema_version": 1}))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(pg, "format_tweet", lambda *_args, **_kwargs: "short dry-run tweet")
    monkeypatch.setattr(pg, "post_tweet", MagicMock())
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: True)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("DRY_RUN_TWEET", "true")
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected main() to exit after dry run")

    pg.post_tweet.assert_not_called()
    assert json.loads(tweet_state_file.read_text()) == {"schema_version": 1}
    out = capsys.readouterr().out
    assert "DRY_RUN_TWEET=true — would post; skipping actual X call" in out


def test_main_writes_structured_result_file_for_dry_run(tmp_path, monkeypatch, capsys):
    fresh_now = datetime.now(timezone.utc)
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    result_file = tmp_path / "post-gold-result.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4731.2,
                "timestamp_utc": (fresh_now - timedelta(seconds=20)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "fetched_at_utc": fresh_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 558.4,
                "karats_aed_per_gram": {
                    "24k": 558.4,
                    "22k": 511.87,
                    "21k": 488.6,
                    "18k": 418.8,
                },
            }
        )
    )
    state_file.write_text(json.dumps({"price": 4700.0, "posted_at_utc": "2026-05-07T09:00:00Z"}))
    tweet_state_file.write_text(json.dumps({"schema_version": 1}))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(pg, "format_tweet", lambda *_args, **_kwargs: "short dry-run tweet")
    monkeypatch.setattr(pg, "post_tweet", MagicMock())
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: True)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("DRY_RUN_TWEET", "true")
    monkeypatch.setenv("POST_GOLD_RESULT_PATH", str(result_file))
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected main() to exit after dry run")

    payload = json.loads(result_file.read_text())
    assert payload["outcome"] == "DRY_RUN_READY"
    assert payload["status"] == "skip"
    assert payload["skip_reason"] == "dry_run"
    assert payload["tweet_length"] == len("short dry-run tweet")


def test_main_workflow_dispatch_shortcut_bypasses_market_hours(tmp_path, monkeypatch, capsys):
    fresh_now = datetime.now(timezone.utc)
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4731.2,
                "timestamp_utc": (fresh_now - timedelta(seconds=20)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "fetched_at_utc": fresh_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 558.4,
                "karats_aed_per_gram": {
                    "24k": 558.4,
                    "22k": 511.87,
                    "21k": 488.6,
                    "18k": 418.8,
                },
            }
        )
    )
    state_file.write_text(json.dumps({"price": 4700.0, "posted_at_utc": "2026-05-07T09:00:00Z"}))
    tweet_state_file.write_text(json.dumps({"schema_version": 1}))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(pg, "format_tweet", lambda *_args, **_kwargs: "shortcut dry-run tweet")
    monkeypatch.setattr(pg, "post_tweet", MagicMock())
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: False)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("DRY_RUN_TWEET", "true")
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "Shortcut")
    monkeypatch.setenv("POST_TRIGGER_NONCE", "ios-shortcut-run-1")
    monkeypatch.setenv("REFRESH_PRICE_FIRST", "false")
    monkeypatch.setenv("GITHUB_RUN_ID", "123456789")
    monkeypatch.setenv("GITHUB_RUN_ATTEMPT", "3")
    monkeypatch.delenv("GITHUB_EVENT_SCHEDULE", raising=False)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected main() to exit after dry run")

    pg.post_tweet.assert_not_called()
    out = capsys.readouterr().out
    assert "Manual workflow_dispatch trigger; market-hours guard bypassed for operator-triggered run." in out
    assert "source:       shortcut" in out
    # Check key RUN CONTEXT fields appear with their values (exact format from the implementation)
    assert "refresh_price_first:" in out
    assert "\nrefresh_price_first:" in out or "refresh_price_first:                    false" in out
    assert "ios-shortcut-run-1" in out
    assert "trigger_nonce:" in out
    assert "123456789" in out
    assert "github.run_id:" in out
    assert "github.run_attempt:" in out
    assert "shortcut_attempt_recorded: false (dry run)" in out
    assert "selected_post_type:        market_closed_reference" in out
    assert "template_used:             market_closed_reference" in out
    assert "DRY_RUN_TWEET=true — would post; skipping actual X call" in out
    assert json.loads(tweet_state_file.read_text()) == {"schema_version": 1}


def test_main_market_closed_shortcut_allows_cached_reference_within_limit(tmp_path, monkeypatch, capsys):
    stale_now = datetime.now(timezone.utc)
    source_ts = (stale_now - timedelta(hours=9, minutes=33)).strftime("%Y-%m-%dT%H:%M:%SZ")
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4731.2,
                "timestamp_utc": source_ts,
                "fetched_at_utc": stale_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 558.4,
                "karats_aed_per_gram": {
                    "24k": 558.4,
                    "22k": 511.87,
                    "21k": 488.6,
                    "18k": 418.8,
                },
            }
        )
    )
    state_file.write_text(json.dumps({"price": 4700.0, "posted_at_utc": "2026-05-07T09:00:00Z"}))
    tweet_state_file.write_text(json.dumps({"schema_version": 1}))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(pg, "post_tweet", MagicMock())
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: False)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("DRY_RUN_TWEET", "true")
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "SHORTCUT")
    monkeypatch.setenv("CLOSED_MARKET_MAX_STALE_HOURS", "48")
    monkeypatch.delenv("GITHUB_EVENT_SCHEDULE", raising=False)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected main() to exit after dry run")

    out = capsys.readouterr().out
    assert "selected_post_type:        market_closed_reference" in out
    assert "closed_market_stale_allowed: True" in out
    assert "🔴 Gold Market Closed" in out
    assert "Spot ref · Not retail" in out
    assert "DRY_RUN_TWEET=true — would post; skipping actual X call" in out


def test_main_shortcut_spam_guard_skips_recent_shortcut_attempt(tmp_path, monkeypatch, capsys):
    fresh_now = datetime.now(timezone.utc)
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4731.2,
                "timestamp_utc": (fresh_now - timedelta(seconds=20)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "fetched_at_utc": fresh_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 558.4,
                "karats_aed_per_gram": {
                    "24k": 558.4,
                    "22k": 511.87,
                    "21k": 488.6,
                    "18k": 418.8,
                },
            }
        )
    )
    state_file.write_text(json.dumps({"price": 4700.0, "posted_at_utc": "2026-05-07T09:00:00Z"}))
    tweet_state_file.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "last_trigger_source": "shortcut",
                "last_trigger_attempt_time_utc": (fresh_now - timedelta(seconds=45)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "last_trigger_nonce": "ios-shortcut-run-1",
                "last_trigger_run_id": "123456789",
            }
        )
    )

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(pg, "format_tweet", MagicMock())
    monkeypatch.setattr(pg, "post_tweet", MagicMock())
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: False)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("DRY_RUN_TWEET", "true")
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "SHORTCUT")
    monkeypatch.delenv("FORCE_POST", raising=False)
    monkeypatch.delenv("GITHUB_EVENT_SCHEDULE", raising=False)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected main() to exit for recent shortcut spam")

    pg.format_tweet.assert_not_called()
    pg.post_tweet.assert_not_called()
    out = capsys.readouterr().out
    assert "SKIP: shortcut anti-spam guard" in out
    assert "ios-shortcut-run-1" in out


def test_main_market_open_stale_data_still_blocks(tmp_path, monkeypatch, capsys):
    stale_now = datetime.now(timezone.utc)
    source_ts = (stale_now - timedelta(hours=9, minutes=33)).strftime("%Y-%m-%dT%H:%M:%SZ")
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4731.2,
                "timestamp_utc": source_ts,
                "fetched_at_utc": stale_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 558.4,
                "karats_aed_per_gram": {
                    "24k": 558.4,
                    "22k": 511.87,
                    "21k": 488.6,
                    "18k": 418.8,
                },
            }
        )
    )
    state_file.write_text(json.dumps({"price": 4700.0, "posted_at_utc": "2026-05-07T09:00:00Z"}))
    tweet_state_file.write_text(json.dumps({"schema_version": 1}))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(pg, "post_tweet", MagicMock())
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: True)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("DRY_RUN_TWEET", "true")
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected main() to exit when stale data is blocked")

    pg.post_tweet.assert_not_called()
    out = capsys.readouterr().out
    assert "selected_post_type:        hourly" in out
    assert "WARN: UPSTREAM STALE" in out
    assert "closed_market_stale_allowed: False" in out
    assert "would post" not in out


def test_main_market_closed_shortcut_blocks_extremely_old_cache(tmp_path, monkeypatch, capsys):
    stale_now = datetime.now(timezone.utc)
    source_ts = (stale_now - timedelta(hours=60)).strftime("%Y-%m-%dT%H:%M:%SZ")
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4731.2,
                "timestamp_utc": source_ts,
                "fetched_at_utc": stale_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 558.4,
                "karats_aed_per_gram": {
                    "24k": 558.4,
                    "22k": 511.87,
                    "21k": 488.6,
                    "18k": 418.8,
                },
            }
        )
    )
    state_file.write_text(json.dumps({"price": 4700.0, "posted_at_utc": "2026-05-07T09:00:00Z"}))
    tweet_state_file.write_text(json.dumps({"schema_version": 1}))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(pg, "post_tweet", MagicMock())
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: False)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("DRY_RUN_TWEET", "true")
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "shortcut")
    monkeypatch.setenv("CLOSED_MARKET_MAX_STALE_HOURS", "48")
    monkeypatch.delenv("GITHUB_EVENT_SCHEDULE", raising=False)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected main() to exit when cache is too old")

    pg.post_tweet.assert_not_called()
    out = capsys.readouterr().out
    assert "selected_post_type:        market_closed_reference" in out
    assert "closed_market_stale_allowed: False" in out
    assert "ERROR: UPSTREAM SEVERELY STALE" in out
    assert "would post" not in out


def test_main_dry_run_over_280_char_post_does_not_call_x(tmp_path, monkeypatch, capsys):
    fresh_now = datetime.now(timezone.utc)
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4731.2,
                "timestamp_utc": (fresh_now - timedelta(seconds=20)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "fetched_at_utc": fresh_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 558.4,
                "karats_aed_per_gram": {
                    "24k": 558.4,
                    "22k": 511.87,
                    "21k": 488.6,
                    "18k": 418.8,
                },
            }
        )
    )
    state_file.write_text(json.dumps({"price": 4700.0, "posted_at_utc": "2026-05-07T09:00:00Z"}))
    tweet_state_file.write_text(json.dumps({"schema_version": 1}))

    over_length_post = "x" * 304

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(pg, "format_tweet", lambda *_args, **_kwargs: over_length_post)
    monkeypatch.setattr(pg, "post_tweet", MagicMock())
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: True)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("DRY_RUN_TWEET", "true")
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected main() to exit after dry run")

    pg.post_tweet.assert_not_called()
    assert json.loads(tweet_state_file.read_text()) == {"schema_version": 1}
    out = capsys.readouterr().out
    assert "📝 Generated tweet:" in out
    assert "304 characters" in out
    assert "tweet-length guard" not in out
    assert "DRY_RUN_TWEET=true — would post; skipping actual X call" in out


def test_main_over_280_char_post_attempts_x_call_when_other_guards_pass(tmp_path, monkeypatch, capsys):
    fresh_now = datetime.now(timezone.utc)
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4731.2,
                "timestamp_utc": (fresh_now - timedelta(seconds=20)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "fetched_at_utc": fresh_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 558.4,
                "karats_aed_per_gram": {
                    "24k": 558.4,
                    "22k": 511.87,
                    "21k": 488.6,
                    "18k": 418.8,
                },
            }
        )
    )
    state_file.write_text(json.dumps({"price": 4700.0, "posted_at_utc": "2026-05-07T09:00:00Z"}))
    tweet_state_file.write_text(json.dumps({"schema_version": 1}))

    over_length_post = "x" * 304
    mock_post = MagicMock()

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(pg, "format_tweet", lambda *_args, **_kwargs: over_length_post)
    monkeypatch.setattr(pg, "post_tweet", mock_post)
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: True)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.delenv("DRY_RUN_TWEET", raising=False)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    pg.main()

    mock_post.assert_called_once_with(over_length_post, post_type='hourly')
    out = capsys.readouterr().out
    assert "📝 Generated tweet:" in out
    assert "304 characters" in out
    assert "tweet-length guard" not in out


def test_main_skips_cleanly_when_x_spend_cap_is_reached(tmp_path, monkeypatch, capsys):
    fresh_now = datetime.now(timezone.utc)
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4715.7,
                "timestamp_utc": (fresh_now - timedelta(seconds=20)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "fetched_at_utc": fresh_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 556.8,
                "karats_aed_per_gram": {
                    "24k": 556.8,
                    "22k": 510.4,
                    "21k": 487.2,
                    "18k": 417.6,
                },
            }
        )
    )
    state_file.write_text(json.dumps({"price": 4700.0, "posted_at_utc": "2026-05-07T09:00:00Z"}))
    tweet_state_file.write_text(json.dumps({"schema_version": 1}))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(
        pg,
        "post_tweet",
        MagicMock(
            return_value={
                "posted": False,
                "skip_reason": "spend_cap_reached",
                "reset_date": "2026-05-13",
            }
        ),
    )
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: True)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected main() to exit cleanly when X spend cap is reached")

    assert json.loads(state_file.read_text()) == {"price": 4700.0, "posted_at_utc": "2026-05-07T09:00:00Z"}
    assert json.loads(tweet_state_file.read_text()) == {"schema_version": 1}
    out = capsys.readouterr().out
    assert "outcome:" in out
    assert "OPERATOR_ACTION_SPEND_CAP" in out
    assert "reset_date:" in out
    assert "2026-05-13" in out


def test_main_shortcut_spend_cap_restores_guard_state(tmp_path, monkeypatch, capsys):
    fresh_now = datetime.now(timezone.utc)
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    result_file = tmp_path / "post-gold-result.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4715.7,
                "timestamp_utc": (fresh_now - timedelta(seconds=20)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "fetched_at_utc": fresh_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 556.8,
                "karats_aed_per_gram": {
                    "24k": 556.8,
                    "22k": 510.4,
                    "21k": 487.2,
                    "18k": 417.6,
                },
            }
        )
    )
    state_file.write_text(json.dumps({"price": 4700.0, "posted_at_utc": "2026-05-07T09:00:00Z"}))
    original_tweet_state = {
        "schema_version": 1,
        "last_trigger_source": "manual",
        "last_trigger_attempt_time_utc": "2026-05-07T09:00:00Z",
    }
    tweet_state_file.write_text(json.dumps(original_tweet_state))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(
        pg,
        "post_tweet",
        MagicMock(
            return_value={
                "posted": False,
                "skip_reason": "spend_cap_reached",
                "reset_date": "2026-05-13",
            }
        ),
    )
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: True)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "shortcut")
    monkeypatch.setenv("POST_TRIGGER_NONCE", "shortcut-001")
    monkeypatch.setenv("POST_GOLD_RESULT_PATH", str(result_file))
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected main() to exit cleanly when X spend cap is reached")

    assert json.loads(tweet_state_file.read_text()) == original_tweet_state
    payload = json.loads(result_file.read_text())
    assert payload["status"] == "operator_action_needed"
    assert payload["outcome"] == "OPERATOR_ACTION_SPEND_CAP"
    out = capsys.readouterr().out
    assert "shortcut_attempt_recorded: true" in out
    assert "increase_x_spend_cap_or_wait_for_reset" in out


# ── allow_same_price_closed_market_repost tests ─────────────────────────────

def test_main_allow_same_price_closed_market_repost_bypasses_price_guard(
    tmp_path, monkeypatch, capsys
):
    """When allow_same_price_closed_market_repost=true and it's a manual
    workflow_dispatch, the price-change guard is bypassed for market_closed_reference.
    The dry_run flag still prevents an actual X post."""
    fresh_now = datetime.now(timezone.utc)
    source_ts = (fresh_now - timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%SZ")
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4724.10,
                "timestamp_utc": source_ts,
                "fetched_at_utc": fresh_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 557.79,
                "karats_aed_per_gram": {
                    "24k": 557.79,
                    "22k": 511.31,
                    "21k": 488.07,
                    "18k": 418.34,
                },
            }
        )
    )
    # Previous state has the SAME price — would normally skip
    state_file.write_text(
        json.dumps({"price": 4724.10, "posted_at_utc": (fresh_now - timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%SZ")})
    )
    tweet_state_file.write_text(json.dumps({"schema_version": 1}))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(pg, "post_tweet", MagicMock())
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: False)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("DRY_RUN_TWEET", "true")
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "manual")
    monkeypatch.setenv("ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST", "true")
    monkeypatch.delenv("GITHUB_EVENT_SCHEDULE", raising=False)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected main() to exit after dry run")

    out = capsys.readouterr().out
    assert "allow_same_price_closed_market_repost=true" in out
    assert "price-change guard bypassed" in out
    # DRY_RUN stops the actual post
    assert "DRY_RUN_TWEET=true" in out
    pg.post_tweet.assert_not_called()


def test_main_allow_same_price_closed_market_repost_false_still_skips(
    tmp_path, monkeypatch, capsys
):
    """When allow_same_price_closed_market_repost=false (default), same-price
    market_closed_reference exits cleanly without posting."""
    fresh_now = datetime.now(timezone.utc)
    source_ts = (fresh_now - timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%SZ")
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4724.10,
                "timestamp_utc": source_ts,
                "fetched_at_utc": fresh_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 557.79,
                "karats_aed_per_gram": {
                    "24k": 557.79,
                    "22k": 511.31,
                    "21k": 488.07,
                    "18k": 418.34,
                },
            }
        )
    )
    state_file.write_text(
        json.dumps({"price": 4724.10, "posted_at_utc": (fresh_now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")})
    )
    tweet_state_file.write_text(json.dumps({"schema_version": 1}))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(pg, "post_tweet", MagicMock())
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: False)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "manual")
    monkeypatch.setenv("ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST", "false")
    monkeypatch.delenv("GITHUB_EVENT_SCHEDULE", raising=False)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected main() to exit with skip")

    out = capsys.readouterr().out
    # Should see the detailed skip log
    assert "same closing/reference price already posted" in out
    # Must NOT bypass the guard
    assert "price-change guard bypassed" not in out
    pg.post_tweet.assert_not_called()


def test_main_scheduled_run_cannot_use_allow_same_price_repost(
    tmp_path, monkeypatch, capsys
):
    """Scheduled runs must never bypass the price-change guard via
    allow_same_price_closed_market_repost, even if env var is set to true."""
    fresh_now = datetime.now(timezone.utc)
    gold_file = tmp_path / "gold_price.json"
    state_file = tmp_path / "last_gold_price.json"
    tweet_state_file = tmp_path / "last_tweet_state.json"
    gold_file.write_text(
        json.dumps(
            {
                "provider": "gold_api_com",
                "xau_usd_per_oz": 4724.10,
                "timestamp_utc": fresh_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "fetched_at_utc": fresh_now.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "aed_per_gram_24k": 557.79,
                "karats_aed_per_gram": {
                    "24k": 557.79,
                    "22k": 511.31,
                    "21k": 488.07,
                    "18k": 418.34,
                },
            }
        )
    )
    state_file.write_text(
        json.dumps({"price": 4724.10, "posted_at_utc": (fresh_now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")})
    )
    tweet_state_file.write_text(json.dumps({"schema_version": 1}))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", tweet_state_file)
    monkeypatch.setattr(pg, "post_tweet", MagicMock())
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: True)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    # Simulate scheduled run
    monkeypatch.setenv("GITHUB_EVENT_NAME", "schedule")
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "scheduled")
    monkeypatch.setenv("GITHUB_EVENT_SCHEDULE", "9 * * * 1-4")
    # Even if this env var is set, scheduled run must not bypass
    monkeypatch.setenv("ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST", "true")
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected main() to exit with skip")

    out = capsys.readouterr().out
    # Scheduled run: price-change guard fires (hourly post type, same price)
    assert "SKIP: price-change guard" in out
    # Must NOT bypass — is_allow_same_price... returns False for schedule event
    assert "price-change guard bypassed" not in out
    pg.post_tweet.assert_not_called()


# ── New hardening tests ───────────────────────────────────────────────────────

def test_format_tweet_always_uses_standard_variant_when_premium(capsys, monkeypatch):
    """With X Premium (default TWEET_MAX_CHARS=25000), the standard template is always used."""
    monkeypatch.delenv("TWEET_MAX_CHARS", raising=False)
    data = {
        "price": 4681.84,
        "price_gram_24k": 150.38,
        "price_gram_22k": 137.85,
        "price_gram_21k": 131.58,
        "price_gram_18k": 112.78,
        "chp": 0.25,
        "prev_price": None,
        "prev_posted_at_utc": None,
    }
    original_format = pg.format_hourly_tweet
    pg.format_hourly_tweet = lambda _d: "x" * 304
    try:
        result = pg.format_tweet(data, "hourly")
    finally:
        pg.format_hourly_tweet = original_format

    # X Premium: the 304-char tweet is returned as-is without compact fallback.
    assert result == "x" * 304
    out = capsys.readouterr().out
    assert "template_variant: hourly_compact" not in out


def test_format_tweet_falls_back_to_compact_when_limit_is_280(capsys, monkeypatch):
    """With TWEET_MAX_CHARS=280, a 304-char standard template falls back to compact."""
    monkeypatch.setenv("TWEET_MAX_CHARS", "280")
    data = {
        "price": 4681.84,
        "price_gram_24k": 150.38,
        "price_gram_22k": 137.85,
        "price_gram_21k": 131.58,
        "price_gram_18k": 112.78,
        "chp": 0.25,
        "prev_price": None,
        "prev_posted_at_utc": None,
    }
    original_standard = pg.format_hourly_tweet
    original_compact = pg.format_hourly_tweet_compact
    pg.format_hourly_tweet = lambda _d: "x" * 304         # exceeds 280
    pg.format_hourly_tweet_compact = lambda _d: "y" * 260  # fits within 280
    try:
        result = pg.format_tweet(data, "hourly")
    finally:
        pg.format_hourly_tweet = original_standard
        pg.format_hourly_tweet_compact = original_compact

    assert result == "y" * 260
    out = capsys.readouterr().out
    assert "template_variant: hourly_compact" in out


def test_format_tweet_warns_when_all_variants_exceed_limit(capsys, monkeypatch):
    """When all variants exceed TWEET_MAX_CHARS, the last variant is returned with a warning."""
    monkeypatch.setenv("TWEET_MAX_CHARS", "280")
    data = {
        "price": 4681.84,
        "price_gram_24k": 150.38,
        "price_gram_22k": 137.85,
        "price_gram_21k": 131.58,
        "price_gram_18k": 112.78,
        "chp": 0.25,
        "prev_price": None,
        "prev_posted_at_utc": None,
    }
    original_standard = pg.format_hourly_tweet
    original_compact = pg.format_hourly_tweet_compact
    original_micro = pg.format_micro_tweet
    pg.format_hourly_tweet = lambda _d: "x" * 304
    pg.format_hourly_tweet_compact = lambda _d: "y" * 299
    pg.format_micro_tweet = lambda _d: "z" * 290  # also exceeds 280
    try:
        result = pg.format_tweet(data, "hourly")
    finally:
        pg.format_hourly_tweet = original_standard
        pg.format_hourly_tweet_compact = original_compact
        pg.format_micro_tweet = original_micro

    assert result == "z" * 290
    out = capsys.readouterr().out
    assert "⚠️" in out
    assert "290" in out


def test_format_tweet_returns_standard_template_within_premium_limit(capsys, monkeypatch):
    """With X Premium, even a tweet that exceeds the legacy 280-char limit is returned as-is."""
    monkeypatch.delenv("TWEET_MAX_CHARS", raising=False)
    data = {
        "price": 4681.84,
        "price_gram_24k": 150.38,
        "price_gram_22k": 137.85,
        "price_gram_21k": 131.58,
        "price_gram_18k": 112.78,
        "chp": 0.25,
        "prev_price": None,
        "prev_posted_at_utc": None,
    }
    original_standard = pg.format_hourly_tweet
    pg.format_hourly_tweet = lambda _d: "x" * 350  # typical 7-karat tweet length
    try:
        result = pg.format_tweet(data, "hourly")
    finally:
        pg.format_hourly_tweet = original_standard

    assert result == "x" * 350
    out = capsys.readouterr().out
    # No length warning for tweets comfortably within X Premium limits
    assert "⚠️" not in out


def test_format_tweet_no_warning_for_normal_length_tweets(capsys, monkeypatch):
    """format_tweet must NOT emit a length warning for normal-sized tweets."""
    monkeypatch.delenv("TWEET_MAX_CHARS", raising=False)
    data = {
        "price": 4681.84,
        "price_gram_24k": 150.38,
        "price_gram_22k": 137.85,
        "price_gram_21k": 131.58,
        "price_gram_18k": 112.78,
        "chp": 0.25,
        "prev_price": None,
        "prev_posted_at_utc": None,
    }
    original_format = pg.format_hourly_tweet
    pg.format_hourly_tweet = lambda _d: "short tweet"
    try:
        result = pg.format_tweet(data, "hourly")
    finally:
        pg.format_hourly_tweet = original_format

    out = capsys.readouterr().out
    assert "tweet_length" not in out
    assert len(result) == len("short tweet")


def test_get_gold_price_fatal_on_missing_file(tmp_path, monkeypatch, capsys):
    """main() must exit with code 1 (FATAL) when gold_price.json is missing."""
    missing_file = tmp_path / "no_such_file.json"
    state_file = tmp_path / "last_gold_price.json"
    state_file.write_text("{}")
    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", missing_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 1
    else:
        raise AssertionError("Expected main() to exit(1) on missing gold_price.json")

    out = capsys.readouterr().out
    assert "FATAL:" in out
    assert "not found" in out
    assert str(missing_file) in out


def test_get_gold_price_fatal_on_malformed_json(tmp_path, monkeypatch, capsys):
    """main() must exit with code 1 (FATAL) when gold_price.json is malformed."""
    gold_file = tmp_path / "gold_price.json"
    gold_file.write_text("{{{not valid json")
    state_file = tmp_path / "last_gold_price.json"
    state_file.write_text("{}")
    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 1
    else:
        raise AssertionError("Expected main() to exit(1) on malformed gold_price.json")

    out = capsys.readouterr().out
    assert "FATAL:" in out
    assert "unreadable" in out
    assert str(gold_file) in out


def test_duplicate_guard_market_closed_reference_log_uses_tree_format(monkeypatch):
    """SKIP log for market_closed_reference must use ├── / └── tree style."""
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "shortcut")
    monkeypatch.setenv("POST_TRIGGER_NONCE", "nonce-xyz")
    monkeypatch.setenv("REFRESH_PRICE_FIRST", "false")
    _now = datetime(2026, 5, 9, 9, 0, 0, tzinfo=timezone.utc)
    _prev = (_now - timedelta(hours=2, minutes=18)).strftime('%Y-%m-%dT%H:%M:%SZ')
    skip, reason = pg.check_duplicate_guard(
        price=4724.10,
        prev_price=4724.10,
        prev_posted_at_utc=_prev,
        post_type='market_closed_reference',
        _now=_now,
    )
    assert skip is True
    assert "├── current_price:" in reason
    assert "├── previous_price:" in reason
    assert "├── previous_post_ts:" in reason
    assert "├── minutes_since_post:" in reason
    assert "├── selected_post_type:   market_closed_reference" in reason
    assert "├── source:               shortcut" in reason
    assert "├── trigger_nonce:        nonce-xyz" in reason
    assert "├── refresh_price_first:  false" in reason
    assert "└── action:" in reason
    assert "allow_same_price_closed_market_repost=true" in reason


# ── "Previous post: none" vs guard state clarification tests ─────────────────

def _make_normalized_gold_file(tmp_path, price=4715.70, hours_old=0.1):
    """Return a gold_price.json in normalized (fetch_gold_price.py) format.
    This is what data/last_gold_price.json looks like after refresh_price_first=true runs
    and fetch_gold_price.py overwrites it — causing _load_last_price() to return None.
    """
    now = datetime.now(timezone.utc)
    ts = (now - timedelta(hours=hours_old)).strftime("%Y-%m-%dT%H:%M:%SZ")
    gold_file = tmp_path / "gold_price.json"
    gold_file.write_text(json.dumps({
        "schema_version": 1,
        "provider": "gold_api_com",
        "xau_usd_per_oz": price,
        "timestamp_utc": ts,
        "fetched_at_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "aed_per_gram_24k": 557.79,
        "karats_aed_per_gram": {
            "24k": 557.79,
            "22k": 511.31,
            "21k": 488.07,
            "18k": 418.34,
        },
    }))
    return gold_file


def test_previous_post_none_from_legacy_state_cross_references_guard_state(
    tmp_path, monkeypatch, capsys
):
    """
    When data/last_gold_price.json is in normalized format but last_tweet_state.json has a
    valid prior post, the poster should prefer the guard state as the authoritative previous
    post source and explain that the legacy file is compatibility-only.
    """
    fresh_now = datetime.now(timezone.utc)
    gold_file = _make_normalized_gold_file(tmp_path, price=4715.70, hours_old=0.1)

    # The legacy state file is in normalized format (as if overwritten by fetcher)
    legacy_state_file = tmp_path / "last_gold_price.json"
    legacy_state_file.write_text(json.dumps({
        "schema_version": 1,
        "provider": "gold_api_com",
        "xau_usd_per_oz": 4715.70,
        "timestamp_utc": (fresh_now - timedelta(hours=0.5)).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }))

    # Guard state has valid prior post data
    guard_state_file = tmp_path / "last_tweet_state.json"
    guard_state_file.write_text(json.dumps({
        "schema_version": 1,
        "last_tweet_time_utc": (fresh_now - timedelta(minutes=16, seconds=53)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "last_price_usd_oz": 4715.7002,
        "last_tweet_text_hash": "3d058e70a48a695ab9b1fccd169697479e2fcfed4b646a68db33d3247383f421",
    }))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", legacy_state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", guard_state_file)
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: False)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("DRY_RUN_TWEET", "true")
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "shortcut")
    monkeypatch.setenv("FORCE_POST", "true")
    monkeypatch.delenv("GITHUB_EVENT_SCHEDULE", raising=False)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit:
        pass

    out = capsys.readouterr().out
    assert "Previous post (authoritative data/last_tweet_state.json):" in out
    assert "4,715.7002" in out or "4715.7002" in out
    assert "compatibility" in out


def test_run_context_block_includes_guard_state_and_force_summary_due(
    tmp_path, monkeypatch, capsys
):
    """
    The RUN CONTEXT block must include:
    - allow_same_price_closed_market_repost
    - last_price_usd_oz from guard state
    - last_tweet_time_utc from guard state
    - minutes_since_last_tweet
    - force_summary_due
    - force_summary_after_minutes
    """
    fresh_now = datetime.now(timezone.utc)
    gold_file = _make_normalized_gold_file(tmp_path, price=4715.70, hours_old=0.1)
    legacy_state_file = tmp_path / "last_gold_price.json"
    legacy_state_file.write_text(json.dumps({"price": 4715.70, "posted_at_utc": "2026-05-09T17:00:00Z"}))
    guard_state_file = tmp_path / "last_tweet_state.json"
    guard_state_file.write_text(json.dumps({
        "schema_version": 1,
        "last_tweet_time_utc": (fresh_now - timedelta(minutes=16)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "last_price_usd_oz": 4715.7002,
        "last_tweet_text_hash": "abcdef123456abcdef123456abcdef123456abcdef123456abcdef123456abcd",
    }))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", legacy_state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", guard_state_file)
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: True)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("DRY_RUN_TWEET", "true")
    monkeypatch.setenv("ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST", "true")
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    monkeypatch.delenv("GITHUB_EVENT_SCHEDULE", raising=False)
    monkeypatch.delenv("GITHUB_EVENT_NAME", raising=False)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit:
        pass

    out = capsys.readouterr().out
    assert "allow_same_price_closed_market_repost:" in out
    assert "last_price_usd_oz (guard):" in out
    assert "last_tweet_time_utc (guard):" in out
    assert "minutes_since_last_tweet:" in out
    assert "force_summary_due:" in out
    assert "force_summary_after_minutes:" in out
    # Guard state file path must be mentioned
    assert "data/last_tweet_state.json" in out
    assert "data/last_gold_price.json" in out
    assert "data/gold_price.json" in out


def test_price_move_threshold_skip_includes_force_post_explanation_for_market_closed_reference(
    tmp_path, monkeypatch, capsys
):
    """
    When price_move_below_threshold fires for market_closed_reference, the SKIP message must:
    - Explain that force_post=True only bypasses cooldown
    - Tell the operator how to override (allow_same_price_closed_market_repost=true)
    - Show force_summary_due=False and minutes_since_last
    This covers the 18:46 run scenario.
    """
    fresh_now = datetime.now(timezone.utc)
    source_ts = (fresh_now - timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%SZ")
    gold_file = _make_normalized_gold_file(tmp_path, price=4715.70, hours_old=4)
    # Legacy state is normalized-only and should be ignored in favour of guard-state history.
    legacy_state_file = tmp_path / "last_gold_price.json"
    legacy_state_file.write_text(json.dumps({
        "schema_version": 1,
        "provider": "gold_api_com",
        "xau_usd_per_oz": 4715.70,
        "timestamp_utc": source_ts,
    }))

    # Guard state: last tweet was only 16 min ago (force_summary_due=False).
    # The last_provider_timestamp_utc is OLDER than the current gold file's timestamp,
    # simulating refresh_price_first=true having advanced the provider timestamp.
    # Use a small but non-zero price move so the legacy price-change guard passes and
    # tweet_guard still owns the sub-threshold skip.
    guard_state_file = tmp_path / "last_tweet_state.json"
    older_provider_ts = (fresh_now - timedelta(hours=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    guard_state_file.write_text(json.dumps({
        "schema_version": 1,
        "last_tweet_time_utc": (fresh_now - timedelta(minutes=16, seconds=53)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "last_tweet_text_hash": "5e11dd7ff6ab3075f2ec1f1b77485c8ecfef64f057336f9b5f0cf48df277dbc4",
        "last_price_usd_oz": 4715.60,
        "last_provider_timestamp_utc": older_provider_ts,
    }))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", legacy_state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", guard_state_file)
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: False)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "shortcut")
    monkeypatch.setenv("FORCE_POST", "true")  # bypasses cooldown only
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    monkeypatch.setenv("ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST", "false")
    monkeypatch.delenv("GITHUB_EVENT_SCHEDULE", raising=False)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected skip exit")

    out = capsys.readouterr().out
    assert "price_move_below_threshold" in out
    assert "force_summary_due" in out
    # force_post explanation must appear
    assert "force_post" in out.lower()
    assert "cooldown" in out.lower()
    # Must tell operator about allow_same_price_closed_market_repost
    assert "allow_same_price_closed_market_repost" in out
    # The market_closed_reference specific message
    assert "market_closed_reference" in out
    assert "same closing/reference price" in out


def test_allow_same_price_closed_market_repost_bypasses_tweet_guard_threshold(
    tmp_path, monkeypatch, capsys
):
    fresh_now = datetime.now(timezone.utc)
    source_ts = (fresh_now - timedelta(hours=4)).strftime("%Y-%m-%dT%H:%M:%SZ")
    gold_file = _make_normalized_gold_file(tmp_path, price=4715.70, hours_old=4)
    legacy_state_file = tmp_path / "last_gold_price.json"
    legacy_state_file.write_text(json.dumps({
        "schema_version": 1,
        "provider": "gold_api_com",
        "xau_usd_per_oz": 4715.70,
        "timestamp_utc": source_ts,
    }))
    guard_state_file = tmp_path / "last_tweet_state.json"
    older_provider_ts = (fresh_now - timedelta(hours=5)).strftime("%Y-%m-%dT%H:%M:%SZ")
    guard_state_file.write_text(json.dumps({
        "schema_version": 1,
        "last_tweet_time_utc": (fresh_now - timedelta(minutes=16, seconds=53)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "last_tweet_text_hash": "5e11dd7ff6ab3075f2ec1f1b77485c8ecfef64f057336f9b5f0cf48df277dbc4",
        "last_price_usd_oz": 4715.70,
        "last_provider_timestamp_utc": older_provider_ts,
    }))

    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", legacy_state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", guard_state_file)
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: False)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "shortcut")
    monkeypatch.setenv("FORCE_POST", "true")
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    monkeypatch.setenv("ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST", "true")
    monkeypatch.setenv("DRY_RUN_TWEET", "true")
    monkeypatch.delenv("GITHUB_EVENT_SCHEDULE", raising=False)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")

    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("Expected dry-run exit after override")

    out = capsys.readouterr().out
    assert "allow_same_price_closed_market_repost=true" in out
    assert "price_move_below_threshold bypassed" in out
    assert "DRY_RUN_TWEET=true — would post; skipping actual X call" in out
    assert "SKIP: tweet-guard — price_move_below_threshold" not in out


def test_market_closed_reference_template_content(tmp_path, monkeypatch, capsys):
    """market_closed_reference template must match the expected public format."""
    tweet = pg.format_market_closed_reference_tweet({
        "price": 4715.70,
        "price_gram_24k": 556.80,
        "price_gram_22k": 510.40,
        "price_gram_21k": 487.20,
        "price_gram_18k": 417.60,
        "chp": None,
        "source_updated_at_utc": "2026-05-09T18:45:00Z",
        "stale_age_hours": 10.0,
    })
    assert "🔴 Gold Market Closed" in tweet
    assert "Spot ref XAU/USD" in tweet
    assert "$4,715.70/oz" in tweet
    assert "🇦🇪 AED/g" in tweet
    assert "Reopens Mon 1:00 AM UAE" in tweet
    assert "Updated " in tweet
    assert "Spot ref · Not retail" in tweet
    # The URL is the penultimate visible line; the last visible line is the hashtag block.
    visible_lines = [line for line in tweet.splitlines() if line]
    assert visible_lines[-2] == "goldtickerlive.com"
    assert "#GoldPrice #XAU #UAE" in tweet
    # With 7 karats and proper spacing, this tweet is longer than the legacy 280-char limit
    # but well within X Premium's 25,000-char limit. Detect runaway growth at 1000.
    assert len(tweet) <= 1000, f"tweet is {len(tweet)} chars — runaway growth"
    # Stale age must NOT be in the public post
    assert "10.0h old" not in tweet
    assert "Cached reference" not in tweet
    assert "cached" not in tweet.lower().replace("Spot reference", "")
    assert "Last Reference Price" not in tweet
    assert "Reference prices:" not in tweet


def test_force_post_only_bypasses_cooldown_not_price_move_threshold(monkeypatch):
    """
    force_post=True must bypass cooldown (Rule 2) but NOT price_move_below_threshold (Rule 7).
    This is the core behavioral rule for the 18:46 run scenario.
    """
    import tweet_guard as tg
    monkeypatch.setenv("FORCE_POST", "true")
    monkeypatch.setenv("MIN_TWEET_INTERVAL_MINUTES", "55")
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")

    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD DIFFERENT TEXT"),
        last_tweet_time_utc=(datetime.now(timezone.utc) - timedelta(minutes=16)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        last_provider_timestamp_utc="2026-05-09T14:00:00Z",
        last_price_usd_oz=4715.70,
    )
    quote = {
        "xau_usd_per_oz": 4715.70,  # same price
        "timestamp_utc": "2026-05-09T14:10:00Z",  # timestamp advanced slightly
        "is_fresh": True,
        "is_fallback": False,
        "provider": "gold_api_com",
        "source_type": "market_closed_reference",
    }
    decision = tg.decide(state, quote=quote, tweet_text="NEW DIFFERENT TEXT")
    # force_post bypassed cooldown (which would have been ~55 min for 16-min gap)
    assert decision.skip_reason != "cooldown_active"
    # But price_move_below_threshold fires because price=0 move and force_summary_due=False
    assert decision.should_post is False
    assert decision.skip_reason == "price_move_below_threshold"
    assert decision.force_summary_due is False


# ── must_post mode tests ──────────────────────────────────────────────────────
# These tests verify that POST_INTENT=must_post bypasses all soft guard reasons
# and converts them into published posts rather than skipped runs.

def _make_fresh_gold_file(tmp_path, price=4675.20):
    """Return a fresh gold_price.json and matching state/guard files."""
    now = datetime.now(timezone.utc)
    gold_file = tmp_path / "gold_price.json"
    gold_file.write_text(json.dumps({
        "provider": "gold_api_com",
        "xau_usd_per_oz": price,
        "timestamp_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fetched_at_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "aed_per_gram_24k": 552.02,
        "karats_aed_per_gram": {
            "24k": 552.02,
            "22k": 506.02,
            "21k": 483.02,
            "18k": 414.02,
        },
    }))
    return gold_file


def _make_guard_state(tmp_path, last_price=4674.80, mins_ago=2):
    """Return a last_tweet_state.json with a recent post."""
    guard_file = tmp_path / "last_tweet_state.json"
    last_time = (datetime.now(timezone.utc) - timedelta(minutes=mins_ago))
    guard_file.write_text(json.dumps({
        "schema_version": 1,
        "last_tweet_text_hash": "abc123",
        "last_tweet_time_utc": last_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "last_price_usd_oz": last_price,
        "last_provider_timestamp_utc": (
            last_time - timedelta(minutes=5)
        ).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }))
    return guard_file


def _setup_must_post_env(monkeypatch, tmp_path, gold_file, guard_file, state_file=None):
    """Set up common env vars for must_post integration tests."""
    if state_file is None:
        state_file = tmp_path / "last_gold_price.json"
        state_file.write_text("{}")
    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", state_file)
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", guard_file)
    monkeypatch.setenv("TWITTER_API_KEY", "key")
    monkeypatch.setenv("TWITTER_API_SECRET", "secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "key")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "secret")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "token")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "token-secret")
    monkeypatch.setenv("POST_INTENT", "must_post")
    monkeypatch.setenv("FORCE_POST", "true")
    monkeypatch.setenv("DRY_RUN_TWEET", "true")
    monkeypatch.setenv("GITHUB_EVENT_NAME", "workflow_dispatch")
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "manual")
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: True)


def test_must_post_posts_when_price_move_below_threshold(tmp_path, monkeypatch, capsys):
    """must_post mode must proceed even when price moved below threshold (+$0.40).
    This is the exact scenario from the bug report (SKIP: price_move_below_threshold)."""
    gold_file = _make_fresh_gold_file(tmp_path, price=4675.20)
    guard_file = _make_guard_state(tmp_path, last_price=4674.80, mins_ago=2)
    post_mock = MagicMock(return_value={"posted": True, "id": "tweet123"})
    monkeypatch.setattr(pg, "post_tweet", post_mock)
    _setup_must_post_env(monkeypatch, tmp_path, gold_file, guard_file)
    # dry_run=true so no real X call but the guards should pass
    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    out = capsys.readouterr().out
    # Must NOT see SKIPPED_TWEET_GUARD or price_move_below_threshold skip
    assert "SKIPPED_TWEET_GUARD" not in out
    assert "SKIP: tweet-guard — price_move_below_threshold" not in out
    # Should see the dry-run bypass (indicates guards passed)
    assert "DRY_RUN_TWEET=true" in out


def test_must_post_posts_when_price_unchanged(tmp_path, monkeypatch, capsys):
    """must_post must post when price is identical to last post (unchanged price)."""
    gold_file = _make_fresh_gold_file(tmp_path, price=4675.20)
    guard_file = _make_guard_state(tmp_path, last_price=4675.20, mins_ago=65)
    post_mock = MagicMock(return_value={"posted": True, "id": "tweet456"})
    monkeypatch.setattr(pg, "post_tweet", post_mock)
    _setup_must_post_env(monkeypatch, tmp_path, gold_file, guard_file)
    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    out = capsys.readouterr().out
    assert "SKIPPED_TWEET_GUARD" not in out
    # Either the price-change guard was bypassed by must_post or it passed normally;
    # either way, must not see an unoveridden SKIPPED_PRICE_CHANGE_GUARD.
    assert "SKIPPED_PRICE_CHANGE_GUARD" not in out
    assert "DRY_RUN_TWEET=true" in out


def test_must_post_does_not_send_literal_duplicate_text(tmp_path, monkeypatch, capsys):
    """must_post must NOT send literal duplicate text; it must add a uniqueness suffix.
    This tests the _add_uniqueness_suffix helper that is used when duplicate_text_hash fires."""
    # Verify the suffix function itself
    original = "Gold Update — May 11 2026\nXAU/USD $4,675.20/oz"
    suffixed = pg._add_uniqueness_suffix(original)
    assert suffixed != original
    assert original in suffixed            # original content preserved
    assert "Latest check:" in suffixed     # uniqueness line added
    # Verify that two calls at the same second produce the same result (deterministic)
    fixed_now = datetime(2026, 5, 11, 12, 0, 0, tzinfo=timezone.utc)
    s1 = pg._add_uniqueness_suffix("text", now=fixed_now)
    s2 = pg._add_uniqueness_suffix("text", now=fixed_now)
    assert s1 == s2  # deterministic for same time
    # Verify that two different times produce different results (unique for rapid retries)
    later = fixed_now + timedelta(seconds=1)
    s3 = pg._add_uniqueness_suffix("text", now=later)
    assert s1 != s3  # different seconds → different suffix


def test_must_post_mode_is_false_by_default(monkeypatch):
    """_is_must_post_mode() returns False when POST_INTENT is not set (guard_normal)."""
    monkeypatch.delenv("POST_INTENT", raising=False)
    assert pg._is_must_post_mode() is False


def test_must_post_mode_true_when_set(monkeypatch):
    """_is_must_post_mode() returns True when POST_INTENT=must_post."""
    monkeypatch.setenv("POST_INTENT", "must_post")
    assert pg._is_must_post_mode() is True


def test_must_post_mode_false_for_guard_normal(monkeypatch):
    """_is_must_post_mode() returns False for POST_INTENT=guard_normal."""
    monkeypatch.setenv("POST_INTENT", "guard_normal")
    assert pg._is_must_post_mode() is False


def test_add_uniqueness_suffix_changes_text():
    """_add_uniqueness_suffix() always produces text different from input."""
    original = "Gold Update — May 11 2026\nXAU/USD $4,675.20/oz"
    suffixed = pg._add_uniqueness_suffix(original)
    assert suffixed != original
    assert original in suffixed  # original is still present
    assert "Latest check:" in suffixed


def test_format_micro_tweet_under_280_chars():
    """format_micro_tweet() must always produce a tweet under 280 characters."""
    data = {
        "price": 4675.20,
        "price_gram_24k": 552.02,
        "chp": 0.01,
    }
    tweet = pg.format_micro_tweet(data)
    assert len(tweet) <= 280, f"Micro tweet is {len(tweet)} chars, expected <= 280"


def test_format_micro_tweet_contains_required_fields():
    """format_micro_tweet() must include price, UAE 24K rate, and spot ref label."""
    data = {
        "price": 4675.20,
        "price_gram_24k": 552.02,
        "chp": 0.25,
    }
    tweet = pg.format_micro_tweet(data)
    assert "4,675.20" in tweet
    assert "UAE" in tweet
    assert tweet.splitlines()[-1] == "goldtickerlive.com"
    assert "Spot ref" in tweet


def test_format_micro_tweet_unchanged_label_for_small_move():
    """format_micro_tweet() uses 'unchanged' label for sub-threshold moves."""
    data = {"price": 4675.20, "price_gram_24k": 552.02, "chp": 0.01}
    tweet = pg.format_micro_tweet(data)
    assert "unchanged" in tweet


def test_format_micro_tweet_positive_pct_for_big_move():
    """format_micro_tweet() uses +% label for significant upward moves."""
    data = {"price": 4675.20, "price_gram_24k": 552.02, "chp": 1.5}
    tweet = pg.format_micro_tweet(data)
    assert "+1.50%" in tweet


def test_format_micro_tweet_negative_pct_for_drop():
    """format_micro_tweet() uses -% label for drops."""
    data = {"price": 4675.20, "price_gram_24k": 552.02, "chp": -0.8}
    tweet = pg.format_micro_tweet(data)
    assert "-0.80%" in tweet


def test_must_post_bypasses_price_change_guard_logs_override(tmp_path, monkeypatch, capsys):
    """must_post mode must log the guard bypass rather than skipping."""
    gold_file = _make_fresh_gold_file(tmp_path, price=4675.20)
    guard_file = _make_guard_state(tmp_path, last_price=4675.20, mins_ago=30)
    post_mock = MagicMock(return_value={"posted": True, "id": "tweetX"})
    monkeypatch.setattr(pg, "post_tweet", post_mock)
    _setup_must_post_env(monkeypatch, tmp_path, gold_file, guard_file)
    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0
    out = capsys.readouterr().out
    # Should see the must_post override message
    assert "must_post" in out
    # Should NOT see a hard SKIP
    assert "SKIPPED_PRICE_CHANGE_GUARD" not in out


def test_must_post_fails_hard_on_missing_credentials(tmp_path, monkeypatch, capsys):
    """must_post mode must hard-fail (exit 1) when X credentials are missing."""
    gold_file = _make_fresh_gold_file(tmp_path, price=4675.20)
    guard_file = _make_guard_state(tmp_path, last_price=4674.80, mins_ago=65)
    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", tmp_path / "last_gold_price.json")
    (tmp_path / "last_gold_price.json").write_text("{}")
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", guard_file)
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: True)
    monkeypatch.setenv("POST_INTENT", "must_post")
    # No X credentials set — must hard-fail
    monkeypatch.delenv("TWITTER_API_KEY", raising=False)
    monkeypatch.delenv("TWITTER_API_SECRET", raising=False)
    monkeypatch.delenv("TWITTER_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("TWITTER_ACCESS_TOKEN_SECRET", raising=False)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "")
    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 1, f"Expected exit(1) for missing credentials in must_post mode, got {exc.code}"
    else:
        raise AssertionError("Expected SystemExit for missing credentials in must_post mode")
    out = capsys.readouterr().out
    assert "FAILED_HARD_MISSING_CREDENTIALS" in out


def test_guard_normal_skips_missing_credentials_with_exit_0(tmp_path, monkeypatch, capsys):
    """guard_normal mode must soft-skip (exit 0) when X credentials are missing."""
    gold_file = _make_fresh_gold_file(tmp_path, price=4675.20)
    guard_file = _make_guard_state(tmp_path, last_price=4674.80, mins_ago=65)
    monkeypatch.setattr(pg, "GOLD_PRICE_FILE", gold_file)
    monkeypatch.setattr(pg, "STATE_FILE", tmp_path / "last_gold_price.json")
    (tmp_path / "last_gold_price.json").write_text("{}")
    monkeypatch.setattr(pg, "LAST_TWEET_STATE_FILE", guard_file)
    monkeypatch.setattr(pg, "is_market_open_time", lambda _now=None: True)
    monkeypatch.setenv("POST_INTENT", "guard_normal")
    monkeypatch.delenv("TWITTER_API_KEY", raising=False)
    monkeypatch.delenv("TWITTER_API_SECRET", raising=False)
    monkeypatch.delenv("TWITTER_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("TWITTER_ACCESS_TOKEN_SECRET", raising=False)
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "")
    try:
        pg.main()
    except SystemExit as exc:
        assert exc.code == 0, f"Expected exit(0) for missing credentials in guard_normal mode, got {exc.code}"
    else:
        raise AssertionError("Expected SystemExit for missing credentials")
    out = capsys.readouterr().out
    assert "SKIPPED_MISSING_CREDENTIALS" in out


def test_must_post_micro_template_fallback_under_280(tmp_path, monkeypatch, capsys):
    """When must_post forces a post and the standard template is overlong,
    the micro fallback must produce a valid sub-280-char tweet."""
    monkeypatch.setenv("TWEET_MAX_CHARS", "280")
    # Override standard and compact to exceed limit so micro kicks in.
    original_standard = pg.format_hourly_tweet
    original_compact = pg.format_hourly_tweet_compact
    pg.format_hourly_tweet = lambda _d: "x" * 304
    pg.format_hourly_tweet_compact = lambda _d: "y" * 299
    try:
        data = {
            "price": 4675.20,
            "price_gram_24k": 552.02,
            "price_gram_22k": 506.02,
            "price_gram_21k": 483.02,
            "price_gram_18k": 414.02,
            "chp": 0.01,
            "prev_price": None,
            "prev_posted_at_utc": None,
        }
        result_meta = pg.format_tweet(data, "hourly", return_meta=True)
    finally:
        pg.format_hourly_tweet = original_standard
        pg.format_hourly_tweet_compact = original_compact
    assert result_meta["template_used"] == "micro"
    assert result_meta["tweet_length"] <= 280
    assert result_meta["fits_limit"] is True


def test_soft_skip_reasons_set_is_correct():
    """_MUST_POST_SOFT_SKIP_REASONS must contain exactly the expected guard reasons."""
    expected = {
        "price_move_below_threshold",
        "provider_sample_unchanged",
        "provider_timestamp_unchanged",
        "fallback_no_change",
        "cooldown_active",
        "stale_quote",
    }
    assert pg._MUST_POST_SOFT_SKIP_REASONS == expected, (
        f"Set mismatch — extra: {pg._MUST_POST_SOFT_SKIP_REASONS - expected!r}, "
        f"missing: {expected - pg._MUST_POST_SOFT_SKIP_REASONS!r}"
    )
    # duplicate_text_hash is NOT a soft reason — it requires text regeneration
    assert "duplicate_text_hash" not in pg._MUST_POST_SOFT_SKIP_REASONS


def test_duplicate_text_regeneration_produces_different_hash():
    """The hash of the uniqueness-suffixed tweet must differ from the original hash.

    This proves that _add_uniqueness_suffix() + compute_content_hash() together
    guarantee the regenerated tweet cannot be a literal duplicate of the previous post.
    """
    original_tweet = (
        "Gold Update — May 11 2026\n"
        "XAU/USD $4,675.20/oz · little changed (+$0.40)\n"
        "UAE 24K ref: AED 552.02/g\n"
        "Spot ref · not retail\n"
        "goldtickerlive.com"
    )
    original_hash = pg.compute_content_hash(original_tweet)

    suffixed_tweet = pg._add_uniqueness_suffix(original_tweet)
    suffixed_hash = pg.compute_content_hash(suffixed_tweet)

    # Core requirement: hashes must differ so the duplicate guard passes.
    assert original_hash != suffixed_hash, (
        "compute_content_hash must return different values for original vs. suffixed tweet"
    )
    # Original content must be preserved in the suffixed version.
    assert original_tweet in suffixed_tweet
    # The suffix must contain a factual uniqueness marker.
    assert "Latest check:" in suffixed_tweet
    # The suffixed tweet must still be reasonably short.
    assert len(suffixed_tweet) < 400, (
        f"Suffixed tweet too long ({len(suffixed_tweet)} chars): {suffixed_tweet!r}"
    )


def test_post_tweet_returns_tweet_id(monkeypatch):
    """post_tweet() must return the X post ID from the tweepy response."""
    import tweepy
    from unittest.mock import MagicMock, patch

    mock_response = MagicMock()
    mock_response.data.id = "1921000000000000001"

    mock_client = MagicMock()
    mock_client.create_tweet.return_value = mock_response

    # Set dummy credentials so post_tweet does not abort early.
    monkeypatch.setattr(pg, "TWITTER_API_KEY", "k")
    monkeypatch.setattr(pg, "TWITTER_API_SECRET", "s")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN", "t")
    monkeypatch.setattr(pg, "TWITTER_ACCESS_TOKEN_SECRET", "ts")

    with patch.object(tweepy, "Client", return_value=mock_client):
        result = pg.post_tweet("Gold Update test", post_type="hourly")

    assert result.get("posted") is True
    assert result.get("id") == "1921000000000000001"
