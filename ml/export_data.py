"""
Export transaction data from PostgreSQL to parquet for the ML pipeline.

Reads PG* connection variables from the environment or a .env file in the
project root, queries the last 90 days of transactions from
dbo.payabli_transactions (with optional joins to dbo.payabli_returns and
dbo.payabli_chargebacks), and writes a parquet file to the path expected
by ml.config.PARQUET_PATH.

Usage:
    python -m ml.export_data          # from the project root
    python ml/export_data.py          # also works
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Resolve project root so we can import ml.config and find .env
# ---------------------------------------------------------------------------
_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _SCRIPT_DIR.parent

# Allow running as `python ml/export_data.py` without installing the package
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from ml import config  # noqa: E402


# ---------------------------------------------------------------------------
# Environment / .env loading
# ---------------------------------------------------------------------------

def _load_env() -> None:
    """Load variables from .env file if present (does NOT override existing)."""
    env_file = _PROJECT_ROOT / ".env"
    if not env_file.exists():
        return
    with open(env_file) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip("'\"")
            os.environ.setdefault(key, value)


def _get_pg_env() -> dict[str, str]:
    """Return a dict of PG connection params from environment variables.

    Raises RuntimeError if any required variable is missing or blank.
    """
    required = ["PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"]
    optional = {"PGPORT": "5432", "PGSSLMODE": "require"}

    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing)}.\n"
            "Set them in the shell or in a .env file at the project root."
        )

    return {
        "host": os.environ["PGHOST"],
        "port": int(os.environ.get("PGPORT", optional["PGPORT"])),
        "dbname": os.environ["PGDATABASE"],
        "user": os.environ["PGUSER"],
        "password": os.environ["PGPASSWORD"],
        "sslmode": os.environ.get("PGSSLMODE", optional["PGSSLMODE"]),
    }


# ---------------------------------------------------------------------------
# SQL query
# ---------------------------------------------------------------------------

QUERY = """\
SELECT
    t.org_id            AS parent_idx,
    t.paypoint_id       AS paypointid,
    t.id                AS id_trans,
    t.transaction_time  AS transactiontime,
    t.status            AS trans_status,
    CASE
        WHEN t.status = 1 THEN 'Approved'
        WHEN t.status = 2 THEN 'Failed'
        ELSE 'Other'
    END                 AS status_category,
    t.method            AS method,
    r.id                AS "return",
    cb.id               AS chargeback,
    t.total_amount      AS total_amount,
    COALESCE(t.mcc_risk_level, 'M') AS mcc_risk_level
FROM dbo.payabli_transactions t
LEFT JOIN dbo.payabli_returns    r  ON r.transaction_id = t.id
LEFT JOIN dbo.payabli_chargebacks cb ON cb.transaction_id = t.id
WHERE t.transaction_time >= (CURRENT_DATE - INTERVAL '90 days')
ORDER BY t.transaction_time
"""


# ---------------------------------------------------------------------------
# Main export logic
# ---------------------------------------------------------------------------

def export() -> Path:
    """Connect to PostgreSQL, run the query, and write parquet.

    Returns the Path of the written parquet file.
    """
    try:
        import psycopg2
    except ImportError:
        sys.exit(
            "psycopg2 is not installed. Install it with:\n"
            "  pip install psycopg2-binary"
        )

    _load_env()
    pg = _get_pg_env()

    print(f"Connecting to PostgreSQL at {pg['host']}:{pg['port']}/{pg['dbname']} ...")
    t0 = time.time()

    try:
        conn = psycopg2.connect(
            host=pg["host"],
            port=pg["port"],
            dbname=pg["dbname"],
            user=pg["user"],
            password=pg["password"],
            sslmode=pg["sslmode"],
            connect_timeout=15,
        )
    except psycopg2.OperationalError as exc:
        sys.exit(f"Failed to connect to PostgreSQL:\n  {exc}")

    print("Connected. Running query (last 90 days) ...")

    try:
        df = pd.read_sql(QUERY, conn)
    except Exception as exc:
        conn.close()
        sys.exit(f"Query failed:\n  {exc}")
    finally:
        conn.close()

    elapsed_query = time.time() - t0
    print(f"Query returned {len(df):,} rows in {elapsed_query:.1f}s")

    if df.empty:
        sys.exit("No rows returned -- nothing to export.")

    # ── Ensure correct dtypes ────────────────────────────────────────
    df["transactiontime"] = pd.to_datetime(df["transactiontime"], utc=True)
    df["total_amount"] = pd.to_numeric(df["total_amount"], errors="coerce").fillna(0.0)

    # return / chargeback: keep as-is (non-null = flagged, null = clean)
    # data_loader counts notna() so this convention is correct.

    # ── Write parquet ────────────────────────────────────────────────
    out_path = Path(config.PARQUET_PATH)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    df.to_parquet(out_path, engine="pyarrow", index=False)

    file_size = out_path.stat().st_size
    date_min = df["transactiontime"].min()
    date_max = df["transactiontime"].max()

    # ── Summary ──────────────────────────────────────────────────────
    print()
    print("=== Export complete ===")
    print(f"  Rows exported : {len(df):,}")
    print(f"  Date range    : {date_min:%Y-%m-%d} to {date_max:%Y-%m-%d}")
    print(f"  File size     : {file_size / 1_048_576:.2f} MB")
    print(f"  Output path   : {out_path}")

    return out_path


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    export()
