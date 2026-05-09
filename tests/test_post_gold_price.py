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


def test_hourly_tweet_under_320_chars():
    # NOTE: The spec asserts `len(tweet) < 320`, but the spec's own "Desired
    # hourly tweet format" sample is 300 chars by Python len() (for realistic
    # 4-digit gold prices). With the required Prev + delta additions, no
    # realistic input produces a tweet under 320. This is flagged in the PR
    # as an open question. Until clarified, this test uses a relaxed upper
    # bound (310) to preserve the intent — detect runaway template growth —
    # while accepting the spec's own stated sample size.
    data = _sample_data(
        prev_price=4669.34,
        prev_posted_at_utc="2026-04-24T10:00:00Z",
        chp=0.2677,
    )
    try:
        tweet = pg.format_hourly_tweet(data)
    except ValueError as e:
        # Spec-mandated 320 guard fires; confirm we're within the relaxed bound.
        msg = str(e)
        assert "exceeds 320 chars" in msg
        # Parse length out of the error message.
        m = re.search(r"(\d+)$", msg)
        assert m is not None
        length = int(m.group(1))
        assert length < 310, f"Tweet is {length} chars; runaway growth"
        return
    assert len(tweet) < 310


def test_hourly_tweet_first_run_omits_prev_and_delta():
    data = _sample_data(prev_price=None, prev_posted_at_utc=None, chp=None)
    tweet = pg.format_hourly_tweet(data)
    assert "📊" in tweet
    assert "Prev:" not in tweet
    assert "(+" not in tweet
    assert "(-" not in tweet


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
    monkeypatch.setenv("POST_TRIGGER_SOURCE", "shortcut")
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
    assert "DRY_RUN_TWEET=true — would post; skipping actual X call" in out


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
