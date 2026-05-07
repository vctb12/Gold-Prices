"""
scripts/python/utils/price_fetcher.py

Reads the canonical gold-price payload from ``data/gold_price.json``
(written every 6 minutes by ``scripts/fetch_gold_price.py`` against
goldpricez.com) and reshapes it into the dict the rest of the
twitter-bot code expects.

This module intentionally no longer calls any external gold-price API.
All live fetching is centralized in the gold-price-fetch workflow so
that the key (``GOLDPRICEZ_API_KEY``) is used from one place only.
"""

import json
from pathlib import Path
from typing import Any, Dict, List

from utils.logger import get_logger

log = get_logger("price_fetcher")

# ── Constants ────────────────────────────────────────────────────────────────
AED_PEG = 3.6725
TROY_OZ_GRAMS = 31.1035

# Repo root: scripts/python/utils/price_fetcher.py → go up 3 levels.
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
GOLD_PRICE_FILE = _REPO_ROOT / "data" / "gold_price.json"

# ── Config paths ─────────────────────────────────────────────────────────────
_CONFIG_DIR = Path(__file__).resolve().parent.parent.parent / "config" / "twitter_bot"


class PriceFetchError(Exception):
    """Raised when the price cannot be loaded from the data file."""


def _load_json(filename: str) -> Any:
    filepath = _CONFIG_DIR / filename
    with open(filepath, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _get_karats() -> List[Dict[str, Any]]:
    data = _load_json("karat_weights.json")
    return data["karats"]


def fetch_gold_price() -> Dict[str, Any]:
    """Read the latest gold price from ``data/gold_price.json``.

    Returns a dictionary:
        spot_usd        – USD price per troy ounce
        change_pct      – 0.0 (not computed here — the fetch workflow does not
                          currently track a previous close; callers that need
                          a delta should compare against Supabase themselves)
        open_usd        – day low (best proxy available from goldpricez ``all``)
        high_usd        – day high
        low_usd         – day low
        prev_close_usd  – None (not provided by goldpricez ``all`` endpoint)
        timestamp       – fetched_at_utc from the data file (ISO-8601, Z suffix)
        karat_prices    – list of per-karat per-gram prices (USD + AED)
        aed_rate        – the AED peg rate used
    """
    if not GOLD_PRICE_FILE.exists():
        raise PriceFetchError(
            f"{GOLD_PRICE_FILE} not found. The gold-price-fetch workflow "
            "must run first to populate it."
        )

    try:
        raw = json.loads(GOLD_PRICE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise PriceFetchError(f"Failed to read {GOLD_PRICE_FILE}: {exc}")

    if not isinstance(raw, dict):
        raise PriceFetchError("gold_price.json is not a JSON object")

    gold = raw.get("gold") or {}
    spot = raw.get("xau_usd_per_oz")
    if not isinstance(spot, (int, float)) or spot <= 0:
        spot = gold.get("ounce_usd")
    if not isinstance(spot, (int, float)) or spot <= 0:
        raise PriceFetchError(
            f"Invalid or missing spot price (xau_usd_per_oz / gold.ounce_usd) in {GOLD_PRICE_FILE}: {raw}"
        )
    spot = float(spot)

    day_high = gold.get("day_high_usd")
    day_low = gold.get("day_low_usd")
    timestamp = raw.get("timestamp_utc") or raw.get("fetched_at_utc")

    # Per-karat per-gram prices. Prefer whatever is already in the payload
    # for AED, compute USD locally from spot so callers that only care
    # about USD still work.
    karats_aed = dict(raw.get("karats_aed_per_gram") or {})
    aed_24k = raw.get("aed_per_gram_24k")
    if isinstance(aed_24k, (int, float)) and aed_24k > 0:
        for code, purity in (("24k", 1.0), ("22k", 22 / 24), ("21k", 21 / 24), ("18k", 18 / 24)):
            karats_aed.setdefault(code, float(aed_24k) * purity)
    karats = _get_karats()
    karat_prices = []
    for k in karats:
        usd_per_gram = (spot / TROY_OZ_GRAMS) * k["purity"]
        # Prefer the committed AED value (already rounded) when available,
        # otherwise fall back to the peg-based calculation.
        aed_per_gram = karats_aed.get(k["code"])
        if not isinstance(aed_per_gram, (int, float)) or aed_per_gram <= 0:
            aed_per_gram = usd_per_gram * AED_PEG
        karat_prices.append(
            {
                "code": k["code"],
                "label": k["label"],
                "purity": k["purity"],
                "usd_per_gram": round(usd_per_gram, 2),
                "aed_per_gram": round(float(aed_per_gram), 2),
            }
        )

    result = {
        "spot_usd": round(spot, 2),
        "change_pct": 0.0,
        "open_usd": round(day_low, 2) if day_low else None,
        "high_usd": round(day_high, 2) if day_high else None,
        "low_usd": round(day_low, 2) if day_low else None,
        "prev_close_usd": None,
        "timestamp": timestamp,
        "karat_prices": karat_prices,
        "aed_rate": AED_PEG,
    }

    log.info("Price loaded from data file: $%.2f/oz", spot)
    return result
