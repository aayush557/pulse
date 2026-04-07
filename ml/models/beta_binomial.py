"""
Model 1 — Bayesian Beta-Binomial Rate Estimation

For each partner and rate type (decline / return / chargeback):
  1. Estimate a population-level Beta prior via empirical Bayes (method of moments).
  2. Update each partner's posterior with their observed counts.
  3. Compute P(rate > threshold) from the posterior — partners with high
     posterior probability of exceeding the threshold are flagged.

This naturally handles small-sample partners: a partner with 10 txns and
2 declines is shrunk toward the population mean, while a partner with
100K txns speaks for itself.
"""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.stats import beta as beta_dist


@dataclass
class BetaBinomialResult:
    partner_id: str
    rate_type: str            # "decline" | "return" | "chargeback"
    observed_rate: float
    posterior_mean: float
    ci_lower: float           # 95 % credible interval
    ci_upper: float
    p_elevated: float         # P(rate > threshold | data)
    n_trials: int
    n_events: int


class BetaBinomialModel:
    """Empirical-Bayes Beta-Binomial model for partner rate estimation."""

    def __init__(self) -> None:
        self._priors: dict[str, tuple[float, float]] = {}

    # ── fitting ──────────────────────────────────────────────────────

    def fit(self, partner_stats: pd.DataFrame) -> None:
        """Learn population priors from partner-level stats.

        Expects columns:
            partner_id, total_txns,
            declined_count, return_count, chargeback_count
        """
        for rate_type, event_col in [
            ("decline", "declined_count"),
            ("return", "return_count"),
            ("chargeback", "chargeback_count"),
        ]:
            rates = (
                partner_stats[event_col] / partner_stats["total_txns"]
            ).replace([np.inf, -np.inf], np.nan).dropna()
            rates = rates[rates > 0]
            if len(rates) < 2:
                self._priors[rate_type] = (1.0, 1.0)
                continue
            self._priors[rate_type] = self._moment_prior(rates)

    @staticmethod
    def _moment_prior(rates: pd.Series) -> tuple[float, float]:
        """Method-of-moments estimator for Beta(alpha, beta)."""
        mu = rates.mean()
        var = rates.var()
        if var == 0 or mu * (1 - mu) <= var:
            return (1.0, 1.0)
        common = (mu * (1 - mu) / var) - 1
        alpha = mu * common
        beta_ = (1 - mu) * common
        return (max(alpha, 0.01), max(beta_, 0.01))

    # ── scoring ──────────────────────────────────────────────────────

    def score(
        self,
        partner_stats: pd.DataFrame,
        thresholds: dict[str, float],
    ) -> list[BetaBinomialResult]:
        results: list[BetaBinomialResult] = []
        for _, row in partner_stats.iterrows():
            for rate_type, event_col, threshold in [
                ("decline", "declined_count", thresholds["decline"]),
                ("return", "return_count", thresholds["return"]),
                ("chargeback", "chargeback_count", thresholds["chargeback"]),
            ]:
                n = int(row["total_txns"])
                k = int(row[event_col])
                if n == 0:
                    continue
                a0, b0 = self._priors.get(rate_type, (1.0, 1.0))
                a_post = a0 + k
                b_post = b0 + n - k
                posterior = beta_dist(a_post, b_post)

                results.append(BetaBinomialResult(
                    partner_id=str(row["partner_id"]),
                    rate_type=rate_type,
                    observed_rate=k / n,
                    posterior_mean=posterior.mean(),
                    ci_lower=float(posterior.ppf(0.025)),
                    ci_upper=float(posterior.ppf(0.975)),
                    p_elevated=float(1 - posterior.cdf(threshold)),
                    n_trials=n,
                    n_events=k,
                ))
        return results
