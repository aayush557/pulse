"""
Model 2 — Peer-Group Z-Scores

Partners are segmented into peer groups by:
  - MCC risk level (H / M / L)
  - Volume tier (low / medium / high)
  - Dominant payment method (card / ach / mixed)

Within each peer group we compute the mean and std of each rate, then
z-score every partner.  A roofing company (MCC-H) with a 15 % decline
rate is normal among peers; a SaaS company (MCC-L) at 15 % is 3σ out.
"""

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .. import config


@dataclass
class PeerZScoreResult:
    partner_id: str
    rate_type: str
    observed_rate: float
    z_score: float
    peer_group: str
    peer_mean: float
    peer_std: float
    n_peers: int


class PeerZScoreModel:

    def __init__(self) -> None:
        self._peer_stats: pd.DataFrame | None = None

    # ── fitting ──────────────────────────────────────────────────────

    def fit(self, partner_features: pd.DataFrame) -> None:
        """Compute per-peer-group statistics.

        Expects columns:
            partner_id, mcc_risk_level, total_txns, card_pct,
            decline_rate, return_rate, chargeback_rate
        """
        df = partner_features.copy()
        df["volume_tier"] = pd.cut(
            df["total_txns"],
            bins=config.VOLUME_TIER_BINS,
            labels=config.VOLUME_TIER_LABELS,
            right=False,
        )
        df["method_group"] = np.where(
            df["card_pct"] >= 0.8, "card",
            np.where(df["card_pct"] <= 0.2, "ach", "mixed"),
        )
        df["peer_group"] = (
            df["mcc_risk_level"].astype(str) + "|"
            + df["volume_tier"].astype(str) + "|"
            + df["method_group"]
        )

        rate_cols = ["decline_rate", "return_rate", "chargeback_rate"]
        agg = {c: ["mean", "std", "count"] for c in rate_cols}
        stats = df.groupby("peer_group").agg(agg)
        stats.columns = ["_".join(c) for c in stats.columns]
        stats = stats.reset_index()

        self._peer_stats = stats
        self._partner_peers = df[["partner_id", "peer_group"]].copy()
        self._partner_rates = df[["partner_id", "peer_group"] + rate_cols].copy()

    # ── scoring ──────────────────────────────────────────────────────

    def score(self, partner_features: pd.DataFrame) -> list[PeerZScoreResult]:
        if self._peer_stats is None:
            raise RuntimeError("Model not fitted. Call fit() first.")

        df = partner_features.copy()
        df["volume_tier"] = pd.cut(
            df["total_txns"],
            bins=config.VOLUME_TIER_BINS,
            labels=config.VOLUME_TIER_LABELS,
            right=False,
        )
        df["method_group"] = np.where(
            df["card_pct"] >= 0.8, "card",
            np.where(df["card_pct"] <= 0.2, "ach", "mixed"),
        )
        df["peer_group"] = (
            df["mcc_risk_level"].astype(str) + "|"
            + df["volume_tier"].astype(str) + "|"
            + df["method_group"]
        )

        merged = df.merge(self._peer_stats, on="peer_group", how="left")

        results: list[PeerZScoreResult] = []
        for _, row in merged.iterrows():
            for rate_type in ("decline", "return", "chargeback"):
                col = f"{rate_type}_rate"
                mean_col = f"{col}_mean"
                std_col = f"{col}_std"
                count_col = f"{col}_count"

                observed = row[col]
                peer_mean = row.get(mean_col, np.nan)
                peer_std = row.get(std_col, np.nan)
                n_peers = int(row.get(count_col, 0))

                if pd.isna(peer_std) or peer_std == 0 or n_peers < 3:
                    z = 0.0
                else:
                    z = (observed - peer_mean) / peer_std

                results.append(PeerZScoreResult(
                    partner_id=str(row["partner_id"]),
                    rate_type=rate_type,
                    observed_rate=float(observed),
                    z_score=float(z),
                    peer_group=str(row["peer_group"]),
                    peer_mean=float(peer_mean) if not pd.isna(peer_mean) else 0.0,
                    peer_std=float(peer_std) if not pd.isna(peer_std) else 0.0,
                    n_peers=n_peers,
                ))
        return results
