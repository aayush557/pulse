"""
Orchestration pipeline — runs all three models, merges their outputs
into a single partner-level risk assessment.
"""

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from . import config
from .data_loader import build_partner_stats, build_weekly_partner_rates, load_parquet
from .models import BetaBinomialModel, PeerZScoreModel, TimeSeriesChangeModel


@dataclass
class PartnerRiskScore:
    partner_id: str
    combined_score: float              # 0–100
    tier: str                          # "elevated" | "watch" | "normal"

    # ── per-rate breakdown ───────────────────────────────────────────
    decline: "RateDetail | None" = None
    returns: "RateDetail | None" = None
    chargeback: "RateDetail | None" = None

    n_paypoints: int = 0
    total_txns: int = 0
    total_amount: float = 0.0


@dataclass
class RateDetail:
    observed_rate: float

    # Beta-Binomial
    posterior_mean: float
    ci_lower: float
    ci_upper: float
    p_elevated: float

    # Peer Z-Score
    z_score: float
    peer_group: str
    peer_mean: float

    # Time-Series
    rolling_z: float
    cusum_alarm: bool
    trend_direction: str
    weekly_rates: list[float] = field(default_factory=list)


class PartnerRiskPipeline:
    """Fit all models, produce combined scores."""

    def __init__(self) -> None:
        self.bb = BetaBinomialModel()
        self.pz = PeerZScoreModel()
        self.ts = TimeSeriesChangeModel()
        self._scores: list[PartnerRiskScore] = []

    # ── public API ───────────────────────────────────────────────────

    def run(self, parquet_path: str | None = None) -> list[PartnerRiskScore]:
        df = load_parquet(parquet_path)
        partner_stats = build_partner_stats(df)
        weekly = build_weekly_partner_rates(df)

        # Fit
        self.bb.fit(partner_stats)
        self.pz.fit(partner_stats)
        self.ts.fit(weekly)

        # Score
        bb_results = self.bb.score(partner_stats, thresholds={
            "decline": config.DECLINE_THRESHOLD,
            "return": config.RETURN_THRESHOLD,
            "chargeback": config.CHARGEBACK_THRESHOLD,
        })
        pz_results = self.pz.score(partner_stats)
        ts_results = self.ts.score()

        # Index results by (partner_id, rate_type) for fast merge
        bb_idx = {(r.partner_id, r.rate_type): r for r in bb_results}
        pz_idx = {(r.partner_id, r.rate_type): r for r in pz_results}
        ts_idx = {(r.partner_id, r.rate_type): r for r in ts_results}

        scores: list[PartnerRiskScore] = []
        for _, row in partner_stats.iterrows():
            pid = str(row["partner_id"])
            details: dict[str, RateDetail] = {}

            sub_scores: list[float] = []
            for rate_type, detail_key in [
                ("decline", "decline"),
                ("return", "returns"),
                ("chargeback", "chargeback"),
            ]:
                bb = bb_idx.get((pid, rate_type))
                pz = pz_idx.get((pid, rate_type))
                ts = ts_idx.get((pid, rate_type))

                if bb is None and pz is None and ts is None:
                    continue

                # Normalize each model's signal to 0–100
                bb_signal = min(bb.p_elevated * 100, 100) if bb else 0.0
                pz_signal = min(max(pz.z_score, 0) / 4.0 * 100, 100) if pz else 0.0
                ts_signal = (
                    min(max(ts.rolling_z, 0) / 4.0 * 100, 100) if ts
                    else 0.0
                )
                if ts and ts.cusum_alarm:
                    ts_signal = max(ts_signal, 75.0)

                combined = (
                    config.WEIGHT_BETA_BINOMIAL * bb_signal
                    + config.WEIGHT_PEER_Z * pz_signal
                    + config.WEIGHT_TIME_SERIES * ts_signal
                )
                sub_scores.append(combined)

                details[detail_key] = RateDetail(
                    observed_rate=bb.observed_rate if bb else (pz.observed_rate if pz else 0.0),
                    posterior_mean=bb.posterior_mean if bb else 0.0,
                    ci_lower=bb.ci_lower if bb else 0.0,
                    ci_upper=bb.ci_upper if bb else 0.0,
                    p_elevated=bb.p_elevated if bb else 0.0,
                    z_score=pz.z_score if pz else 0.0,
                    peer_group=pz.peer_group if pz else "",
                    peer_mean=pz.peer_mean if pz else 0.0,
                    rolling_z=ts.rolling_z if ts else 0.0,
                    cusum_alarm=ts.cusum_alarm if ts else False,
                    trend_direction=ts.trend_direction if ts else "stable",
                    weekly_rates=ts.weekly_rates if ts else [],
                )

            overall = max(sub_scores) if sub_scores else 0.0

            if overall >= config.TIER_ELEVATED:
                tier = "elevated"
            elif overall >= config.TIER_WATCH:
                tier = "watch"
            else:
                tier = "normal"

            scores.append(PartnerRiskScore(
                partner_id=pid,
                combined_score=round(overall, 1),
                tier=tier,
                decline=details.get("decline"),
                returns=details.get("returns"),
                chargeback=details.get("chargeback"),
                n_paypoints=int(row["n_paypoints"]),
                total_txns=int(row["total_txns"]),
                total_amount=float(row["total_amount"]),
            ))

        scores.sort(key=lambda s: s.combined_score, reverse=True)
        self._scores = scores
        return scores

    @property
    def scores(self) -> list[PartnerRiskScore]:
        return self._scores
