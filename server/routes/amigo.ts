import { Router } from "express";
import { pool } from "../db.js";
import Anthropic from "@anthropic-ai/sdk";

export const amigoRouter = Router();

const anthropic = new Anthropic();

// ── Types ──────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

interface MetricsSummary {
  payInVolume: number;
  payInCount: number;
  payOutVolume: number;
  payOutCount: number;
}

interface AlertCounts {
  returns7d: number;
  chargebacks7d: number;
  highDeclineMerchants: number;
  inactiveMerchants: number;
}

interface TopMerchant {
  name: string;
  volume: number;
  txCount: number;
  declineRate: number;
}

interface HighDeclineMerchant {
  name: string;
  declineRate: number;
  approved: number;
  declined: number;
  total: number;
}

interface PortfolioContext {
  metrics: MetricsSummary | null;
  alerts: AlertCounts | null;
  topMerchants: TopMerchant[] | null;
  highDeclineMerchants: HighDeclineMerchant[] | null;
}

// ── POST /chat ─────────────────────────────────────────────────────────

amigoRouter.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body as ChatRequest;

    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    // ── Step 1: Gather portfolio context ─────────────────────────────

    let context: PortfolioContext = {
      metrics: null,
      alerts: null,
      topMerchants: null,
      highDeclineMerchants: null,
    };

    try {
      const [metricsRes, alertsRes, topMerchantsRes, highDeclineRes] =
        await Promise.all([
          // MTD metrics summary
          pool.query(`
            SELECT
              COALESCE((
                SELECT SUM(total_amount)
                FROM dbo.payabli_transactions
                WHERE org_id <> 2
                  AND trans_status = 1
                  AND operation = 'Sale'
                  AND transactiontime >= DATE_TRUNC('month', CURRENT_DATE)
              ), 0) AS payin_volume,
              COALESCE((
                SELECT COUNT(*)
                FROM dbo.payabli_transactions
                WHERE org_id <> 2
                  AND trans_status = 1
                  AND operation = 'Sale'
                  AND transactiontime >= DATE_TRUNC('month', CURRENT_DATE)
              ), 0) AS payin_count,
              COALESCE((
                SELECT SUM(total_amount)
                FROM dbo.payabli_out_transaction
                WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
                  AND internal_status NOT IN (0)
              ), 0) AS payout_volume,
              COALESCE((
                SELECT COUNT(*)
                FROM dbo.payabli_out_transaction
                WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
                  AND internal_status NOT IN (0)
              ), 0) AS payout_count
          `),

          // Active alerts count
          pool.query(`
            SELECT
              COALESCE((
                SELECT COUNT(*)
                FROM dbo.payabli_returns
                WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
              ), 0) AS returns_7d,
              COALESCE((
                SELECT COUNT(*)
                FROM dbo.payabli_chargebacks
                WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
              ), 0) AS chargebacks_7d,
              COALESCE((
                SELECT COUNT(*) FROM (
                  SELECT t.paypointid
                  FROM dbo.payabli_transactions t
                  WHERE t.transactiontime >= CURRENT_DATE - INTERVAL '7 days'
                    AND t.org_id <> 2
                    AND t.method = 'card'
                  GROUP BY t.paypointid
                  HAVING COUNT(*) >= 20
                    AND COUNT(*) FILTER (WHERE t.trans_status = 2) * 100.0
                        / NULLIF(COUNT(*), 0) > 15
                ) sub
              ), 0) AS high_decline_merchants,
              COALESCE((
                SELECT COUNT(*) FROM (
                  SELECT pp.id_paypoint
                  FROM dbo.payabli_paypoints pp
                  LEFT JOIN dbo.payabli_transactions t
                    ON t.paypointid = pp.id_paypoint
                    AND t.transactiontime >= CURRENT_DATE - INTERVAL '30 days'
                    AND t.org_id <> 2
                  WHERE pp.paypoint_status = 1
                  GROUP BY pp.id_paypoint
                  HAVING MAX(t.transactiontime) IS NOT NULL
                    AND MAX(t.transactiontime) < CURRENT_DATE - INTERVAL '5 days'
                ) sub
              ), 0) AS inactive_merchants
          `),

          // Top 5 merchants by volume (7d)
          pool.query(`
            SELECT
              COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS merchant_name,
              SUM(t.total_amount) AS volume,
              COUNT(*) AS tx_count,
              ROUND(
                COUNT(*) FILTER (WHERE t.trans_status = 2) * 100.0
                / NULLIF(COUNT(*), 0), 1
              ) AS decline_rate
            FROM dbo.payabli_transactions t
            JOIN dbo.payabli_paypoints pp ON pp.id_paypoint = t.paypointid
            WHERE t.transactiontime >= CURRENT_DATE - INTERVAL '7 days'
              AND t.org_id <> 2
              AND t.trans_status = 1
              AND t.operation = 'Sale'
            GROUP BY pp.id_paypoint, pp.dba_name, pp.legal_name
            ORDER BY volume DESC
            LIMIT 5
          `),

          // High decline rate merchants (7d, >10%, min 20 txns)
          pool.query(`
            SELECT
              COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS merchant_name,
              COUNT(*) FILTER (WHERE t.trans_status = 1) AS approved,
              COUNT(*) FILTER (WHERE t.trans_status = 2) AS declined,
              COUNT(*) AS total,
              ROUND(
                COUNT(*) FILTER (WHERE t.trans_status = 2) * 100.0
                / NULLIF(COUNT(*), 0), 1
              ) AS decline_rate
            FROM dbo.payabli_transactions t
            JOIN dbo.payabli_paypoints pp ON pp.id_paypoint = t.paypointid
            WHERE t.transactiontime >= CURRENT_DATE - INTERVAL '7 days'
              AND t.org_id <> 2
              AND t.method = 'card'
            GROUP BY pp.id_paypoint, pp.dba_name, pp.legal_name
            HAVING COUNT(*) >= 20
              AND COUNT(*) FILTER (WHERE t.trans_status = 2) * 100.0
                  / NULLIF(COUNT(*), 0) > 10
            ORDER BY decline_rate DESC
            LIMIT 10
          `),
        ]);

      const m = metricsRes.rows[0];
      context.metrics = {
        payInVolume: parseFloat(m.payin_volume),
        payInCount: parseInt(m.payin_count, 10),
        payOutVolume: parseFloat(m.payout_volume),
        payOutCount: parseInt(m.payout_count, 10),
      };

      const a = alertsRes.rows[0];
      context.alerts = {
        returns7d: parseInt(a.returns_7d, 10),
        chargebacks7d: parseInt(a.chargebacks_7d, 10),
        highDeclineMerchants: parseInt(a.high_decline_merchants, 10),
        inactiveMerchants: parseInt(a.inactive_merchants, 10),
      };

      context.topMerchants = topMerchantsRes.rows.map((r) => ({
        name: r.merchant_name,
        volume: parseFloat(r.volume),
        txCount: parseInt(r.tx_count, 10),
        declineRate: parseFloat(r.decline_rate) || 0,
      }));

      context.highDeclineMerchants = highDeclineRes.rows.map((r) => ({
        name: r.merchant_name,
        declineRate: parseFloat(r.decline_rate),
        approved: parseInt(r.approved, 10),
        declined: parseInt(r.declined, 10),
        total: parseInt(r.total, 10),
      }));
    } catch (dbErr: any) {
      console.error("Amigo: DB queries failed, proceeding without data:", dbErr.message);
    }

    // ── Step 2: Build Claude prompt ─────────────────────────────────

    const contextBlock = buildContextBlock(context);

    const systemMessage = `You are Amigo, an AI assistant for Payabli Pulse. You have read-only access to the user's portfolio data. Answer questions concisely using the context provided. Format numbers with commas and dollar signs. Use markdown bold for emphasis. If you can't answer from the data, say so. Keep responses under 200 words.

${contextBlock}`;

    const messages: ChatMessage[] = [
      ...(history || []),
      { role: "user", content: message },
    ];

    // ── Step 3: Call Claude ──────────────────────────────────────────

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemMessage,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    res.json({ response: text });
  } catch (err: any) {
    console.error("Error in Amigo chat:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────

function buildContextBlock(ctx: PortfolioContext): string {
  const sections: string[] = [];

  if (ctx.metrics) {
    sections.push(`## Portfolio Metrics (Month-to-Date)
- Pay In Volume: $${ctx.metrics.payInVolume.toLocaleString()}
- Pay In Transactions: ${ctx.metrics.payInCount.toLocaleString()}
- Pay Out Volume: $${ctx.metrics.payOutVolume.toLocaleString()}
- Pay Out Transactions: ${ctx.metrics.payOutCount.toLocaleString()}`);
  }

  if (ctx.alerts) {
    const total =
      ctx.alerts.returns7d +
      ctx.alerts.chargebacks7d +
      ctx.alerts.highDeclineMerchants +
      ctx.alerts.inactiveMerchants;
    sections.push(`## Active Alerts (${total} total)
- Returns (7d): ${ctx.alerts.returns7d}
- Chargebacks (7d): ${ctx.alerts.chargebacks7d}
- High-Decline Merchants (>15%, 7d): ${ctx.alerts.highDeclineMerchants}
- Inactive Merchants (5+ days): ${ctx.alerts.inactiveMerchants}`);
  }

  if (ctx.topMerchants && ctx.topMerchants.length > 0) {
    const rows = ctx.topMerchants
      .map(
        (m, i) =>
          `${i + 1}. ${m.name} — $${m.volume.toLocaleString()} (${m.txCount.toLocaleString()} txns, ${m.declineRate}% decline rate)`
      )
      .join("\n");
    sections.push(`## Top 5 Merchants by Volume (7d)\n${rows}`);
  }

  if (ctx.highDeclineMerchants && ctx.highDeclineMerchants.length > 0) {
    const rows = ctx.highDeclineMerchants
      .map(
        (m) =>
          `- ${m.name}: ${m.declineRate}% decline rate (${m.declined}/${m.total} txns)`
      )
      .join("\n");
    sections.push(`## High Decline Rate Merchants (>10%, 7d)\n${rows}`);
  }

  if (sections.length === 0) {
    return "## Portfolio Data\nData is currently unavailable. Let the user know you cannot access live data right now.";
  }

  return sections.join("\n\n");
}
