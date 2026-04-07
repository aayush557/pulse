import { Router } from "express";
import { pool } from "../db.js";

export const merchantHealthRouter = Router();

merchantHealthRouter.get("/", async (_req, res) => {
  try {
    // Top 20 merchants by volume in the last 7 days
    const merchantsQuery = `
      SELECT
        t.paypointid AS paypoint_id,
        COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS name,
        SUM(t.total_amount) AS total_volume,
        COUNT(*) AS total_tx_count
      FROM dbo.payabli_transactions t
      JOIN dbo.payabli_paypoints pp ON pp.id_paypoint = t.paypointid
      WHERE t.transactiontime >= CURRENT_DATE - INTERVAL '7 days'
        AND t.org_id <> 2
        AND t.trans_status = 1
        AND t.operation = 'Sale'
        AND pp.paypoint_status = 1
      GROUP BY t.paypointid, pp.dba_name, pp.legal_name
      HAVING COUNT(*) >= 10
      ORDER BY SUM(t.total_amount) DESC
      LIMIT 20
    `;

    const merchantsRes = await pool.query(merchantsQuery);
    const paypoints = merchantsRes.rows.map((r: any) => r.paypoint_id);

    if (paypoints.length === 0) {
      return res.json({ merchants: [] });
    }

    // Daily volume trend (7 days) per merchant
    const volumeTrendQuery = `
      SELECT
        t.paypointid AS paypoint_id,
        DATE(t.transactiontime) AS day,
        COALESCE(SUM(t.total_amount), 0) AS volume
      FROM dbo.payabli_transactions t
      WHERE t.paypointid = ANY($1)
        AND t.transactiontime >= CURRENT_DATE - INTERVAL '7 days'
        AND t.org_id <> 2
        AND t.trans_status = 1
        AND t.operation = 'Sale'
      GROUP BY t.paypointid, DATE(t.transactiontime)
      ORDER BY t.paypointid, day
    `;

    // Daily decline rate trend per merchant
    const declineTrendQuery = `
      SELECT
        t.paypointid AS paypoint_id,
        DATE(t.transactiontime) AS day,
        ROUND(
          COUNT(*) FILTER (WHERE t.trans_status = 2) * 100.0 / NULLIF(COUNT(*), 0), 1
        ) AS decline_rate
      FROM dbo.payabli_transactions t
      WHERE t.paypointid = ANY($1)
        AND t.transactiontime >= CURRENT_DATE - INTERVAL '7 days'
        AND t.org_id <> 2
        AND t.method = 'card'
      GROUP BY t.paypointid, DATE(t.transactiontime)
      ORDER BY t.paypointid, day
    `;

    // Daily chargeback count trend per merchant
    const cbTrendQuery = `
      SELECT
        cb.paypoint_id,
        DATE(cb.created_at) AS day,
        COUNT(*) AS cb_count
      FROM dbo.payabli_chargebacks cb
      WHERE cb.paypoint_id = ANY($1)
        AND cb.created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY cb.paypoint_id, DATE(cb.created_at)
      ORDER BY cb.paypoint_id, day
    `;

    // Alert counts (returns + chargebacks in 7 days)
    const alertCountQuery = `
      SELECT paypoint_id, SUM(cnt) AS alert_count FROM (
        SELECT paypoint_id, COUNT(*) AS cnt
        FROM dbo.payabli_returns
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
          AND paypoint_id = ANY($1)
        GROUP BY paypoint_id
        UNION ALL
        SELECT paypoint_id, COUNT(*) AS cnt
        FROM dbo.payabli_chargebacks
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
          AND paypoint_id = ANY($1)
        GROUP BY paypoint_id
      ) combined
      GROUP BY paypoint_id
    `;

    const [volumeRes, declineRes, cbRes, alertRes] = await Promise.all([
      pool.query(volumeTrendQuery, [paypoints]),
      pool.query(declineTrendQuery, [paypoints]),
      pool.query(cbTrendQuery, [paypoints]),
      pool.query(alertCountQuery, [paypoints]),
    ]);

    const volumeTrends = groupByPaypoint(volumeRes.rows, "volume");
    const declineTrends = groupByPaypoint(declineRes.rows, "decline_rate");
    const cbTrends = groupByPaypoint(cbRes.rows, "cb_count");
    const alertCounts: Record<string, number> = {};
    for (const r of alertRes.rows) {
      alertCounts[r.paypoint_id] = parseInt(r.alert_count);
    }

    const merchants = merchantsRes.rows.map((m: any) => {
      const volTrend = volumeTrends[m.paypoint_id] || [];
      const decTrend = declineTrends[m.paypoint_id] || [];
      const cbTrend = cbTrends[m.paypoint_id] || [];
      const alerts = alertCounts[m.paypoint_id] || 0;

      const avgDeclineRate =
        decTrend.length > 0
          ? decTrend.reduce((a: number, b: number) => a + b, 0) / decTrend.length
          : 0;
      const hasCBs = cbTrend.some((v: number) => v > 0);

      let healthTier: "healthy" | "monitoring" | "at_risk" = "healthy";
      if (avgDeclineRate > 15 || alerts >= 3) {
        healthTier = "at_risk";
      } else if (avgDeclineRate > 8 || alerts >= 1 || hasCBs) {
        healthTier = "monitoring";
      }

      const healthLabels = {
        healthy: "Healthy",
        monitoring: "Monitoring",
        at_risk: "At Risk",
      };

      let insight = "Steady processing — no anomalies";
      if (healthTier === "at_risk") {
        insight = `Elevated decline rate (${avgDeclineRate.toFixed(1)}%) + ${alerts} alert(s)`;
      } else if (healthTier === "monitoring") {
        if (hasCBs) insight = "Chargeback activity detected this week";
        else if (alerts > 0) insight = `${alerts} alert(s) under review`;
        else insight = "Decline rate slightly elevated";
      } else if (volTrend.length >= 2) {
        const first = volTrend[0];
        const last = volTrend[volTrend.length - 1];
        if (first > 0) {
          const pctChange = ((last - first) / first) * 100;
          if (pctChange > 5) insight = `Volume up ${pctChange.toFixed(0)}% this week`;
          else if (pctChange < -5) insight = `Volume down ${Math.abs(pctChange).toFixed(0)}% this week`;
        }
      }

      return {
        id: `mh-${m.paypoint_id}`,
        name: m.name,
        paypoint: `PPID ${m.paypoint_id}`,
        healthTier,
        healthLabel: healthLabels[healthTier],
        insight,
        volumeTrend: padTrend(volTrend),
        declineTrend: padTrend(decTrend),
        chargebackTrend: padTrend(cbTrend),
        alertCount: alerts,
      };
    });

    res.json({ merchants });
  } catch (err: any) {
    console.error("Error fetching merchant health:", err);
    res.status(500).json({ error: err.message });
  }
});

function groupByPaypoint(rows: any[], valueField: string): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const row of rows) {
    const ppid = row.paypoint_id;
    if (!result[ppid]) result[ppid] = [];
    result[ppid].push(parseFloat(row[valueField] || 0));
  }
  return result;
}

function padTrend(trend: number[], length: number = 7): number[] {
  if (trend.length >= length) return trend.slice(-length);
  return [...Array(length - trend.length).fill(0), ...trend];
}
