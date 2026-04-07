import { Router } from "express";
import { pool } from "../db.js";

export const alertsRouter = Router();

alertsRouter.get("/resolutions", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (alert_id) alert_id, action, created_at
      FROM pulse.alert_resolutions
      ORDER BY alert_id, created_at DESC
    `);
    res.json({ resolutions: result.rows });
  } catch (err: any) {
    // Table may not exist yet
    res.json({ resolutions: [] });
  }
});

alertsRouter.get("/", async (req, res) => {
  try {
    // Validate days parameter (whitelist: 7, 30, 90)
    const rawDays = parseInt(req.query.days as string, 10);
    const days = [7, 30, 90].includes(rawDays) ? rawDays : 7;

    // Failed payouts (ACH returns in the lookback window)
    const failedPayoutsQuery = `
      SELECT
        r.id_return AS id,
        'Payout returned' AS title,
        COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS subtitle,
        'payout' AS category,
        'Pay Out' AS category_label,
        'PPID ' || pp.id_paypoint AS merchant,
        r.amount,
        r.reason_code,
        r.reason,
        r.return_date,
        r.created_at
      FROM dbo.payabli_returns r
      JOIN dbo.payabli_paypoints pp ON pp.id_paypoint = r.paypoint_id
      WHERE r.created_at >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY r.created_at DESC
      LIMIT 10
    `;

    // Recent chargebacks
    const chargebacksQuery = `
      SELECT
        cb.id_chgback AS id,
        'Chargeback received' AS title,
        COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS subtitle,
        'payin' AS category,
        'Pay In' AS category_label,
        'PPID ' || pp.id_paypoint AS merchant,
        cb.amount,
        cb.reason_code,
        cb.reason,
        cb.chargeback_date,
        cb.created_at
      FROM dbo.payabli_chargebacks cb
      JOIN dbo.payabli_paypoints pp ON pp.id_paypoint = cb.paypoint_id
      WHERE cb.created_at >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY cb.created_at DESC
      LIMIT 10
    `;

    // High decline rate merchants (last 7 days, >15% decline rate, min 20 transactions)
    const declineQuery = `
      SELECT
        pp.id_paypoint,
        COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS merchant_name,
        COUNT(*) FILTER (WHERE t.trans_status = 1) AS approved,
        COUNT(*) FILTER (WHERE t.trans_status = 2) AS declined,
        COUNT(*) AS total,
        ROUND(
          COUNT(*) FILTER (WHERE t.trans_status = 2) * 100.0 / NULLIF(COUNT(*), 0), 1
        ) AS decline_rate
      FROM dbo.payabli_transactions t
      JOIN dbo.payabli_paypoints pp ON pp.id_paypoint = t.paypointid
      WHERE t.transactiontime >= CURRENT_DATE - INTERVAL '${days} days'
        AND t.org_id <> 2
        AND t.method = 'card'
      GROUP BY pp.id_paypoint, pp.dba_name, pp.legal_name
      HAVING COUNT(*) >= 20
        AND COUNT(*) FILTER (WHERE t.trans_status = 2) * 100.0 / NULLIF(COUNT(*), 0) > 15
      ORDER BY decline_rate DESC
      LIMIT 10
    `;

    // Inactive merchants (active paypoints with no transactions in last 5 days)
    const inactiveQuery = `
      SELECT
        pp.id_paypoint,
        COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS merchant_name,
        MAX(t.transactiontime) AS last_transaction
      FROM dbo.payabli_paypoints pp
      LEFT JOIN dbo.payabli_transactions t
        ON t.paypointid = pp.id_paypoint
        AND t.transactiontime >= CURRENT_DATE - INTERVAL '30 days'
        AND t.org_id <> 2
      WHERE pp.paypoint_status = 1
      GROUP BY pp.id_paypoint, pp.dba_name, pp.legal_name
      HAVING MAX(t.transactiontime) IS NOT NULL
        AND MAX(t.transactiontime) < CURRENT_DATE - INTERVAL '5 days'
      ORDER BY MAX(t.transactiontime) ASC
      LIMIT 10
    `;

    const [payoutRes, cbRes, declineRes, inactiveRes] = await Promise.all([
      pool.query(failedPayoutsQuery),
      pool.query(chargebacksQuery),
      pool.query(declineQuery),
      pool.query(inactiveQuery),
    ]);

    const alerts = [];

    // Map failed payouts to alerts
    for (const r of payoutRes.rows) {
      alerts.push({
        id: `RET-${r.id}`,
        title: r.title,
        subtitle: r.subtitle,
        category: "payout",
        categoryLabel: "Pay Out",
        merchant: r.merchant,
        amount: `$${parseFloat(r.amount).toLocaleString()}`,
        status: "action_needed",
        statusLabel: "Action needed",
        time: timeAgo(r.created_at),
        timestamp: r.created_at,
        details: {
          description: `ACH payout to ${r.subtitle} was returned with code ${r.reason_code || "N/A"}: ${r.reason || "Unknown reason"}.`,
          severity: "danger" as const,
          actionLabel: "View return details",
          actionType: "view",
          metadata: {
            "Return Code": r.reason_code || "N/A",
            "Reason": r.reason || "N/A",
            "Amount": `$${parseFloat(r.amount).toLocaleString()}`,
            "Return Date": r.return_date ? new Date(r.return_date).toLocaleDateString() : "N/A",
          },
        },
      });
    }

    // Map chargebacks to alerts
    for (const cb of cbRes.rows) {
      alerts.push({
        id: `CB-${cb.id}`,
        title: cb.title,
        subtitle: cb.subtitle,
        category: "payin",
        categoryLabel: "Pay In",
        merchant: cb.merchant,
        amount: `$${parseFloat(cb.amount).toLocaleString()}`,
        status: "action_needed",
        statusLabel: "Action needed",
        time: timeAgo(cb.created_at),
        timestamp: cb.created_at,
        details: {
          description: `Chargeback received for ${cb.subtitle}. Reason: ${cb.reason || cb.reason_code || "Unknown"}.`,
          severity: "warning" as const,
          actionLabel: "View chargeback",
          actionType: "view",
          metadata: {
            "Reason Code": cb.reason_code || "N/A",
            "Reason": cb.reason || "N/A",
            "Amount": `$${parseFloat(cb.amount).toLocaleString()}`,
            "Date": cb.chargeback_date ? new Date(cb.chargeback_date).toLocaleDateString() : "N/A",
          },
        },
      });
    }

    // Map high decline rates to alerts
    for (const d of declineRes.rows) {
      alerts.push({
        id: `DEC-${d.id_paypoint}`,
        title: "High decline rate detected",
        subtitle: d.merchant_name,
        category: "decline",
        categoryLabel: "Pay In",
        merchant: `PPID ${d.id_paypoint}`,
        amount: `${d.decline_rate}%`,
        status: "action_needed",
        statusLabel: "Action needed",
        time: "7d window",
        timestamp: new Date().toISOString(),
        aiDetected: true,
        aiExplanation: `This merchant's decline rate of ${d.decline_rate}% is elevated. ${d.declined} of ${d.total} card transactions were declined in the last 7 days.`,
        details: {
          description: `${d.merchant_name} has a ${d.decline_rate}% decline rate over the last 7 days (${d.declined} declined out of ${d.total} total card transactions).`,
          severity: "danger" as const,
          actionLabel: "Investigate merchant",
          actionType: "view",
          metadata: {
            "Approved": String(d.approved),
            "Declined": String(d.declined),
            "Total": String(d.total),
            "Decline Rate": `${d.decline_rate}%`,
          },
        },
      });
    }

    // Map inactive merchants to alerts
    for (const m of inactiveRes.rows) {
      const daysInactive = Math.floor(
        (Date.now() - new Date(m.last_transaction).getTime()) / (1000 * 60 * 60 * 24)
      );
      alerts.push({
        id: `INACT-${m.id_paypoint}`,
        title: `Merchant inactive ${daysInactive} days`,
        subtitle: m.merchant_name,
        category: "inactivity",
        categoryLabel: "Pay In",
        merchant: `PPID ${m.id_paypoint}`,
        amount: "$0",
        status: "no_action",
        statusLabel: "No action needed",
        time: `${daysInactive}d ago`,
        timestamp: m.last_transaction,
        aiDetected: true,
        aiExplanation: `No transactions processed for ${daysInactive} days. Last transaction was on ${new Date(m.last_transaction).toLocaleDateString()}.`,
        details: {
          description: `${m.merchant_name} has not processed any transactions in ${daysInactive} days.`,
          severity: "info" as const,
          actionLabel: "Contact merchant",
          actionType: "view",
          metadata: {
            "Last Transaction": new Date(m.last_transaction).toLocaleDateString(),
            "Days Inactive": String(daysInactive),
          },
        },
      });
    }

    // Filter out resolved/dismissed alerts if requested
    if (req.query.exclude_resolved === "true") {
      try {
        const resResult = await pool.query(
          `SELECT DISTINCT alert_id FROM pulse.alert_resolutions`
        );
        const resolvedIds = new Set(resResult.rows.map((r: any) => r.alert_id));
        const filtered = alerts.filter((a: any) => !resolvedIds.has(a.id));
        return res.json({ alerts: filtered, totalCount: filtered.length });
      } catch {
        // Table may not exist, continue with unfiltered
      }
    }

    // Sort by timestamp descending
    alerts.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    res.json({ alerts, totalCount: alerts.length });
  } catch (err: any) {
    console.error("Error fetching alerts:", err);
    res.status(500).json({ error: err.message });
  }
});

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}
