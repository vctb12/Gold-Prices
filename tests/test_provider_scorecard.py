"""Tests for scripts/python/provider_scorecard.py."""
import json
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT / "scripts" / "python"))

from provider_scorecard import generate_scorecard, write_scorecard  # noqa: E402


def _row(provider, attempted, success=True, price=4550.0, ts="2026-05-01T10:00:00Z",
         response_ms=220, fresh=True, error=None, http=200):
    return {
        "run_id": attempted,
        "provider": provider,
        "attempted_at_utc": attempted,
        "success": success,
        "http_status": http,
        "response_time_ms": response_ms,
        "raw_symbol": "XAU/USD",
        "source_type": "spot_reference",
        "price_usd_oz": price if success else None,
        "provider_timestamp_utc": ts if success else None,
        "fetched_at_utc": attempted,
        "freshness_seconds": 10 if success else None,
        "freshness_age_seconds": 10 if success else None,
        "is_fresh": fresh if success else False,
        "did_price_change_vs_previous_provider_sample": None,
        "did_timestamp_change_vs_previous_provider_sample": None,
        "did_provider_sample_change_vs_previous_provider_sample": None,
        "local_fetch_timestamp_utc": attempted,
        "parsed_xau_usd_oz": price if success else None,
        "usable_for_posting": bool(success and fresh and ts),
        "rate_limit_remaining": None,
        "rate_limit_reset": None,
        "error_category": error,
        "error_message": None,
        "raw_sample_hash": None,
    }


def test_scorecard_ranks_fresh_changing_provider_above_frozen(tmp_path: Path):
    log_path = tmp_path / "log.jsonl"
    rows = []
    # provider A: timestamp+price advances every sample (good)
    base_t = "2026-05-01T10:0"
    for i in range(10):
        ts = f"2026-05-01T10:{i:02d}:00Z"
        attempted = f"2026-05-01T10:{i:02d}:10Z"
        rows.append(_row("good_provider", attempted, price=4550.0 + i, ts=ts))

    # provider B: timestamp frozen across all samples (the GoldPriceZ symptom)
    for i in range(10):
        attempted = f"2026-05-01T10:{i:02d}:10Z"
        rows.append(_row("frozen_provider", attempted, price=4550.0,
                         ts="2026-05-01T09:30:00Z"))  # never changes

    log_path.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    sc = generate_scorecard(log_path)
    assert sc["total_samples"] == 20

    by_name = {p["provider"]: p for p in sc["providers"]}
    assert by_name["good_provider"]["score"] > by_name["frozen_provider"]["score"]
    assert by_name["frozen_provider"]["longest_frozen_timestamp_seconds"] > 0
    assert by_name["good_provider"]["unique_timestamps_per_hour"] >= 5
    assert by_name["good_provider"]["usable_for_posting_count"] == 10
    assert by_name["good_provider"]["latest_usable_for_posting"] is True


def test_scorecard_avoids_provider_with_only_failures(tmp_path: Path):
    log_path = tmp_path / "log.jsonl"
    rows = [
        _row("dead_provider", f"2026-05-01T10:{i:02d}:10Z",
             success=False, error="auth_error", http=401)
        for i in range(5)
    ]
    log_path.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    sc = generate_scorecard(log_path)
    by_name = {p["provider"]: p for p in sc["providers"]}
    assert by_name["dead_provider"]["score"] == 0.0
    assert by_name["dead_provider"]["recommendation"] == "avoid"


def test_scorecard_write_writes_valid_json(tmp_path: Path):
    sc = {"schema_version": 1, "providers": []}
    out = tmp_path / "sc.json"
    write_scorecard(sc, out)
    assert json.loads(out.read_text()) == sc
