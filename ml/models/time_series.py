"""
Model 3 — Time-Series Change Detection

For each partner, rates are rolled up into weekly windows.  Two signals
are computed per rate type:

  1. **Rolling Z-Score** — current week's rate vs. the trailing N-week
     rolling mean ± std.  Catches sudden one-week spikes.

  2. **CUSUM (Cumulative Sum)** — accumulates deviations above a target
     rate (the partner's own historical mean).  Catches slow, steady
     upward drift that a single-week z-score would miss.

A partner is flagged when *either* signal fires.
"""

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .. import config


@dataclass
class TimeSeriesResult:
    partner_id: str
    rate_type: str
    current_rate: float
    baseline_rate: float
    rolling_z: float
    cusum_value: float
    cusum_alarm: bool
    spike_detected: bool
    weeks_data: int
    trend_direction: str      # "rising" | "falling" | "stable"
    weekly_rates: list[float] # last N weeks for charting


class TimeSeriesChangeModel:

    def __init__(self) -> None:
        self._weekly: pd.DataFrame | None = None

    # ── fitting ──────────────────────────────────────────────────────

    def fit(self, weekly_partner_rates: pd.DataFrame) -> None:
        """Store weekly rate series.

        Expects columns:
            partner_id, week (ISO week string or datetime),
            total_txns, declined_count, return_count, chargeback_count
        """
        self._weekly = weekly_partner_rates.copy()

    # ── scoring ──────────────────────────────────────────────────────

    def score(self) -> list[TimeSeriesResult]:
        if self._weekly is None:
            raise RuntimeError("Model not fitted. Call fit() first.")

        results: list[TimeSeriesResult] = []
        for partner_id, grp in self._weekly.groupby("partner_id"):
            grp = grp.sort_values("week")
            if len(grp) < 3:
                continue

            for rate_type, event_col in [
                ("decline", "declined_count"),
                ("return", "return_count"),
                ("chargeback", "chargeback_count"),
            ]:
                rates = (grp[event_col] / grp["total_txns"].replace(0, np.nan)).fillna(0).values
                result = self._detect(
                    partner_id=str(partner_id),
                    rate_type=rate_type,
                    rates=rates,
                )
                results.append(result)
        return results

    def _detect(
        self,
        partner_id: str,
        rate_type: str,
        rates: np.ndarray,
    ) -> TimeSeriesResult:
        window = config.ROLLING_WINDOW_WEEKS
        n = len(rates)

        # ── Rolling Z-Score ──────────────────────────────────────────
        if n > window:
            baseline_window = rates[-(window + 1):-1]
            baseline_mean = baseline_window.mean()
            baseline_std = baseline_window.std()
            current = rates[-1]
            rolling_z = (
                (current - baseline_mean) / baseline_std
                if baseline_std > 0 else 0.0
            )
        else:
            baseline_mean = rates[:-1].mean() if n > 1 else 0.0
            baseline_std = rates[:-1].std() if n > 2 else 0.0
            current = rates[-1]
            rolling_z = (
                (current - baseline_mean) / baseline_std
                if baseline_std > 0 else 0.0
            )

        # ── CUSUM (upper) ────────────────────────────────────────────
        target = rates.mean()
        sigma = rates.std() if n > 1 else 1.0
        cusum = 0.0
        for r in rates:
            if sigma > 0:
                cusum = max(0.0, cusum + (r - target) / sigma - config.CUSUM_DRIFT)
            else:
                cusum = 0.0
        cusum_alarm = cusum >= config.CUSUM_THRESHOLD

        # ── Trend direction ──────────────────────────────────────────
        if n >= 3:
            recent = rates[-3:]
            slope = np.polyfit(range(len(recent)), recent, 1)[0]
            if slope > 0.005:
                trend = "rising"
            elif slope < -0.005:
                trend = "falling"
            else:
                trend = "stable"
        else:
            trend = "stable"

        spike = (rolling_z >= config.SPIKE_Z_THRESHOLD) or cusum_alarm

        return TimeSeriesResult(
            partner_id=partner_id,
            rate_type=rate_type,
            current_rate=float(current),
            baseline_rate=float(baseline_mean),
            rolling_z=float(rolling_z),
            cusum_value=float(cusum),
            cusum_alarm=cusum_alarm,
            spike_detected=spike,
            weeks_data=n,
            trend_direction=trend,
            weekly_rates=[float(r) for r in rates[-8:]],
        )
