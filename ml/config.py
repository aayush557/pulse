from pathlib import Path

PARQUET_PATH = Path(__file__).resolve().parent.parent.parent / "Developer" / "AWS Folders" / "data" / "preprocessed_training_data" / "preprocessed_data.parquet"

# ── Thresholds for "elevated" classification ─────────────────────────
# These are population percentiles used by the Beta-Binomial model to
# compute P(rate > threshold).  Calibrated from the preprocessed dataset:
#   decline p90 ≈ 0.18, return p95 ≈ 0.014, chargeback p95 ≈ 0.0017
DECLINE_THRESHOLD = 0.18
RETURN_THRESHOLD = 0.014
CHARGEBACK_THRESHOLD = 0.0017

# ── Peer Z-Score settings ────────────────────────────────────────────
VOLUME_TIER_BINS = [0, 500, 5_000, float("inf")]
VOLUME_TIER_LABELS = ["low", "medium", "high"]
Z_SCORE_ELEVATED = 2.0
Z_SCORE_WATCH = 1.5

# ── Time-Series change detection ────────────────────────────────────
ROLLING_WINDOW_WEEKS = 4
CUSUM_DRIFT = 0.5        # allowable drift before accumulating
CUSUM_THRESHOLD = 4.0    # CUSUM alarm limit (in std-dev units)
SPIKE_Z_THRESHOLD = 2.0

# ── Combined scoring weights ────────────────────────────────────────
WEIGHT_BETA_BINOMIAL = 0.40
WEIGHT_PEER_Z = 0.30
WEIGHT_TIME_SERIES = 0.30

# ── Tier cutoffs on the combined 0-100 score ─────────────────────────
TIER_ELEVATED = 70
TIER_WATCH = 40
