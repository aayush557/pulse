"""
Data loader — aggregates transaction-level parquet into the shapes
each model expects.  Designed to swap to a live DB query later without
changing the model interfaces.
"""

import numpy as np
import pandas as pd

from . import config


def load_parquet(path: str | None = None) -> pd.DataFrame:
    p = path or str(config.PARQUET_PATH)
    return pd.read_parquet(
        p,
        columns=[
            "parent_idx", "paypointid", "id_trans", "transactiontime",
            "trans_status", "status_category", "method",
            "return", "chargeback",
            "total_amount", "mcc_risk_level",
        ],
    )


def build_partner_stats(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate to one row per partner with counts for Beta-Binomial + Peer Z."""
    agg = df.groupby("parent_idx").agg(
        total_txns=("id_trans", "count"),
        n_paypoints=("paypointid", "nunique"),
        total_amount=("total_amount", "sum"),
        declined_count=("status_category", lambda x: (x == "Failed").sum()),
        return_count=("return", lambda x: x.notna().sum()),
        chargeback_count=("chargeback", lambda x: x.notna().sum()),
        card_count=("method", lambda x: (x == "card").sum()),
        mcc_risk_level=("mcc_risk_level", lambda x: x.mode().iloc[0] if len(x.mode()) > 0 else "M"),
    ).reset_index()

    agg = agg.rename(columns={"parent_idx": "partner_id"})
    agg["decline_rate"] = agg["declined_count"] / agg["total_txns"]
    agg["return_rate"] = agg["return_count"] / agg["total_txns"]
    agg["chargeback_rate"] = agg["chargeback_count"] / agg["total_txns"]
    agg["card_pct"] = agg["card_count"] / agg["total_txns"]

    return agg


def build_weekly_partner_rates(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate to one row per partner per ISO week."""
    df = df.copy()
    df["week"] = df["transactiontime"].dt.isocalendar().week.astype(int)
    df["year"] = df["transactiontime"].dt.isocalendar().year.astype(int)
    df["year_week"] = df["year"].astype(str) + "-W" + df["week"].astype(str).str.zfill(2)

    agg = df.groupby(["parent_idx", "year_week"]).agg(
        total_txns=("id_trans", "count"),
        declined_count=("status_category", lambda x: (x == "Failed").sum()),
        return_count=("return", lambda x: x.notna().sum()),
        chargeback_count=("chargeback", lambda x: x.notna().sum()),
    ).reset_index()

    agg = agg.rename(columns={"parent_idx": "partner_id", "year_week": "week"})
    return agg


def build_partner_org_names(df: pd.DataFrame) -> dict[str, str]:
    """Quick lookup: partner_id → org_name (from the raw txn data if available)."""
    # org_name isn't in the lean column set, so we return empty;
    # the pipeline will enrich from a second pass if needed.
    return {}
