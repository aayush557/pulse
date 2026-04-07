import { Router } from "express";
import { pool } from "../db.js";

export const predictiveAlertsRouter = Router();

// ── Types ──────────────────────────────────────────────────────────────

interface PredictiveAlert {
  id: string;
  title: string;
  subtitle: string;
  merchant: string;
  trendData: number[];
  projectedData: number[];
  threshold: number;
  metricLabel: string;
  time: string;
  projectedBreachDay: number | null;
}

// ── Cache ──────────────────────────────────────────────────────────────

const cache = new Map<string, { data: PredictiveAlert[]; ts: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ── Main endpoint ──────────────────────────────────────────────────────

predictiveAlertsRouter.get("/", async (_req, res) => {
  try {
    const cacheKey = "predictive-alerts";

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return res.json({ alerts: cached.data });
    }

    // Step 1: Get daily decline rates per merchant for last 14 days
    const trendQuery = `
      WITH daily_rates AS (
        SELECT
          t.paypointid,
          COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS merchant_name,
          DATE(t.transactiontime) AS day,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE t.trans_status = 2) AS declined,
          ROUND(COUNT(*) FILTER (WHERE t.trans_status = 2) * 100.0 / NULLIF(COUNT(*), 0), 2) AS decline_rate
        FROM dbo.payabli_transactions t
        JOIN dbo.payabli_paypoints pp ON pp.id_paypoint = t.paypointid
        WHERE t.transactiontime >= CURRENT_DATE - INTERVAL '14 days'
          AND t.transactiontime < CURRENT_DATE + INTERVAL '1 day'
          AND t.org_id <> 2
          AND t.method = 'card'
        GROUP BY t.paypointid, pp.dba_name, pp.legal_name, DATE(t.transactiontime)
        HAVING COUNT(*) >= 5
      )
      SELECT paypointid, merchant_name,
        array_agg(decline_rate ORDER BY day) AS trend_data,
        array_agg(day ORDER BY day) AS days,
        AVG(decline_rate) AS avg_rate
      FROM daily_rates
      GROUP BY paypointid, merchant_name
      HAVING COUNT(*) >= 7
      ORDER BY AVG(decline_rate) DESC
    `;

    const trendRes = await pool.query(trendQuery);

    // Step 2: Compute linear projection for each merchant
    const THRESHOLD = 20;
    const PROJECTION_DAYS = 7;
    const MIN_CURRENT_RATE = 5;

    const alerts: PredictiveAlert[] = [];

    for (const row of trendRes.rows) {
      const trendData: number[] = row.trend_data.map((v: string) =>
        parseFloat(v)
      );
      const n = trendData.length;
      if (n < 2) continue;

      const first = trendData[0];
      const last = trendData[n - 1];
      const slope = (last - first) / (n - 1);

      // Only include merchants with positive slope and meaningful current rate
      if (slope <= 0) continue;
      if (last < MIN_CURRENT_RATE) continue;

      // Project 7 days forward
      const projectedData: number[] = [];
      let projectedBreachDay: number | null = null;

      for (let i = 0; i < PROJECTION_DAYS; i++) {
        const projected = last + slope * (i + 1);
        projectedData.push(Math.round(projected * 100) / 100);

        if (projectedBreachDay === null && projected >= THRESHOLD) {
          projectedBreachDay = i + 1;
        }
      }

      // Only include if projected to breach threshold within 7 days
      if (projectedBreachDay === null) continue;

      alerts.push({
        id: `WATCH-${row.paypointid}`,
        title: "Decline rate approaching threshold",
        subtitle: row.merchant_name,
        merchant: `PPID ${row.paypointid}`,
        trendData,
        projectedData,
        threshold: THRESHOLD,
        metricLabel: "Decline rate (%)",
        time: "14d trend",
        projectedBreachDay,
      });
    }

    // Sort by earliest projected breach
    alerts.sort((a, b) => {
      const aDay = a.projectedBreachDay ?? Infinity;
      const bDay = b.projectedBreachDay ?? Infinity;
      return aDay - bDay;
    });

    // Cache result
    cache.set(cacheKey, { data: alerts, ts: Date.now() });

    res.json({ alerts });
  } catch (err: any) {
    console.error("Error fetching predictive alerts:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Force refresh endpoint ─────────────────────────────────────────────

predictiveAlertsRouter.post("/refresh", async (_req, res) => {
  cache.clear();
  res.json({ cleared: true });
});
