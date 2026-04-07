import { Router } from "express";
import { pool } from "../db.js";
import Anthropic from "@anthropic-ai/sdk";
import { classifyFailure, type WebhookFailureType } from "../templates/webhookReplies.js";

export const notificationFailuresRouter = Router();

const anthropic = new Anthropic();

// ── Types ──────────────────────────────────────────────────────────────

interface FailureGroup {
  id: string;
  groupKey: string;
  endpoint: string;
  endpointHost: string;
  failureType: WebhookFailureType;
  failureLabel: string;
  statusCode: number;
  failCount: number;
  firstFailure: string;
  lastFailure: string;
  affectedEvents: string[];
  affectedPaypoints: number;
  orgs: { id: number; name: string }[];
  errorSamples: string[];
  successRate: number;
  totalDeliveries: number;
  isOngoing: boolean;
}

interface AnalyzedGroup extends FailureGroup {
  aiAnalysis: {
    summary: string;
    rootCause: string;
    impact: string;
    ticketTitle: string;
    ticketBody: string;
    priority: "critical" | "high" | "medium" | "low";
  };
}

// Cache AI analysis for 10 minutes to avoid repeat calls
const analysisCache = new Map<string, { data: AnalyzedGroup[]; ts: number }>();
const CACHE_TTL = 10 * 60 * 1000;

const FAILURE_LABELS: Record<WebhookFailureType, string> = {
  timeout: "Timeout",
  rate_limited: "Rate Limited",
  dead_endpoint: "Dead Endpoint",
  handler_error: "Handler Error",
  server_error: "Server Error",
};

// ── Main endpoint ──────────────────────────────────────────────────────

notificationFailuresRouter.get("/", async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const cacheKey = `failures-${days}`;

    // Check cache
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return res.json({
        groups: cached.data,
        fromCache: true,
        generatedAt: new Date(cached.ts).toISOString(),
      });
    }

    // ── Step 1: Pull grouped failures from DB ────────────────────────

    const groupedQuery = `
      WITH failure_groups AS (
        SELECT
          nl.target,
          nl.response_status_code,
          nl.response_status_code_description,
          COUNT(*) AS fail_count,
          MIN(nl.created_date) AS first_failure,
          MAX(nl.created_date) AS last_failure,
          array_agg(DISTINCT nl.notification_event)
            FILTER (WHERE nl.notification_event IS NOT NULL) AS affected_events,
          array_agg(DISTINCT nl.org_id)
            FILTER (WHERE nl.org_id IS NOT NULL) AS org_ids,
          COUNT(DISTINCT nl.paypoint_id)
            FILTER (WHERE nl.paypoint_id IS NOT NULL) AS affected_paypoints
        FROM dbo.notification_logs nl
        WHERE nl.created_date >= CURRENT_DATE - $1 * INTERVAL '1 day'
          AND NOT nl.success
        GROUP BY nl.target, nl.response_status_code, nl.response_status_code_description
        HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC
        LIMIT 40
      )
      SELECT * FROM failure_groups
    `;

    // Error samples: get a few distinct response bodies per group
    const samplesQuery = `
      SELECT DISTINCT ON (target, response_status_code)
        target,
        response_status_code,
        LEFT(response_content, 400) AS sample,
        LEFT(response_status_code_description, 200) AS status_desc
      FROM dbo.notification_logs
      WHERE created_date >= CURRENT_DATE - $1 * INTERVAL '1 day'
        AND NOT success
        AND (response_content IS NOT NULL OR response_status_code_description IS NOT NULL)
      ORDER BY target, response_status_code, created_date DESC
    `;

    // Overall delivery stats per target
    const statsQuery = `
      SELECT
        target,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE success) AS succeeded
      FROM dbo.notification_logs
      WHERE created_date >= CURRENT_DATE - $1 * INTERVAL '1 day'
      GROUP BY target
    `;

    const [groupedRes, samplesRes, statsRes] = await Promise.all([
      pool.query(groupedQuery, [days]),
      pool.query(samplesQuery, [days]),
      pool.query(statsQuery, [days]),
    ]);

    // Resolve org names
    const allOrgIds = new Set<number>();
    for (const row of groupedRes.rows) {
      for (const id of row.org_ids || []) {
        if (id) allOrgIds.add(id);
      }
    }

    const orgMap = new Map<number, string>();
    if (allOrgIds.size > 0) {
      const orgRes = await pool.query(
        `SELECT id_org, org_name FROM dbo.payabli_organizations WHERE id_org = ANY($1)`,
        [Array.from(allOrgIds)]
      );
      for (const r of orgRes.rows) orgMap.set(r.id_org, r.org_name);
    }

    // Build sample map
    const sampleMap = new Map<string, string[]>();
    for (const r of samplesRes.rows) {
      const key = `${r.target}|${r.response_status_code}`;
      const samples = sampleMap.get(key) || [];
      samples.push(r.sample || r.status_desc || `HTTP ${r.response_status_code}`);
      sampleMap.set(key, samples);
    }

    // Build stats map
    const statsMap = new Map<string, { total: number; succeeded: number }>();
    for (const r of statsRes.rows) {
      statsMap.set(r.target, {
        total: parseInt(r.total, 10),
        succeeded: parseInt(r.succeeded, 10),
      });
    }

    // ── Step 2: Classify and structure groups ────────────────────────

    const ongoingCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const groups: FailureGroup[] = groupedRes.rows.map((row, idx) => {
      const failureType = classifyFailure(
        row.response_status_code,
        row.response_status_code_description,
        sampleMap.get(`${row.target}|${row.response_status_code}`)?.[0] || null
      );

      const orgIds = (row.org_ids || []).filter((id: number | null) => id !== null);
      const orgs = orgIds.slice(0, 5).map((id: number) => ({
        id,
        name: orgMap.get(id) || `Org ${id}`,
      }));

      let host: string;
      try {
        host = new URL(row.target).hostname;
      } catch {
        host = row.target.slice(0, 40);
      }

      const stats = statsMap.get(row.target);
      const total = stats?.total ?? 0;
      const succeeded = stats?.succeeded ?? 0;
      const successRate = total > 0 ? Math.round((succeeded / total) * 1000) / 10 : 100;

      return {
        id: `NF-${idx + 1}`,
        groupKey: `${host}|${failureType}`,
        endpoint: row.target,
        endpointHost: host,
        failureType,
        failureLabel: FAILURE_LABELS[failureType],
        statusCode: row.response_status_code,
        failCount: parseInt(row.fail_count, 10),
        firstFailure: row.first_failure,
        lastFailure: row.last_failure,
        affectedEvents: (row.affected_events || []) as string[],
        affectedPaypoints: parseInt(row.affected_paypoints, 10) || 0,
        orgs,
        errorSamples: sampleMap.get(`${row.target}|${row.response_status_code}`) || [],
        successRate,
        totalDeliveries: total,
        isOngoing: new Date(row.last_failure) > ongoingCutoff,
      };
    });

    // ── Step 3: Merge groups by host+failureType ─────────────────────
    // Multiple status codes from same host with same failure type get merged

    const mergedMap = new Map<string, FailureGroup>();
    for (const g of groups) {
      const existing = mergedMap.get(g.groupKey);
      if (existing) {
        existing.failCount += g.failCount;
        existing.affectedPaypoints = Math.max(existing.affectedPaypoints, g.affectedPaypoints);
        existing.affectedEvents = [...new Set([...existing.affectedEvents, ...g.affectedEvents])];
        existing.errorSamples = [...new Set([...existing.errorSamples, ...g.errorSamples])].slice(0, 3);
        for (const org of g.orgs) {
          if (!existing.orgs.find((o) => o.id === org.id)) existing.orgs.push(org);
        }
        if (new Date(g.firstFailure) < new Date(existing.firstFailure)) existing.firstFailure = g.firstFailure;
        if (new Date(g.lastFailure) > new Date(existing.lastFailure)) existing.lastFailure = g.lastFailure;
        existing.isOngoing = existing.isOngoing || g.isOngoing;
        existing.totalDeliveries += g.totalDeliveries;
        // Recalculate success rate
        const totalSucceeded = Math.round((existing.successRate / 100) * (existing.totalDeliveries - g.totalDeliveries))
          + Math.round((g.successRate / 100) * g.totalDeliveries);
        existing.successRate = existing.totalDeliveries > 0
          ? Math.round((totalSucceeded / existing.totalDeliveries) * 1000) / 10
          : 100;
      } else {
        mergedMap.set(g.groupKey, { ...g });
      }
    }

    const mergedGroups = Array.from(mergedMap.values()).sort(
      (a, b) => b.failCount - a.failCount
    );

    // ── Step 4: AI analysis with Claude ──────────────────────────────

    const analyzed = await analyzeGroups(mergedGroups);

    // Cache result
    analysisCache.set(cacheKey, { data: analyzed, ts: Date.now() });

    res.json({
      groups: analyzed,
      fromCache: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Error in notification failures:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Force refresh endpoint ─────────────────────────────────────────────

notificationFailuresRouter.post("/refresh", async (_req, res) => {
  analysisCache.clear();
  res.json({ cleared: true });
});

// ── Claude analysis ────────────────────────────────────────────────────

async function analyzeGroups(
  groups: FailureGroup[]
): Promise<AnalyzedGroup[]> {
  if (groups.length === 0) return [];

  // Build a concise summary of all groups for Claude
  const groupSummaries = groups.map((g, i) => {
    return `Group ${i + 1} [${g.id}]:
  Endpoint: ${g.endpoint}
  Type: ${g.failureLabel} (HTTP ${g.statusCode})
  Failures: ${g.failCount} | Success rate: ${g.successRate}% | Ongoing: ${g.isOngoing}
  Period: ${new Date(g.firstFailure).toLocaleDateString()} – ${new Date(g.lastFailure).toLocaleDateString()}
  Orgs: ${g.orgs.map((o) => o.name).join(", ")}
  Events: ${g.affectedEvents.join(", ")}
  Paypoints affected: ${g.affectedPaypoints}
  Error samples: ${g.errorSamples.slice(0, 2).map((s) => `"${s.slice(0, 200)}"`).join(" | ")}`;
  }).join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `You are an SRE analyst at a payment platform (Payabli). Analyze these webhook notification delivery failure groups and for EACH group produce a JSON analysis.

${groupSummaries}

For each group, return a JSON array where each element has:
- "id": the group ID (e.g. "NF-1")
- "summary": 1 sentence plain-English summary of the problem
- "rootCause": 1-2 sentence technical root cause
- "impact": 1 sentence on business impact (mention affected orgs/paypoints)
- "ticketTitle": concise Linear ticket title, max 80 chars
- "ticketBody": full ticket description in markdown (include endpoint, error detail, affected orgs, recommended fix steps, priority justification). 5-10 lines.
- "priority": "critical" | "high" | "medium" | "low" based on: ongoing=critical if >1000 fails, high if ongoing, medium if resolved, low if <10 fails

Return ONLY a JSON array, no other text.`,
      },
    ],
  });

  // Parse Claude's response
  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  let analyses: Array<{
    id: string;
    summary: string;
    rootCause: string;
    impact: string;
    ticketTitle: string;
    ticketBody: string;
    priority: "critical" | "high" | "medium" | "low";
  }>;

  try {
    // Try direct parse first
    analyses = JSON.parse(text);
  } catch {
    try {
      // Remove markdown code fences
      let jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      // Extract JSON array - find the first [ and last ]
      const startIdx = jsonStr.indexOf("[");
      const endIdx = jsonStr.lastIndexOf("]");
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonStr = jsonStr.substring(startIdx, endIdx + 1);
      }

      analyses = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse Claude response:", text.slice(0, 500));
      // Fallback: generate basic analysis without AI
      analyses = groups.map((g) => ({
        id: g.id,
        summary: `${g.failureLabel} failures hitting ${g.endpointHost} (${g.failCount} failures).`,
        rootCause: `Endpoint returning HTTP ${g.statusCode}. ${g.errorSamples[0]?.slice(0, 100) || "No error detail."}`,
        impact: `Affecting ${g.affectedPaypoints} paypoints across ${g.orgs.map((o) => o.name).join(", ")}.`,
        ticketTitle: `[Webhook] ${g.failureLabel}: ${g.endpointHost} — ${g.failCount} failures`,
        ticketBody: `**Endpoint:** ${g.endpoint}\n**Failures:** ${g.failCount}\n**Period:** ${new Date(g.firstFailure).toLocaleDateString()} – ${new Date(g.lastFailure).toLocaleDateString()}\n**Orgs:** ${g.orgs.map((o) => o.name).join(", ")}\n**Error:** ${g.errorSamples[0]?.slice(0, 200) || "N/A"}`,
        priority: g.isOngoing && g.failCount > 1000 ? "critical" : g.isOngoing ? "high" : "medium",
      }));
    }
  }

  // Merge AI analysis back onto groups
  const analysisMap = new Map(analyses.map((a) => [a.id, a]));

  return groups.map((g) => {
    const ai = analysisMap.get(g.id) || {
      summary: `${g.failureLabel} failures on ${g.endpointHost}.`,
      rootCause: `HTTP ${g.statusCode} from endpoint.`,
      impact: `${g.failCount} failed deliveries.`,
      ticketTitle: `[Webhook] ${g.failureLabel}: ${g.endpointHost}`,
      ticketBody: `${g.failCount} failures on ${g.endpoint}`,
      priority: "medium" as const,
    };
    return { ...g, aiAnalysis: ai };
  });
}
