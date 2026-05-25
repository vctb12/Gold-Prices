#!/usr/bin/env python3
"""Record gold prices into the Supabase price_history table.

Designed to run via GitHub Actions every 30 minutes. Fetches the current
spot price, computes all karat prices (AED + USD), and batch-inserts them
into the `price_history` table.

Environment variables required:
    SUPABASE_URL            — Supabase project URL
    SUPABASE_SERVICE_KEY    — Service-role key (write access)
    GOLDPRICEZ_API_KEY      — (optional) if the provider needs it

Exit codes:
    0 — success (rows inserted or dry-run)
    1 — fatal error (could not fetch price or connect to Supabase)
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Constants ──────────────────────────────────────────────────────────────
TROY_OZ_GRAMS = 31.1035
AED_PEG = 3.6725

KARATS = {
    24: 1.0,
    22: 22 / 24,
    21: 21 / 24,
    18: 18 / 24,
    14: 14 / 24,
}

# ── Path setup (match repo convention: scripts/python/ on sys.path) ───────
_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT / "scripts" / "python"))

from utils.logger import get_logger  # noqa: E402

log = get_logger("record_price_history")


def get_spot_price() -> float | None:
    """Fetch the current XAU/USD spot price.

    Strategy:
      1. Try reading from data/gold_price.json (written by gold-price-fetch workflow)
      2. Fall back to goldpricez API if available
      3. Return None on failure
    """
    # Strategy 1: Read local JSON (fast, no API call needed)
    gold_json = _REPO_ROOT / "data" / "gold_price.json"
    if gold_json.exists():
        try:
            data = json.loads(gold_json.read_text())
            price = data.get("price_usd") or data.get("spot_usd") or data.get("price")
            if price and float(price) > 0:
                log.info("Spot price from local JSON: $%.2f", float(price))
                return float(price)
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            log.warning("Failed to read local gold_price.json: %s", exc)

    # Strategy 2: Fetch from goldpricez
    try:
        import httpx

        api_key = os.environ.get("GOLDPRICEZ_API_KEY", "")
        url = "https://goldpricez.com/api/rates/currency/usd/measure/ounce"
        headers = {"Accept": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        resp = httpx.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            price = data.get("price") or data.get("gold_price")
            if price and float(price) > 0:
                log.info("Spot price from goldpricez API: $%.2f", float(price))
                return float(price)
    except Exception as exc:
        log.warning("Failed to fetch from goldpricez: %s", exc)

    return None


def compute_karat_prices(spot_usd_per_oz: float) -> list[dict]:
    """Compute per-gram prices for all karats in both AED and USD."""
    rows = []
    now = datetime.now(timezone.utc).isoformat()

    for karat, purity in KARATS.items():
        usd_per_gram = (spot_usd_per_oz / TROY_OZ_GRAMS) * purity
        aed_per_gram = usd_per_gram * AED_PEG

        rows.append({
            "recorded_at": now,
            "karat": karat,
            "price_aed": round(aed_per_gram, 4),
            "price_usd": round(usd_per_gram, 4),
            "source": "goldpricez",
            "is_retail": False,
        })

    return rows


def insert_to_supabase(rows: list[dict]) -> bool:
    """Batch-insert price rows into Supabase price_history table."""
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")

    if not url or not key:
        log.error("SUPABASE_URL or SUPABASE_SERVICE_KEY not set")
        return False

    try:
        from supabase import create_client

        client = create_client(url, key)
        result = client.table("price_history").insert(rows).execute()
        log.info("Inserted %d rows into price_history", len(result.data or []))
        return True
    except Exception as exc:
        log.error("Supabase insert failed: %s", exc)
        return False


def main() -> int:
    """Main entrypoint."""
    dry_run = os.environ.get("DRY_RUN", "false").lower() == "true"

    log.info("=== Price History Recorder ===")
    log.info("Dry run: %s", dry_run)

    # Fetch spot price
    spot = get_spot_price()
    if spot is None or spot <= 0:
        log.error("Could not obtain a valid spot price")
        return 1

    # Compute all karat prices
    rows = compute_karat_prices(spot)
    log.info("Computed %d karat price rows (spot: $%.2f/oz)", len(rows), spot)

    for row in rows:
        log.info(
            "  %dK: AED %.4f/g | USD %.4f/g",
            row["karat"],
            row["price_aed"],
            row["price_usd"],
        )

    if dry_run:
        log.info("Dry run — skipping Supabase insert")
        return 0

    # Insert to Supabase
    success = insert_to_supabase(rows)
    if not success:
        log.error("Failed to write to Supabase")
        return 1

    log.info("✅ Price history recorded successfully")
    return 0


if __name__ == "__main__":
    sys.exit(main())
