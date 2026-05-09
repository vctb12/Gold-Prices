"""Tests for scripts/python/tweet_guard.py duplicate-prevention logic."""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT / "scripts" / "python"))

import tweet_guard as tg  # noqa: E402


def _quote(price=4550.0, ts="2026-05-01T10:00:00Z", is_fresh=True, is_fallback=False, source_type="spot_reference"):
    return {
        "xau_usd_per_oz": price,
        "timestamp_utc": ts,
        "is_fresh": is_fresh,
        "is_fallback": is_fallback,
        "provider": "twelvedata_xauusd",
        "source_type": source_type,
    }


def _minutes_ago_iso(minutes):
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")


def test_first_post_is_allowed():
    state = tg.TweetState()
    d = tg.decide(state, quote=_quote(), tweet_text="Gold price: $4,550")
    assert d.should_post is True
    assert d.skip_reason is None


def test_skip_when_not_fresh(monkeypatch):
    monkeypatch.delenv("ALLOW_STALE_TWEET", raising=False)
    state = tg.TweetState(last_tweet_text_hash="x", last_tweet_time_utc="2026-05-01T09:00:00Z")
    d = tg.decide(state, quote=_quote(is_fresh=False), tweet_text="Gold price: $4,550")
    assert d.should_post is False
    assert d.skip_reason == "stale_quote"


def test_allow_stale_when_env_true(monkeypatch):
    monkeypatch.setenv("ALLOW_STALE_TWEET", "true")
    state = tg.TweetState(last_tweet_text_hash="x", last_tweet_time_utc="2026-05-01T09:00:00Z")
    d = tg.decide(state, quote=_quote(is_fresh=False), tweet_text="Gold price: $4,550")
    assert d.should_post is True


def test_skip_on_unchanged_provider_timestamp_within_summary_window(monkeypatch):
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    monkeypatch.delenv("ALLOW_STALE_TWEET", raising=False)
    same_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=_minutes_ago_iso(56),
        last_provider_timestamp_utc=same_ts,
        last_price_usd_oz=4550.0,
    )
    # Price changed, but the provider timestamp did not. We still skip because
    # the upstream sample has not actually advanced.
    d = tg.decide(state, quote=_quote(price=4555.0, ts=same_ts), tweet_text="NEW")
    assert d.should_post is False
    assert d.skip_reason == "provider_timestamp_unchanged"
    assert d.provider_timestamp_changed is False


def test_force_summary_due_overrides_unchanged_timestamp(monkeypatch):
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    long_ago = (datetime.now(timezone.utc) - timedelta(minutes=120)).strftime("%Y-%m-%dT%H:%M:%SZ")
    same_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=long_ago,
        last_provider_timestamp_utc=same_ts,
        last_price_usd_oz=4550.0,
    )
    d = tg.decide(state, quote=_quote(price=4555.0, ts=same_ts), tweet_text="NEW")
    assert d.should_post is True


def test_skip_on_unchanged_provider_sample_even_when_force_summary_due(monkeypatch):
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    long_ago = (datetime.now(timezone.utc) - timedelta(minutes=120)).strftime("%Y-%m-%dT%H:%M:%SZ")
    same_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=long_ago,
        last_provider_timestamp_utc=same_ts,
        last_price_usd_oz=4550.0,
    )
    d = tg.decide(state, quote=_quote(price=4550.0, ts=same_ts), tweet_text="NEW")
    assert d.should_post is False
    assert d.skip_reason == "provider_sample_unchanged"


def test_force_summary_due_allows_same_price_when_timestamp_advanced(monkeypatch):
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    long_ago = _minutes_ago_iso(120)
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=long_ago,
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4550.0,
    )
    d = tg.decide(state, quote=_quote(price=4550.0, ts="2026-05-01T10:06:00Z"), tweet_text="NEW")
    assert d.should_post is True


def test_skip_on_duplicate_text_hash(monkeypatch):
    text = "Gold price: $4,550"
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet(text),
        last_tweet_time_utc=_minutes_ago_iso(70),
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4540.0,
    )
    # Provider timestamp changes, price moved, but text identical → must skip.
    d = tg.decide(state, quote=_quote(price=4550.0, ts="2026-05-01T10:06:00Z"), tweet_text=text)
    assert d.should_post is False
    assert d.skip_reason == "duplicate_text_hash"


def test_skip_on_small_price_move(monkeypatch):
    monkeypatch.setenv("MIN_TWEET_MOVE_USD", "1.00")
    monkeypatch.setenv("MIN_TWEET_MOVE_PCT", "0.03")
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=_minutes_ago_iso(56),
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4550.00,
    )
    d = tg.decide(state, quote=_quote(price=4550.10, ts="2026-05-01T10:06:00Z"), tweet_text="NEW")
    assert d.should_post is False
    assert d.skip_reason == "price_move_below_threshold"


def test_post_on_meaningful_price_move(monkeypatch):
    monkeypatch.setenv("MIN_TWEET_MOVE_USD", "1.00")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=_minutes_ago_iso(70),
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4550.00,
    )
    d = tg.decide(state, quote=_quote(price=4555.00, ts="2026-05-01T10:06:00Z"), tweet_text="NEW")
    assert d.should_post is True
    assert d.price_move_usd == 5.00


def test_skip_fallback_with_same_price_and_timestamp():
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=_minutes_ago_iso(70),
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4550.00,
    )
    # Timestamp moved (so rule 2 doesn't fire) but is_fallback + same price → skip.
    q = _quote(price=4550.00, ts="2026-05-01T10:06:00Z", is_fallback=True)
    d = tg.decide(state, quote=q, tweet_text="NEW")
    assert d.should_post is False
    assert d.skip_reason == "fallback_no_change"


def test_skip_when_within_cooldown_window(monkeypatch):
    monkeypatch.setenv("MIN_TWEET_INTERVAL_MINUTES", "55")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=_minutes_ago_iso(20),
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4540.0,
    )
    d = tg.decide(state, quote=_quote(price=4550.0, ts="2026-05-01T10:06:00Z"), tweet_text="NEW")
    assert d.should_post is False
    assert d.skip_reason == "cooldown_active"


def test_force_post_overrides_cooldown_only(monkeypatch):
    monkeypatch.setenv("MIN_TWEET_INTERVAL_MINUTES", "55")
    monkeypatch.setenv("FORCE_POST", "true")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=_minutes_ago_iso(20),
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4540.0,
    )
    d = tg.decide(state, quote=_quote(price=4550.0, ts="2026-05-01T10:06:00Z"), tweet_text="NEW")
    assert d.should_post is True


def test_skip_recent_shortcut_attempt():
    state = tg.TweetState(
        last_trigger_source="shortcut",
        last_trigger_attempt_time_utc=_minutes_ago_iso(1),
        last_trigger_nonce="ios-shortcut-run-1",
        last_trigger_run_id="12345",
    )
    should_skip, reason = tg.should_skip_recent_shortcut_attempt(
        state,
        trigger_source="shortcut",
        window_minutes=2,
        force_post=False,
    )
    assert should_skip is True
    assert "shortcut anti-spam guard" in reason
    assert "ios-shortcut-run-1" in reason


def test_force_post_bypasses_recent_shortcut_attempt():
    state = tg.TweetState(
        last_trigger_source="shortcut",
        last_trigger_attempt_time_utc=_minutes_ago_iso(1),
    )
    should_skip, reason = tg.should_skip_recent_shortcut_attempt(
        state,
        trigger_source="shortcut",
        window_minutes=2,
        force_post=True,
    )
    assert should_skip is False
    assert reason is None


def test_persistence_round_trip(tmp_path: Path):
    p = tmp_path / "last_tweet_state.json"
    state = tg.TweetState()
    state = tg.record_trigger_attempt(
        state,
        trigger_source="shortcut",
        trigger_nonce="ios-shortcut-run-1",
        run_id="123",
        run_attempt="2",
        now=datetime(2026, 5, 1, 10, 1, 0, tzinfo=timezone.utc),
    )
    state = tg.update_state_after_post(
        state,
        quote=_quote(),
        tweet_text="Gold price: $4,550",
        tweet_id="123",
        reason="price_moved",
    )
    tg.save_state(p, state)
    loaded = tg.load_state(p)
    assert loaded.last_tweet_id == "123"
    assert loaded.last_provider == "twelvedata_xauusd"
    assert loaded.last_price_usd_oz == 4550.0
    assert loaded.last_trigger_source == "shortcut"
    assert loaded.last_trigger_nonce == "ios-shortcut-run-1"
    assert loaded.last_trigger_run_attempt == "2"
    raw = json.loads(p.read_text())
    assert raw["schema_version"] == 1


# ── New hardening tests ───────────────────────────────────────────────────────

def test_load_state_warns_on_corrupt_file(tmp_path: Path, capsys):
    """load_state must warn (not raise) when the state file is corrupt JSON."""
    p = tmp_path / "last_tweet_state.json"
    p.write_text("{{{broken json")
    state = tg.load_state(p)
    # Must return a clean default state
    assert state.last_tweet_text_hash is None
    assert state.last_price_usd_oz is None
    out = capsys.readouterr().out
    assert "corrupt or unreadable" in out


def test_load_state_warns_on_missing_required_keys(tmp_path: Path, capsys):
    """load_state must warn when required guard-state keys are missing/null."""
    p = tmp_path / "last_tweet_state.json"
    p.write_text(json.dumps({"schema_version": 1, "last_tweet_id": "999"}))
    state = tg.load_state(p)
    # Missing keys should NOT crash — treated as first-run for those fields
    assert state.last_price_usd_oz is None
    assert state.last_tweet_text_hash is None
    out = capsys.readouterr().out
    assert "missing/null keys" in out
    assert "last_price_usd_oz" in out


def test_load_state_no_warning_on_complete_state(tmp_path: Path, capsys):
    """load_state must NOT warn when all required keys are present."""
    p = tmp_path / "last_tweet_state.json"
    p.write_text(json.dumps({
        "schema_version": 1,
        "last_price_usd_oz": 4550.0,
        "last_tweet_time_utc": "2026-05-01T10:00:00Z",
        "last_tweet_text_hash": "abc123",
    }))
    tg.load_state(p)
    out = capsys.readouterr().out
    assert "missing/null keys" not in out
    assert "corrupt" not in out


def test_decide_emits_guard_trace_for_stale(monkeypatch, capsys):
    """decide() must emit [guard] trace lines for each evaluated rule."""
    monkeypatch.delenv("ALLOW_STALE_TWEET", raising=False)
    state = tg.TweetState(last_tweet_text_hash="x")
    tg.decide(state, quote=_quote(is_fresh=False), tweet_text="Gold: $4,550")
    out = capsys.readouterr().out
    assert "[guard] stale_quote" in out
    assert "SKIP" in out


def test_decide_emits_guard_trace_for_cooldown(monkeypatch, capsys):
    """decide() must emit a cooldown trace when skipping for cooldown."""
    monkeypatch.setenv("MIN_TWEET_INTERVAL_MINUTES", "55")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=_minutes_ago_iso(20),
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4540.0,
    )
    tg.decide(state, quote=_quote(price=4550.0, ts="2026-05-01T10:06:00Z"), tweet_text="NEW")
    out = capsys.readouterr().out
    assert "[guard] cooldown" in out
    assert "SKIP" in out


def test_decide_emits_pass_traces_when_posting(monkeypatch, capsys):
    """When posting is allowed, all PASS trace lines must be present."""
    monkeypatch.setenv("MIN_TWEET_INTERVAL_MINUTES", "55")
    monkeypatch.delenv("ALLOW_STALE_TWEET", raising=False)
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=_minutes_ago_iso(70),
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4540.0,
    )
    d = tg.decide(state, quote=_quote(price=4560.0, ts="2026-05-01T10:10:00Z"), tweet_text="NEW")
    assert d.should_post is True
    out = capsys.readouterr().out
    assert "[guard]" in out
    assert "PASS" in out


def test_force_post_bypasses_only_cooldown_not_duplicate_hash(monkeypatch, capsys):
    """force_post=true must bypass cooldown but NOT duplicate_text_hash."""
    monkeypatch.setenv("MIN_TWEET_INTERVAL_MINUTES", "55")
    monkeypatch.setenv("FORCE_POST", "true")
    text = "Gold price: $4,550"
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet(text),
        last_tweet_time_utc=_minutes_ago_iso(10),
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4540.0,
    )
    # Same text hash — must skip even with force_post
    d = tg.decide(state, quote=_quote(price=4560.0, ts="2026-05-01T10:06:00Z"), tweet_text=text)
    assert d.should_post is False
    assert d.skip_reason == "duplicate_text_hash"


def test_force_post_bypasses_only_cooldown_not_stale(monkeypatch, capsys):
    """force_post=true must bypass cooldown but NOT stale_quote guard."""
    monkeypatch.setenv("MIN_TWEET_INTERVAL_MINUTES", "55")
    monkeypatch.setenv("FORCE_POST", "true")
    monkeypatch.delenv("ALLOW_STALE_TWEET", raising=False)
    state = tg.TweetState(last_tweet_text_hash="x", last_tweet_time_utc=_minutes_ago_iso(10))
    d = tg.decide(state, quote=_quote(is_fresh=False), tweet_text="Gold: $4,555")
    assert d.should_post is False
    assert d.skip_reason == "stale_quote"
