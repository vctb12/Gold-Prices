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


def test_load_state_handles_non_integer_schema_version(tmp_path: Path, capsys):
    """load_state must not crash when schema_version is a non-integer string."""
    p = tmp_path / "last_tweet_state.json"
    p.write_text(json.dumps({
        "schema_version": "x",
        "last_price_usd_oz": 4550.0,
        "last_tweet_time_utc": "2026-05-01T10:00:00Z",
        "last_tweet_text_hash": "abc123",
    }))
    state = tg.load_state(p)
    # Must not crash; schema_version defaults to module SCHEMA_VERSION
    assert state.schema_version == tg.SCHEMA_VERSION
    out = capsys.readouterr().out
    assert "non-integer schema_version" in out


# ── Decision.force_summary_due and .minutes_since_last ───────────────────────

def test_decision_includes_force_summary_due_and_minutes_since_last(monkeypatch):
    """Decision dataclass exposes force_summary_due and minutes_since_last for callers."""
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    monkeypatch.setenv("MIN_TWEET_INTERVAL_MINUTES", "55")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=_minutes_ago_iso(30),
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4550.0,
    )
    d = tg.decide(state, quote=_quote(price=4550.5, ts="2026-05-01T10:06:00Z"), tweet_text="NEW")
    # force_summary_due must be populated on every Decision
    assert d.force_summary_due is not None
    assert d.minutes_since_last is not None
    assert isinstance(d.minutes_since_last, float)


def test_force_summary_due_false_when_recently_posted(monkeypatch):
    """force_summary_due is False when last post was recent (< FORCE_SUMMARY_AFTER_MINUTES)."""
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=_minutes_ago_iso(16),  # only 16 min ago
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4715.70,
    )
    # Same price, timestamp advanced → will hit price_move_below_threshold
    d = tg.decide(state, quote=_quote(price=4715.70, ts="2026-05-01T10:06:00Z"), tweet_text="NEW")
    assert d.force_summary_due is False
    assert d.minutes_since_last is not None
    assert d.minutes_since_last < 60


def test_force_summary_due_true_when_enough_time_has_passed(monkeypatch):
    """force_summary_due is True when last post was >= FORCE_SUMMARY_AFTER_MINUTES ago."""
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=_minutes_ago_iso(61),  # 61 min ago
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4715.70,
    )
    d = tg.decide(state, quote=_quote(price=4715.70, ts="2026-05-01T10:06:00Z"), tweet_text="NEW")
    assert d.force_summary_due is True
    assert d.should_post is True


# ── Two sequential same-input runs can differ due to state ───────────────────

def test_two_sequential_runs_same_inputs_different_outcome(monkeypatch):
    """
    Regression test: two runs with identical workflow inputs behave differently
    because force_summary_due changed between them (state was written after first post).

    Run 1: state has no last_tweet_time → force_summary_due=True → posts.
    Run 2: state updated after run 1 → minutes_since_last=16 → force_summary_due=False → skips.
    """
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    monkeypatch.setenv("MIN_TWEET_INTERVAL_MINUTES", "55")
    monkeypatch.setenv("FORCE_POST", "true")

    # Run 1: guard state has no prior post (first run or state missing)
    state_run1 = tg.TweetState(
        last_tweet_text_hash=None,  # no prior state → force_summary_due=True
        last_tweet_time_utc=None,
        last_provider_timestamp_utc=None,
        last_price_usd_oz=None,
    )
    quote = _quote(price=4715.70, ts="2026-05-09T18:28:55Z")
    d1 = tg.decide(state_run1, quote=quote, tweet_text="Market Closed $4,715.70")
    assert d1.should_post is True  # first_post path → always allow
    assert d1.force_summary_due is True  # minutes_since_last is None → True

    # Simulate: after run 1 posts, state is updated with last_tweet_time_utc ~16 min ago
    state_run2 = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD_DIFFERENT_TEXT"),  # different text, not a dup
        last_tweet_time_utc=_minutes_ago_iso(16),  # only 16 min ago
        last_provider_timestamp_utc="2026-05-09T18:28:55Z",
        last_price_usd_oz=4715.70,
    )
    # Run 2 gets same price, timestamp advanced slightly
    quote2 = _quote(price=4715.70, ts="2026-05-09T18:34:00Z")
    d2 = tg.decide(state_run2, quote=quote2, tweet_text="Market Closed $4,715.70 v2")
    assert d2.should_post is False
    assert d2.skip_reason == "price_move_below_threshold"
    assert d2.force_summary_due is False
    assert d2.minutes_since_last is not None
    assert d2.minutes_since_last < 60


def test_price_move_threshold_skip_log_includes_force_summary_due(monkeypatch, capsys):
    """price_move_below_threshold skip log must include force_summary_due and minutes_since_last."""
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    monkeypatch.setenv("MIN_TWEET_INTERVAL_MINUTES", "55")
    monkeypatch.setenv("FORCE_POST", "true")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=_minutes_ago_iso(16),
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4715.70,
    )
    d = tg.decide(state, quote=_quote(price=4715.70, ts="2026-05-01T10:06:00Z"), tweet_text="NEW")
    assert d.should_post is False
    assert d.skip_reason == "price_move_below_threshold"
    out = capsys.readouterr().out
    assert "force_summary_due=False" in out
    assert "minutes_since_last" in out
    assert "FORCE_SUMMARY_AFTER_MINUTES" in out


# ── first_post log clarity ────────────────────────────────────────────────────

def test_first_post_log_mentions_no_prior_tweet_state(capsys):
    """first_post guard log must explicitly mention that last_tweet_state.json has no prior state."""
    state = tg.TweetState()  # no prior state at all
    tg.decide(state, quote=_quote(), tweet_text="First tweet ever")
    out = capsys.readouterr().out
    assert "first_post" in out
    assert "no prior tweet state" in out
    assert "last_tweet_state.json" in out


# ── allow_same_price_closed_market_repost interaction ────────────────────────

def test_same_price_closed_market_blocked_by_price_move_threshold_by_default(monkeypatch):
    """
    market_closed_reference same price skips via price_move_below_threshold when:
    - force_summary_due=False
    - allow_same_price_closed_market_repost is not set (default False)
    This matches the SKIP behavior in the 18:46 run.
    """
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    monkeypatch.setenv("FORCE_POST", "true")  # bypasses cooldown only
    monkeypatch.delenv("ALLOW_SAME_PRICE_CLOSED_MARKET_REPOST", raising=False)
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("DIFFERENT TEXT"),
        last_tweet_time_utc=_minutes_ago_iso(16),
        last_provider_timestamp_utc="2026-05-09T18:28:55Z",
        last_price_usd_oz=4715.70,
    )
    quote = _quote(price=4715.70, ts="2026-05-09T18:34:00Z",
                   source_type="market_closed_reference")
    d = tg.decide(state, quote=quote, tweet_text="Market Closed $4,715.70 — new text")
    assert d.should_post is False
    assert d.skip_reason == "price_move_below_threshold"
    assert d.force_summary_due is False


def test_duplicate_text_hash_still_blocks_even_with_force_post_and_force_summary(monkeypatch):
    """
    duplicate_text_hash must block even when force_post=True and force_summary_due=True.
    The 18:46 run had a *different* hash, so this is a separate safety check.
    """
    monkeypatch.setenv("FORCE_POST", "true")
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "1")  # force_summary_due=True
    text = "🔴 Gold Market Is Now Closed\n24K · $4,715.70/oz"
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet(text),
        last_tweet_time_utc=_minutes_ago_iso(120),  # force_summary_due=True
        last_provider_timestamp_utc="2026-05-09T18:28:55Z",
        last_price_usd_oz=4715.70,
    )
    quote = _quote(price=4715.70, ts="2026-05-09T18:34:00Z",
                   source_type="market_closed_reference")
    d = tg.decide(state, quote=quote, tweet_text=text)
    assert d.should_post is False
    assert d.skip_reason == "duplicate_text_hash"


def test_force_summary_due_true_allows_same_price_through_threshold_guard(monkeypatch):
    """
    When force_summary_due=True and ts_changed=True, same-price posts pass price_move threshold.
    This matches the PASS behavior in the 18:29 run.
    """
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    monkeypatch.setenv("FORCE_POST", "true")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD TEXT"),
        last_tweet_time_utc=_minutes_ago_iso(61),  # force_summary_due=True
        last_provider_timestamp_utc="2026-05-09T17:28:55Z",
        last_price_usd_oz=4715.70,
    )
    quote = _quote(price=4715.70, ts="2026-05-09T18:28:55Z",
                   source_type="market_closed_reference")
    d = tg.decide(state, quote=quote, tweet_text="NEW DIFFERENT TEXT")
    assert d.should_post is True
    assert d.force_summary_due is True


def test_scheduled_source_cannot_use_skip_duplicate_bypass(monkeypatch):
    """
    Scheduled runs have no mechanism to set allow_same_price_closed_market_repost.
    The price_move_below_threshold guard fires for them as normal.
    This test confirms tweet_guard.decide() itself has no source-awareness bypass.
    """
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    # Scheduled runs never set FORCE_POST in a way that bypasses price_move
    monkeypatch.delenv("FORCE_POST", raising=False)
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD TEXT"),
        last_tweet_time_utc=_minutes_ago_iso(30),  # within cooldown
        last_provider_timestamp_utc="2026-05-09T17:28:55Z",
        last_price_usd_oz=4715.70,
    )
    quote = _quote(price=4715.70, ts="2026-05-09T18:28:55Z")
    d = tg.decide(state, quote=quote, tweet_text="DIFFERENT TEXT")
    # Cooldown fires first for scheduled runs (no FORCE_POST)
    assert d.should_post is False
    assert d.skip_reason == "cooldown_active"


def test_decision_force_summary_due_populated_on_stale_skip(monkeypatch):
    """force_summary_due is populated even when stale_quote is the skip reason."""
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    monkeypatch.delenv("ALLOW_STALE_TWEET", raising=False)
    state = tg.TweetState(
        last_tweet_text_hash="x",
        last_tweet_time_utc=_minutes_ago_iso(30),
    )
    d = tg.decide(state, quote=_quote(is_fresh=False), tweet_text="any")
    assert d.skip_reason == "stale_quote"
    assert d.force_summary_due is not None  # must always be set


def test_decision_force_summary_due_populated_on_cooldown_skip(monkeypatch):
    """force_summary_due is populated even when cooldown_active is the skip reason."""
    monkeypatch.setenv("FORCE_SUMMARY_AFTER_MINUTES", "60")
    monkeypatch.setenv("MIN_TWEET_INTERVAL_MINUTES", "55")
    state = tg.TweetState(
        last_tweet_text_hash=tg.hash_tweet("OLD"),
        last_tweet_time_utc=_minutes_ago_iso(20),
        last_provider_timestamp_utc="2026-05-01T10:00:00Z",
        last_price_usd_oz=4540.0,
    )
    d = tg.decide(state, quote=_quote(price=4550.0, ts="2026-05-01T10:06:00Z"), tweet_text="NEW")
    assert d.skip_reason == "cooldown_active"
    assert d.force_summary_due is not None
    assert d.minutes_since_last is not None
