import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { pool } from "../db.js";

const anthropic = new Anthropic();

export const alertActionsRouter = Router();

interface ActionRequestBody {
  actionType: string;
  params?: Record<string, any>;
}

interface TestWebhookResult {
  success: boolean;
  statusCode: number;
  responseTime: number;
  error?: string;
}

alertActionsRouter.post("/:alertId/action", async (req, res) => {
  try {
    const { alertId } = req.params;
    const { actionType, params } = req.body as ActionRequestBody;

    if (!actionType) {
      return res.status(400).json({ error: "actionType is required" });
    }

    switch (actionType) {
      case "test_webhook": {
        const endpoint = params?.endpoint;
        if (!endpoint || typeof endpoint !== "string") {
          return res.status(400).json({ error: "params.endpoint is required for test_webhook" });
        }

        const startTime = Date.now();
        try {
          const response = await fetch(endpoint, {
            method: "GET",
            signal: AbortSignal.timeout(10_000),
          });
          const responseTime = Date.now() - startTime;

          const result: TestWebhookResult = {
            success: response.ok,
            statusCode: response.status,
            responseTime,
          };
          if (!response.ok) {
            result.error = `HTTP ${response.status} ${response.statusText}`;
          }
          return res.json(result);
        } catch (fetchErr: any) {
          const responseTime = Date.now() - startTime;
          return res.json({
            success: false,
            statusCode: 0,
            responseTime,
            error: fetchErr.message || "Request failed",
          } as TestWebhookResult);
        }
      }

      case "resolve": {
        const resolvedBy = params?.resolvedBy || null;
        const notes = params?.notes || null;
        const insightText = params?.insightText || null;

        try {
          await pool.query(
            `INSERT INTO pulse.alert_resolutions (alert_id, action, resolved_by, notes, insight_text)
             VALUES ($1, 'resolved', $2, $3, $4)`,
            [alertId, resolvedBy, notes, insightText]
          );
        } catch (dbErr: any) {
          console.warn("Failed to persist resolution:", dbErr.message);
        }

        return res.json({ success: true, resolvedAt: new Date().toISOString() });
      }

      case "dismiss": {
        const dismissedBy = params?.resolvedBy || null;
        const notes = params?.notes || null;
        const insightText = params?.insightText || null;

        try {
          await pool.query(
            `INSERT INTO pulse.alert_resolutions (alert_id, action, resolved_by, notes, insight_text)
             VALUES ($1, 'dismissed', $2, $3, $4)`,
            [alertId, dismissedBy, notes, insightText]
          );
        } catch (dbErr: any) {
          console.warn("Failed to persist dismissal:", dbErr.message);
        }

        return res.json({ success: true, dismissedAt: new Date().toISOString() });
      }

      case "retry_payout": {
        return res.json({
          success: false,
          message:
            "Payout retry requires Payabli API integration. This action is not yet available.",
          requiresIntegration: true,
        });
      }

      case "rotate_token": {
        return res.json({
          success: false,
          message:
            "Token rotation requires Payabli API integration. This action is not yet available.",
          requiresIntegration: true,
        });
      }

      default:
        return res.status(400).json({ error: `Unknown actionType: ${actionType}` });
    }
  } catch (err: any) {
    console.error("Error executing alert action:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── AI-generated resolution insight ───────────────────────────────────
alertActionsRouter.post("/:alertId/insight", async (req, res) => {
  try {
    const { alertId } = req.params;

    // Parse alert type from ID prefix
    const prefix = alertId.split("-")[0]; // RET, CB, DEC, INACT
    const entityId = alertId.split("-").slice(1).join("-");

    let context = "";

    if (prefix === "RET") {
      const result = await pool.query(`
        SELECT r.amount, r.reason_code, r.reason, r.return_date,
          COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS merchant_name,
          (SELECT COUNT(*) FROM dbo.payabli_returns r2 WHERE r2.paypoint_id = r.paypoint_id AND r2.created_at >= CURRENT_DATE - INTERVAL '90 days') AS returns_90d
        FROM dbo.payabli_returns r
        JOIN dbo.payabli_paypoints pp ON pp.id_paypoint = r.paypoint_id
        WHERE r.id_return = $1
        LIMIT 1
      `, [entityId]);
      if (result.rows[0]) {
        const r = result.rows[0];
        context = `Merchant: ${r.merchant_name}. Return amount: $${r.amount}. Reason: ${r.reason_code} - ${r.reason}. Returns in last 90 days: ${r.returns_90d}.`;
      }
    } else if (prefix === "CB") {
      const result = await pool.query(`
        SELECT cb.amount, cb.reason_code, cb.reason, cb.chargeback_date,
          COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS merchant_name,
          (SELECT COUNT(*) FROM dbo.payabli_chargebacks cb2 WHERE cb2.paypoint_id = cb.paypoint_id AND cb2.created_at >= CURRENT_DATE - INTERVAL '90 days') AS chargebacks_90d
        FROM dbo.payabli_chargebacks cb
        JOIN dbo.payabli_paypoints pp ON pp.id_paypoint = cb.paypoint_id
        WHERE cb.id_chgback = $1
        LIMIT 1
      `, [entityId]);
      if (result.rows[0]) {
        const r = result.rows[0];
        context = `Merchant: ${r.merchant_name}. Chargeback amount: $${r.amount}. Reason: ${r.reason_code} - ${r.reason}. Chargebacks in last 90 days: ${r.chargebacks_90d}.`;
      }
    } else if (prefix === "DEC") {
      const result = await pool.query(`
        SELECT COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS merchant_name,
          COUNT(*) AS total_txns,
          COUNT(*) FILTER (WHERE t.trans_status = 2) AS declined,
          ROUND(COUNT(*) FILTER (WHERE t.trans_status = 2) * 100.0 / NULLIF(COUNT(*), 0), 1) AS decline_rate
        FROM dbo.payabli_transactions t
        JOIN dbo.payabli_paypoints pp ON pp.id_paypoint = t.paypointid
        WHERE t.paypointid = $1 AND t.transactiontime >= CURRENT_DATE - INTERVAL '30 days'
          AND t.org_id <> 2 AND t.method = 'card'
        GROUP BY pp.dba_name, pp.legal_name
      `, [entityId]);
      if (result.rows[0]) {
        const r = result.rows[0];
        context = `Merchant: ${r.merchant_name}. 30-day decline rate: ${r.decline_rate}%. ${r.declined} declined out of ${r.total_txns} card transactions.`;
      }
    } else if (prefix === "INACT") {
      const result = await pool.query(`
        SELECT COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS merchant_name,
          MAX(t.transactiontime) AS last_transaction
        FROM dbo.payabli_paypoints pp
        LEFT JOIN dbo.payabli_transactions t ON t.paypointid = pp.id_paypoint AND t.org_id <> 2
        WHERE pp.id_paypoint = $1
        GROUP BY pp.dba_name, pp.legal_name
      `, [entityId]);
      if (result.rows[0]) {
        const r = result.rows[0];
        const daysInactive = r.last_transaction ? Math.floor((Date.now() - new Date(r.last_transaction).getTime()) / 86400000) : null;
        context = `Merchant: ${r.merchant_name}. Last transaction: ${r.last_transaction ? new Date(r.last_transaction).toLocaleDateString() : 'Never'}. Days inactive: ${daysInactive ?? 'Unknown'}.`;
      }
    }

    if (!context) {
      return res.json({ insight: "Pulse will continue monitoring this merchant's activity and alert you if the pattern recurs." });
    }

    // Call Claude for insight
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `You are a payment operations analyst at Payabli. Based on this resolved alert data, generate a brief "what we learned" insight (1-2 sentences) that helps the user understand the pattern and what Pulse will do going forward. Be specific with numbers.\n\nAlert context: ${context}`
      }]
    });

    const insight = response.content[0].type === "text" ? response.content[0].text : "Pulse will continue monitoring this merchant.";

    // Store insight in resolution record if one exists
    try {
      await pool.query(
        `UPDATE pulse.alert_resolutions SET insight_text = $1 WHERE alert_id = $2 AND insight_text IS NULL ORDER BY created_at DESC LIMIT 1`,
        [insight, alertId]
      );
    } catch { /* table may not exist */ }

    res.json({ insight });
  } catch (err: any) {
    console.error("Error generating insight:", err.message);
    res.json({ insight: "Pulse will continue monitoring this merchant's activity and alert you if the pattern recurs." });
  }
});
