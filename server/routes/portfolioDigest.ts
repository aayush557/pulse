import { Router } from "express";
import { pool } from "../db.js";
import Anthropic from "@anthropic-ai/sdk";

export const portfolioDigestRouter = Router();

const anthropic = new Anthropic();

// -- Types ------------------------------------------------------------------

interface Insight {
  type: "positive" | "warning" | "info";
  text: string;
}

interface DigestResponse {
  weekLabel: string;
  insights: Insight[];
  expandedInsights: Insight[];
  fromCache: boolean;
  generatedAt: string;
}

interface VolumeRow {
  volume: string;
  tx_count: string;
}

interface MerchantVolumeRow {
  paypointid: number;
  merchant_name: string;
  this_week_volume: string;
  last_week_volume: string;
  volume_change: string;
}

interface DeclineRow {
  paypointid: number;
  merchant_name: string;
  total_txns: string;
  declined_txns: string;
  decline_rate: number;
}

interface WebhookHealthRow {
  total: string;
  succeeded: string;
}

// -- Cache ------------------------------------------------------------------

const digestCache = new Map<string, { data: DigestResponse; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// -- Main endpoint ----------------------------------------------------------

portfolioDigestRouter.get("/", async (_req, res) => {
  try {
    const cacheKey = "weekly-digest";

    // Check cache
    const cached = digestCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return res.json({
        ...cached.data,
        fromCache: true,
        generatedAt: new Date(cached.ts).toISOString(),
      });
    }

    // -- Step 1: Gather data in parallel ------------------------------------

    const payInThisWeekQuery = `
      SELECT COALESCE(SUM(total_amount), 0) AS volume, COUNT(*) AS tx_count
      FROM dbo.payabli_transactions
      WHERE transactiontime >= date_trunc('week', CURRENT_DATE)
        AND transactiontime < CURRENT_DATE + INTERVAL '1 day'
        AND org_id <> 2
        AND trans_status = 1
        AND operation = 'Sale'
    `;

    const payInLastWeekQuery = `
      SELECT COALESCE(SUM(total_amount), 0) AS volume, COUNT(*) AS tx_count
      FROM dbo.payabli_transactions
      WHERE transactiontime >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
        AND transactiontime < date_trunc('week', CURRENT_DATE)
        AND org_id <> 2
        AND trans_status = 1
        AND operation = 'Sale'
    `;

    const payOutThisWeekQuery = `
      SELECT COALESCE(SUM(total_amount), 0) AS volume, COUNT(*) AS tx_count
      FROM dbo.payabli_out_transaction
      WHERE created_at >= date_trunc('week', CURRENT_DATE)
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
        AND internal_status NOT IN (0)
    `;

    const newCustomersQuery = `
      SELECT COUNT(*) AS new_customers
      FROM dbo.payabli_payors_login
      WHERE created_at >= date_trunc('week', CURRENT_DATE)
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
    `;

    const topMerchantsQuery = `
      WITH this_week AS (
        SELECT paypointid, COALESCE(SUM(total_amount), 0) AS volume
        FROM dbo.payabli_transactions
        WHERE transactiontime >= date_trunc('week', CURRENT_DATE)
          AND transactiontime < CURRENT_DATE + INTERVAL '1 day'
          AND org_id <> 2
          AND trans_status = 1
          AND operation = 'Sale'
        GROUP BY paypointid
      ),
      last_week AS (
        SELECT paypointid, COALESCE(SUM(total_amount), 0) AS volume
        FROM dbo.payabli_transactions
        WHERE transactiontime >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
          AND transactiontime < date_trunc('week', CURRENT_DATE)
          AND org_id <> 2
          AND trans_status = 1
          AND operation = 'Sale'
        GROUP BY paypointid
      )
      SELECT
        COALESCE(tw.paypointid, lw.paypointid) AS paypointid,
        COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS merchant_name,
        COALESCE(tw.volume, 0) AS this_week_volume,
        COALESCE(lw.volume, 0) AS last_week_volume,
        COALESCE(tw.volume, 0) - COALESCE(lw.volume, 0) AS volume_change
      FROM this_week tw
      FULL OUTER JOIN last_week lw ON tw.paypointid = lw.paypointid
      LEFT JOIN dbo.payabli_paypoints pp ON pp.id_paypoint = COALESCE(tw.paypointid, lw.paypointid)
      ORDER BY ABS(COALESCE(tw.volume, 0) - COALESCE(lw.volume, 0)) DESC
      LIMIT 5
    `;

    const declineRatesQuery = `
      SELECT
        t.paypointid,
        COALESCE(pp.dba_name, pp.legal_name, 'Unknown') AS merchant_name,
        COUNT(*) AS total_txns,
        COUNT(*) FILTER (WHERE t.trans_status <> 1) AS declined_txns,
        ROUND(
          COUNT(*) FILTER (WHERE t.trans_status <> 1)::numeric / COUNT(*)::numeric * 100, 2
        ) AS decline_rate
      FROM dbo.payabli_transactions t
      LEFT JOIN dbo.payabli_paypoints pp ON pp.id_paypoint = t.paypointid
      WHERE t.transactiontime >= CURRENT_DATE - INTERVAL '7 days'
        AND t.org_id <> 2
        AND t.operation = 'Sale'
      GROUP BY t.paypointid, pp.dba_name, pp.legal_name
      HAVING COUNT(*) >= 20
        AND ROUND(
          COUNT(*) FILTER (WHERE t.trans_status <> 1)::numeric / COUNT(*)::numeric * 100, 2
        ) > 10
      ORDER BY decline_rate DESC
      LIMIT 10
    `;

    const webhookHealthQuery = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE success) AS succeeded
      FROM dbo.notification_logs
      WHERE created_date >= CURRENT_DATE - INTERVAL '7 days'
    `;

    const returnsQuery = `
      SELECT COUNT(*) AS count
      FROM dbo.payabli_returns
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    `;

    const chargebacksQuery = `
      SELECT COUNT(*) AS count
      FROM dbo.payabli_chargebacks
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    `;

    const [
      payInThisWeekRes,
      payInLastWeekRes,
      payOutRes,
      newCustomersRes,
      topMerchantsRes,
      declineRatesRes,
      webhookHealthRes,
      returnsRes,
      chargebacksRes,
    ] = await Promise.all([
      pool.query<VolumeRow>(payInThisWeekQuery),
      pool.query<VolumeRow>(payInLastWeekQuery),
      pool.query<VolumeRow>(payOutThisWeekQuery),
      pool.query<{ new_customers: string }>(newCustomersQuery),
      pool.query<MerchantVolumeRow>(topMerchantsQuery),
      pool.query<DeclineRow>(declineRatesQuery),
      pool.query<WebhookHealthRow>(webhookHealthQuery),
      pool.query<{ count: string }>(returnsQuery),
      pool.query<{ count: string }>(chargebacksQuery),
    ]);

    // -- Extract data -------------------------------------------------------

    const payInThisWeek = payInThisWeekRes.rows[0];
    const payInLastWeek = payInLastWeekRes.rows[0];
    const payOut = payOutRes.rows[0];
    const newCustomers = parseInt(newCustomersRes.rows[0]?.new_customers || "0", 10);
    const topMerchants = topMerchantsRes.rows;
    const elevatedDeclines = declineRatesRes.rows;
    const webhookHealth = webhookHealthRes.rows[0];
    const returnsCount = parseInt(returnsRes.rows[0]?.count || "0", 10);
    const chargebacksCount = parseInt(chargebacksRes.rows[0]?.count || "0", 10);

    const webhookTotal = parseInt(webhookHealth?.total || "0", 10);
    const webhookSucceeded = parseInt(webhookHealth?.succeeded || "0", 10);
    const webhookSuccessRate =
      webhookTotal > 0
        ? Math.round((webhookSucceeded / webhookTotal) * 1000) / 10
        : 100;

    // -- Step 2: Send to Claude for insight generation ----------------------

    const dataPayload = {
      payIn: {
        thisWeek: {
          volume: parseFloat(payInThisWeek?.volume || "0"),
          txCount: parseInt(payInThisWeek?.tx_count || "0", 10),
        },
        lastWeek: {
          volume: parseFloat(payInLastWeek?.volume || "0"),
          txCount: parseInt(payInLastWeek?.tx_count || "0", 10),
        },
      },
      payOut: {
        volume: parseFloat(payOut?.volume || "0"),
        txCount: parseInt(payOut?.tx_count || "0", 10),
      },
      newCustomers,
      topMerchantsByVolumeChange: topMerchants.map((m) => ({
        name: m.merchant_name || `Merchant ${m.paypointid}`,
        thisWeekVolume: parseFloat(m.this_week_volume),
        lastWeekVolume: parseFloat(m.last_week_volume),
        change: parseFloat(m.volume_change),
      })),
      elevatedDeclineRates: elevatedDeclines.map((d) => ({
        name: d.merchant_name || `Merchant ${d.paypointid}`,
        totalTxns: parseInt(d.total_txns, 10),
        declinedTxns: parseInt(d.declined_txns, 10),
        declineRate: d.decline_rate,
      })),
      webhookHealth: {
        total: webhookTotal,
        succeeded: webhookSucceeded,
        successRate: webhookSuccessRate,
      },
      alerts: {
        returns: returnsCount,
        chargebacks: chargebacksCount,
      },
    };

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system:
        "You are a portfolio analyst at Payabli. Generate a weekly intelligence digest. " +
        'Return a JSON object with: weekLabel (string like "Week of Apr 1, 2026"), ' +
        "insights (array of 3 {type: 'positive'|'warning'|'info', text: string} — key highlights), " +
        "expandedInsights (array of 4-6 additional insights with same format). " +
        "Use specific numbers. Mention merchant names. Be concise (1-2 sentences per insight). " +
        "Return ONLY JSON.",
      messages: [
        {
          role: "user",
          content: `Here is this week's portfolio data. Generate the weekly intelligence digest.\n\n${JSON.stringify(dataPayload, null, 2)}`,
        },
      ],
    });

    // -- Step 3: Parse and return response ----------------------------------

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    let parsed: {
      weekLabel: string;
      insights: Insight[];
      expandedInsights: Insight[];
    };

    try {
      const jsonStr = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse Claude digest response:", text.slice(0, 500));

      // Fallback: generate basic digest without AI
      const payInVolume = parseFloat(payInThisWeek?.volume || "0");
      const payInLastVolume = parseFloat(payInLastWeek?.volume || "0");
      const volumeChange =
        payInLastVolume > 0
          ? Math.round(((payInVolume - payInLastVolume) / payInLastVolume) * 100)
          : 0;

      parsed = {
        weekLabel: formatWeekLabel(),
        insights: [
          {
            type: volumeChange >= 0 ? "positive" : "warning",
            text: `Pay-in volume is $${formatCurrency(payInVolume)} this week (${volumeChange >= 0 ? "+" : ""}${volumeChange}% vs last week).`,
          },
          {
            type: elevatedDeclines.length > 0 ? "warning" : "positive",
            text:
              elevatedDeclines.length > 0
                ? `${elevatedDeclines.length} merchant(s) have decline rates above 10%.`
                : "No merchants with elevated decline rates this week.",
          },
          {
            type: "info",
            text: `${newCustomers} new customers onboarded. Webhook delivery at ${webhookSuccessRate}% success rate.`,
          },
        ],
        expandedInsights: [
          {
            type: "info",
            text: `Pay-out volume: $${formatCurrency(parseFloat(payOut?.volume || "0"))} across ${parseInt(payOut?.tx_count || "0", 10)} transactions.`,
          },
          {
            type: chargebacksCount > 0 ? "warning" : "positive",
            text: `${chargebacksCount} chargebacks and ${returnsCount} returns in the last 7 days.`,
          },
          {
            type: "info",
            text: `Webhook health: ${webhookSucceeded.toLocaleString()} of ${webhookTotal.toLocaleString()} deliveries succeeded.`,
          },
          {
            type: "info",
            text:
              topMerchants.length > 0
                ? `Top mover: ${topMerchants[0].merchant_name || "Unknown"} with $${formatCurrency(Math.abs(parseFloat(topMerchants[0].volume_change)))} volume change.`
                : "No significant merchant volume changes this week.",
          },
        ],
      };
    }

    const result: DigestResponse = {
      weekLabel: parsed.weekLabel,
      insights: parsed.insights,
      expandedInsights: parsed.expandedInsights,
      fromCache: false,
      generatedAt: new Date().toISOString(),
    };

    // Cache result
    digestCache.set(cacheKey, { data: result, ts: Date.now() });

    res.json(result);
  } catch (err: any) {
    console.error("Error in portfolio digest:", err);
    res.status(500).json({ error: err.message });
  }
});

// -- Force refresh endpoint -------------------------------------------------

portfolioDigestRouter.post("/refresh", async (_req, res) => {
  digestCache.clear();
  res.json({ cleared: true });
});

// -- Helpers ----------------------------------------------------------------

function formatWeekLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const month = monday.toLocaleString("en-US", { month: "short" });
  return `Week of ${month} ${monday.getDate()}, ${monday.getFullYear()}`;
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}
