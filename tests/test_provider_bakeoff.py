"""Tests for scripts/python/provider_bakeoff.py."""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT / "scripts" / "python"))

import provider_bakeoff as pb  # noqa: E402
from gold_providers.base import make_error, make_success  # noqa: E402


def _success_result(price=4550.0, timestamp_dt=None, fetched_at_dt=None):
    fetched_at_dt = fetched_at_dt or datetime(2026, 5, 1, 10, 6, 0, tzinfo=timezone.utc)
    timestamp_dt = timestamp_dt or (fetched_at_dt - timedelta(seconds=30))
    return make_success(
        provider="twelvedata_xauusd",
        provider_url="https://twelvedata.com/",
        raw_symbol="XAU/USD",
        quote_currency="USD",
        price_usd_oz=price,
        timestamp_dt=timestamp_dt,
        timestamp_source="provider",
        fetched_at_dt=fetched_at_dt,
        response_time_ms=220,
        http_status=200,
    )


def test_run_round_records_posting_usable_fields(tmp_path: Path, monkeypatch):
    log_path = tmp_path / "provider_bakeoff_log.jsonl"
    log_path.write_text(
        json.dumps(
            {
                "provider": "twelvedata_xauusd",
                "price_usd_oz": 4540.0,
                "provider_timestamp_utc": "2026-05-01T10:00:00Z",
            }
        )
        + "\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(pb, "fetch_provider", lambda _name: _success_result(price=4555.0))

    rows = pb.run_round(["twelvedata_xauusd"], log_path, log_raw=False)

    assert len(rows) == 1
    row = rows[0]
    assert row["success"] is True
    assert row["latency_ms"] == 220
    assert row["parsed_xau_usd_oz"] == 4555.0
    assert row["provider_timestamp_utc"] == "2026-05-01T10:05:30Z"
    assert row["local_fetch_timestamp_utc"] == "2026-05-01T10:06:00Z"
    assert row["freshness_age_seconds"] == 30
    assert row["did_price_change_vs_previous_provider_sample"] is True
    assert row["did_provider_sample_change_vs_previous_provider_sample"] is True
    assert row["usable_for_posting"] is True


def test_run_round_records_provider_parse_failure(tmp_path: Path, monkeypatch):
    log_path = tmp_path / "provider_bakeoff_log.jsonl"
    monkeypatch.setattr(
        pb,
        "fetch_provider",
        lambda _name: make_error("goldpricez", "missing_price", "missing parsed price", http_status=200),
    )

    rows = pb.run_round(["goldpricez"], log_path, log_raw=False)

    assert len(rows) == 1
    row = rows[0]
    assert row["success"] is False
    assert row["error_category"] == "missing_price"
    assert row["parsed_xau_usd_oz"] is None
    assert row["usable_for_posting"] is False
