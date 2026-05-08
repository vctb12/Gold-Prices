#!/usr/bin/env python3
"""Provider scorecard generator.

Reads ``data/provider_bakeoff_log.jsonl`` (or ``--input``) and writes a
scoreboard JSON to ``data/provider_scorecard.json`` (or ``--output``).

Score weighting:
  * 35% update frequency (unique timestamps/hr, longest frozen interval)
  * 25% success rate / error mix
  * 20% freshness (median + p95)
  * 10% response time
  * 10% quota / rate-limit safety / terms

Recommendation labels: primary_candidate / secondary_candidate /
fallback_only / avoid.

Note: real update frequency depends on market hours. The scorecard
records both ``unique_prices_per_hour`` and ``unique_timestamps_per_hour``
separately so a flat-price market does not penalize a provider whose
timestamp keeps advancing.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_INPUT = _REPO_ROOT / "data" / "provider_bakeoff_log.jsonl"
DEFAULT_OUTPUT = _REPO_ROOT / "data" / "provider_scorecard.json"


def _parse_iso_z(s: Optional[str]) -> Optional[datetime]:
    if not s or not isinstance(s, str):
        return None
    raw = s
    if raw.endswith("Z"):
        raw = raw[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _percentile(values: List[float], pct: float) -> Optional[float]:
    if not values:
        return None
    s = sorted(values)
    if len(s) == 1:
        return float(s[0])
    k = (len(s) - 1) * pct
    lo = math.floor(k)
    hi = math.ceil(k)
    if lo == hi:
        return float(s[int(k)])
    frac = k - lo
    return float(s[lo] + (s[hi] - s[lo]) * frac)


def _median(values: List[float]) -> Optional[float]:
    return _percentile(values, 0.5)


def _read_log(path: Path) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if not path.exists():
        return rows
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except ValueError:
                continue
    return rows


def _provider_stats(name: str, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    rows = sorted(rows, key=lambda r: r.get("attempted_at_utc") or "")
    total = len(rows)
    successes = [r for r in rows if r.get("success")]
    failures = [r for r in rows if not r.get("success")]
    success_count = len(successes)
    success_rate = (success_count / total) if total else 0.0

    error_counts: Dict[str, int] = defaultdict(int)
    http_429 = 0
    auth_errors = 0
    malformed = 0
    missing_ts = 0
    missing_price = 0
    stale_count = 0
    for r in rows:
        if r.get("success"):
            if r.get("provider_timestamp_utc") is None:
                missing_ts += 1
            if r.get("is_fresh") is False and r.get("provider_timestamp_utc"):
                stale_count += 1
            continue
        cat = r.get("error_category") or "unknown_error"
        error_counts[cat] += 1
        if r.get("http_status") == 429 or cat == "rate_limited":
            http_429 += 1
        if cat == "auth_error" or r.get("http_status") in (401, 403):
            auth_errors += 1
        if cat == "malformed_json":
            malformed += 1
        if cat == "missing_timestamp":
            missing_ts += 1
        if cat == "missing_price":
            missing_price += 1
        if cat == "stale_timestamp":
            stale_count += 1

    response_times = [
        float(r["response_time_ms"]) for r in rows
        if isinstance(r.get("response_time_ms"), (int, float))
    ]
    freshness_values = [
        float(r["freshness_seconds"]) for r in successes
        if isinstance(r.get("freshness_seconds"), (int, float))
    ]
    usable_count = sum(1 for r in rows if r.get("usable_for_posting") is True)
    usable_rate = (usable_count / total) if total else 0.0
    latest_row = rows[-1] if rows else {}

    # Per-hour bucket counts of unique price/timestamp values.
    by_hour_prices: Dict[str, set] = defaultdict(set)
    by_hour_ts: Dict[str, set] = defaultdict(set)
    for r in successes:
        attempted = _parse_iso_z(r.get("attempted_at_utc"))
        if attempted is None:
            continue
        bucket = attempted.strftime("%Y-%m-%dT%H")
        if r.get("price_usd_oz") is not None:
            by_hour_prices[bucket].add(round(float(r["price_usd_oz"]), 4))
        if r.get("provider_timestamp_utc"):
            by_hour_ts[bucket].add(r["provider_timestamp_utc"])

    unique_prices_per_hour = (
        sum(len(v) for v in by_hour_prices.values()) / len(by_hour_prices)
        if by_hour_prices else 0.0
    )
    unique_ts_per_hour = (
        sum(len(v) for v in by_hour_ts.values()) / len(by_hour_ts)
        if by_hour_ts else 0.0
    )

    # Longest frozen interval (consecutive identical successive samples).
    longest_frozen_price = 0.0
    longest_frozen_ts = 0.0
    avg_secs_between_price_changes: Optional[float] = None
    avg_secs_between_ts_changes: Optional[float] = None
    if len(successes) >= 2:
        last_price = None
        last_price_change_at: Optional[datetime] = None
        last_ts = None
        last_ts_change_at: Optional[datetime] = None
        cur_price_run_start: Optional[datetime] = None
        cur_ts_run_start: Optional[datetime] = None
        price_change_intervals: List[float] = []
        ts_change_intervals: List[float] = []

        for r in successes:
            attempted = _parse_iso_z(r.get("attempted_at_utc"))
            if attempted is None:
                continue
            price = r.get("price_usd_oz")
            ts = r.get("provider_timestamp_utc")
            # Price stream
            if price is not None:
                if last_price is None or round(float(price), 4) != round(float(last_price), 4):
                    if last_price_change_at is not None:
                        delta = (attempted - last_price_change_at).total_seconds()
                        price_change_intervals.append(delta)
                        if delta > longest_frozen_price:
                            longest_frozen_price = delta
                    last_price = price
                    last_price_change_at = attempted
                    cur_price_run_start = attempted
                else:
                    if cur_price_run_start is not None:
                        run = (attempted - cur_price_run_start).total_seconds()
                        if run > longest_frozen_price:
                            longest_frozen_price = run
            # Timestamp stream
            if ts is not None:
                if last_ts is None or ts != last_ts:
                    if last_ts_change_at is not None:
                        delta = (attempted - last_ts_change_at).total_seconds()
                        ts_change_intervals.append(delta)
                        if delta > longest_frozen_ts:
                            longest_frozen_ts = delta
                    last_ts = ts
                    last_ts_change_at = attempted
                    cur_ts_run_start = attempted
                else:
                    if cur_ts_run_start is not None:
                        run = (attempted - cur_ts_run_start).total_seconds()
                        if run > longest_frozen_ts:
                            longest_frozen_ts = run
        if price_change_intervals:
            avg_secs_between_price_changes = sum(price_change_intervals) / len(price_change_intervals)
        if ts_change_intervals:
            avg_secs_between_ts_changes = sum(ts_change_intervals) / len(ts_change_intervals)

    return {
        "provider": name,
        "total_attempts": total,
        "successful_attempts": success_count,
        "failure_count": len(failures),
        "success_rate": round(success_rate, 4),
        "error_categories": dict(error_counts),
        "http_429_count": http_429,
        "auth_error_count": auth_errors,
        "malformed_response_count": malformed,
        "stale_response_count": stale_count,
        "missing_timestamp_count": missing_ts,
        "missing_price_count": missing_price,
        "usable_for_posting_count": usable_count,
        "usable_for_posting_rate": round(usable_rate, 4),
        "average_response_time_ms": round(sum(response_times) / len(response_times), 1)
            if response_times else None,
        "p95_response_time_ms": round(_percentile(response_times, 0.95), 1)
            if response_times else None,
        "unique_prices_per_hour": round(unique_prices_per_hour, 3),
        "unique_timestamps_per_hour": round(unique_ts_per_hour, 3),
        "average_seconds_between_price_changes": (
            round(avg_secs_between_price_changes, 1)
            if avg_secs_between_price_changes is not None else None
        ),
        "average_seconds_between_timestamp_changes": (
            round(avg_secs_between_ts_changes, 1)
            if avg_secs_between_ts_changes is not None else None
        ),
        "longest_frozen_price_seconds": round(longest_frozen_price, 1),
        "longest_frozen_timestamp_seconds": round(longest_frozen_ts, 1),
        "freshness_median_seconds": round(_median(freshness_values), 1)
            if freshness_values else None,
        "freshness_p95_seconds": round(_percentile(freshness_values, 0.95), 1)
            if freshness_values else None,
        "latest_parsed_xau_usd_oz": latest_row.get("parsed_xau_usd_oz", latest_row.get("price_usd_oz")),
        "latest_provider_timestamp_utc": latest_row.get("provider_timestamp_utc"),
        "latest_local_fetch_timestamp_utc": latest_row.get("local_fetch_timestamp_utc", latest_row.get("fetched_at_utc")),
        "latest_freshness_age_seconds": latest_row.get("freshness_age_seconds", latest_row.get("freshness_seconds")),
        "latest_price_changed": latest_row.get("did_price_change_vs_previous_provider_sample"),
        "latest_usable_for_posting": latest_row.get("usable_for_posting"),
    }


def _score(stats: Dict[str, Any]) -> float:
    """Weighted score in [0, 100]; higher is better."""
    if stats["total_attempts"] == 0 or stats.get("successful_attempts", 0) == 0:
        return 0.0

    # 35% update frequency: more unique timestamps/hour and shorter
    # frozen intervals are better. We reward up to 10 unique ts/hour as
    # full credit (matching the 6-minute polling cadence).
    uts = stats.get("unique_timestamps_per_hour") or 0.0
    freq_score = min(1.0, uts / 10.0)
    # Penalize long frozen intervals: 0 frozen → 1.0; ≥45min frozen → 0.0
    longest_frozen_min = (stats.get("longest_frozen_timestamp_seconds") or 0.0) / 60.0
    frozen_penalty = max(0.0, 1.0 - (longest_frozen_min / 45.0))
    update_freq = 0.35 * (0.6 * freq_score + 0.4 * frozen_penalty)

    # 25% success rate
    success_component = 0.25 * float(stats.get("success_rate") or 0.0)

    # 20% freshness — lower median & p95 is better; cap at 1800s.
    fmed = stats.get("freshness_median_seconds")
    fp95 = stats.get("freshness_p95_seconds")

    def _fresh_sub(x: Optional[float]) -> float:
        if x is None:
            return 0.0
        return max(0.0, 1.0 - (x / 1800.0))
    freshness_component = 0.20 * (0.5 * _fresh_sub(fmed) + 0.5 * _fresh_sub(fp95))

    # 10% response time — under 500ms = full, over 5000ms = zero.
    rt = stats.get("average_response_time_ms")
    if rt is None:
        rt_score = 0.0
    elif rt <= 500:
        rt_score = 1.0
    elif rt >= 5000:
        rt_score = 0.0
    else:
        rt_score = 1.0 - ((rt - 500) / 4500.0)
    response_component = 0.10 * rt_score

    # 10% quota/terms safety: penalize 429s + auth errors heavily.
    err_total = (
        stats.get("http_429_count", 0)
        + stats.get("auth_error_count", 0)
        + stats.get("malformed_response_count", 0)
    )
    rate_penalty = max(0.0, 1.0 - (err_total / max(1, stats["total_attempts"])) * 4.0)
    quota_component = 0.10 * rate_penalty

    return round(100.0 * (update_freq + success_component + freshness_component
                          + response_component + quota_component), 2)


def _recommendation(stats: Dict[str, Any], score: float) -> Dict[str, str]:
    """Map score + key signals to a recommendation label + reason."""
    sr = stats.get("success_rate") or 0.0
    longest_frozen_min = (stats.get("longest_frozen_timestamp_seconds") or 0.0) / 60.0
    auth = stats.get("auth_error_count", 0)
    quota = stats.get("http_429_count", 0)
    total = stats.get("total_attempts", 0)
    succ = stats.get("successful_attempts", 0)

    if total == 0:
        return {"label": "avoid", "reason": "no samples collected yet — bakeoff has not exercised this provider"}
    if succ == 0:
        return {"label": "avoid", "reason": "0 successful samples; provider not usable as configured"}
    if auth >= 3 or quota >= 3:
        return {"label": "avoid", "reason": f"{auth} auth-error(s) and {quota} rate-limit(s) — quota or terms not viable"}

    reason_bits: List[str] = [f"score={score:.1f}", f"success={sr:.0%}"]
    if longest_frozen_min:
        reason_bits.append(f"longest frozen ts {longest_frozen_min:.1f}min")

    if score >= 75 and sr >= 0.9 and longest_frozen_min < 15:
        return {"label": "primary_candidate", "reason": "; ".join(reason_bits)}
    if score >= 55 and sr >= 0.8 and longest_frozen_min < 30:
        return {"label": "secondary_candidate", "reason": "; ".join(reason_bits)}
    if longest_frozen_min >= 30:
        return {"label": "fallback_only",
                "reason": "frozen-timestamp risk causes duplicate-post issues for the X bot — " + "; ".join(reason_bits)}
    return {"label": "fallback_only", "reason": "; ".join(reason_bits)}


def generate_scorecard(log_path: Path) -> Dict[str, Any]:
    rows = _read_log(log_path)
    by_provider: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rows:
        if isinstance(r, dict) and r.get("provider"):
            by_provider[r["provider"]].append(r)

    providers_out: List[Dict[str, Any]] = []
    for name, prov_rows in sorted(by_provider.items()):
        s = _provider_stats(name, prov_rows)
        score = _score(s)
        recommendation = _recommendation(s, score)
        s["score"] = score
        s["recommendation"] = recommendation["label"]
        s["recommendation_reason"] = recommendation["reason"]
        providers_out.append(s)

    providers_out.sort(key=lambda x: x["score"], reverse=True)
    for rank, p in enumerate(providers_out, start=1):
        p["rank"] = rank

    total_samples = sum(p["total_attempts"] for p in providers_out)
    return {
        "schema_version": 1,
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "input_log": str(log_path),
        "total_samples": total_samples,
        "providers": providers_out,
        "scoring_weights": {
            "update_frequency_pct": 35,
            "success_rate_pct": 25,
            "freshness_pct": 20,
            "response_time_pct": 10,
            "quota_terms_pct": 10,
        },
        "notes": (
            "Real update frequency depends on market hours. "
            "unique_prices_per_hour can drop in low-volatility windows; "
            "use unique_timestamps_per_hour and longest_frozen_timestamp_seconds "
            "for freeze detection."
        ),
    }


def write_scorecard(sc: Dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(sc, indent=2) + "\n", encoding="utf-8")


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Generate provider scorecard from bakeoff log")
    p.add_argument("--input", type=str, default=str(DEFAULT_INPUT))
    p.add_argument("--output", type=str, default=str(DEFAULT_OUTPUT))
    args = p.parse_args(argv)

    log_path = Path(args.input)
    out_path = Path(args.output)
    sc = generate_scorecard(log_path)
    write_scorecard(sc, out_path)
    print(f"Scorecard written: {out_path} ({sc['total_samples']} samples, {len(sc['providers'])} providers)")
    for entry in sc["providers"]:
        print(f"  {entry['rank']}. {entry['provider']:<22} "
              f"score={entry['score']:>6.2f}  {entry['recommendation']:<20}  "
              f"({entry['successful_attempts']}/{entry['total_attempts']} ok)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
