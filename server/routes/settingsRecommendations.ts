import { Router } from "express";
import { pool } from "../db.js";

export const settingsRecommendationsRouter = Router();

interface ThresholdRecommendation {
  settingId: string;
  recommendedValue: string;
  explanation: string;
  dataPoints: {
    p50: number;
    p75: number;
    p90: number;
  };
}

interface CacheEntry {
  data: { recommendations: ThresholdRecommendation[]; generatedAt: string };
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

settingsRecommendationsRouter.get("/", async (_req, res) => {
  try {
    // Check cache
    const cached = cache.get("recommendations");
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.data);
    }

    // Step 1: Gather statistical data in parallel
    const batchSizesQuery = `
      SELECT
        percentile_cont(0.50) WITHIN GROUP (ORDER BY daily_volume) AS p50,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY daily_volume) AS p75,
        percentile_cont(0.90) WITHIN GROUP (ORDER BY daily_volume) AS p90,
        AVG(daily_volume) AS avg_volume
      FROM (
        SELECT paypointid, DATE(transactiontime) AS day,
          SUM(total_amount) AS daily_volume
        FROM dbo.payabli_transactions
        WHERE transactiontime >= CURRENT_DATE - INTERVAL '30 days'
          AND org_id <> 2 AND trans_status = 1 AND operation = 'Sale'
        GROUP BY paypointid, DATE(transactiontime)
      ) sub
    `;

    const merchantCadenceQuery = `
      WITH last_txn AS (
        SELECT paypointid,
          COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS name,
          MAX(transactiontime) AS last_transaction,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MAX(transactiontime))) / 86400 AS days_since_last
        FROM dbo.payabli_transactions t
        JOIN dbo.payabli_paypoints pp ON pp.id_paypoint = t.paypointid
        WHERE t.transactiontime >= CURRENT_DATE - INTERVAL '60 days'
          AND t.org_id <> 2
        GROUP BY paypointid, pp.dba_name, pp.legal_name
      )
      SELECT
        percentile_cont(0.50) WITHIN GROUP (ORDER BY days_since_last) AS median_gap,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY days_since_last) AS p75_gap,
        percentile_cont(0.90) WITHIN GROUP (ORDER BY days_since_last) AS p90_gap
      FROM last_txn
      WHERE days_since_last <= 30
    `;

    const declineRateQuery = `
      WITH merchant_declines AS (
        SELECT paypointid,
          ROUND(COUNT(*) FILTER (WHERE trans_status = 2) * 100.0 / NULLIF(COUNT(*), 0), 2) AS decline_rate
        FROM dbo.payabli_transactions
        WHERE transactiontime >= CURRENT_DATE - INTERVAL '7 days'
          AND org_id <> 2 AND method = 'card'
        GROUP BY paypointid
        HAVING COUNT(*) >= 20
      )
      SELECT
        percentile_cont(0.50) WITHIN GROUP (ORDER BY decline_rate) AS p50,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY decline_rate) AS p75,
        percentile_cont(0.90) WITHIN GROUP (ORDER BY decline_rate) AS p90,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY decline_rate) AS p95,
        AVG(decline_rate) AS avg_rate
      FROM merchant_declines
    `;

    const [batchRes, cadenceRes, declineRes] = await Promise.all([
      pool.query(batchSizesQuery),
      pool.query(merchantCadenceQuery),
      pool.query(declineRateQuery),
    ]);

    const batchStats = batchRes.rows[0] || { p50: 0, p75: 0, p90: 0 };
    const cadenceStats = cadenceRes.rows[0] || { median_gap: 0, p75_gap: 0, p90_gap: 0 };
    const declineStats = declineRes.rows[0] || { p50: 0, p75: 0, p90: 0 };

    // Step 2: Compute recommendations
    const batchP75 = Math.round(parseFloat(batchStats.p75 || 0) / 100) * 100;
    const inactivityDays = Math.ceil(parseFloat(cadenceStats.p75_gap || 0));
    const declineP90 = Math.ceil(parseFloat(declineStats.p90 || 0));

    const recommendations: ThresholdRecommendation[] = [
      {
        settingId: "batch_holds",
        recommendedValue: String(batchP75),
        explanation: `Recommended: $${batchP75.toLocaleString()} based on your portfolio's 75th percentile daily batch volume`,
        dataPoints: {
          p50: parseFloat(batchStats.p50 || 0),
          p75: parseFloat(batchStats.p75 || 0),
          p90: parseFloat(batchStats.p90 || 0),
        },
      },
      {
        settingId: "merchant_inactivity",
        recommendedValue: String(inactivityDays),
        explanation: `Recommended: ${inactivityDays} days based on your merchants' typical processing cadence`,
        dataPoints: {
          p50: parseFloat(cadenceStats.median_gap || 0),
          p75: parseFloat(cadenceStats.p75_gap || 0),
          p90: parseFloat(cadenceStats.p90_gap || 0),
        },
      },
      {
        settingId: "decline_rate",
        recommendedValue: String(declineP90),
        explanation: `Recommended: ${declineP90}% based on your portfolio's 90th percentile decline rate`,
        dataPoints: {
          p50: parseFloat(declineStats.p50 || 0),
          p75: parseFloat(declineStats.p75 || 0),
          p90: parseFloat(declineStats.p90 || 0),
        },
      },
    ];

    // Step 3: Build response and cache it
    const responseData = {
      recommendations,
      generatedAt: new Date().toISOString(),
    };

    cache.set("recommendations", {
      data: responseData,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    res.json(responseData);
  } catch (err: any) {
    console.error("Error generating settings recommendations:", err);
    res.status(500).json({ error: err.message });
  }
});

settingsRecommendationsRouter.post("/refresh", async (_req, res) => {
  try {
    cache.delete("recommendations");
    res.json({ success: true, message: "Recommendations cache cleared" });
  } catch (err: any) {
    console.error("Error clearing recommendations cache:", err);
    res.status(500).json({ error: err.message });
  }
});
