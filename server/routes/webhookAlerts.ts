import { Router } from "express";
import { pool } from "../db.js";
import {
  classifyFailure,
  severityForType,
  replyTemplates,
  type WebhookFailureType,
  type ReplyContext,
} from "../templates/webhookReplies.js";

export const webhookAlertsRouter = Router();

webhookAlertsRouter.get("/", async (_req, res) => {
  try {
    // Grouped failures by target + status code
    const failuresQuery = `
      SELECT
        nl.target,
        nl.response_status_code,
        nl.response_status_code_description,
        COUNT(*) AS fail_count,
        MIN(nl.created_date) AS first_failure,
        MAX(nl.created_date) AS last_failure,
        array_agg(DISTINCT nl.notification_event) FILTER (WHERE nl.notification_event IS NOT NULL) AS affected_events,
        array_agg(DISTINCT nl.org_id) FILTER (WHERE nl.org_id IS NOT NULL) AS org_ids,
        COUNT(DISTINCT nl.paypoint_id) FILTER (WHERE nl.paypoint_id IS NOT NULL) AS affected_paypoints,
        LEFT(MAX(nl.response_content), 300) AS error_sample
      FROM dbo.notification_logs nl
      WHERE nl.created_date >= CURRENT_DATE - INTERVAL '30 days'
        AND NOT nl.success
      GROUP BY nl.target, nl.response_status_code, nl.response_status_code_description
      HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) DESC
      LIMIT 30
    `;

    // Org names for the org_ids we find
    const orgNamesQuery = `
      SELECT id_org, org_name
      FROM dbo.payabli_organizations
      WHERE id_org = ANY($1)
    `;

    // Overall success rate
    const overallQuery = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE success) AS succeeded,
        COUNT(*) FILTER (WHERE NOT success) AS failed
      FROM dbo.notification_logs
      WHERE created_date >= CURRENT_DATE - INTERVAL '30 days'
    `;

    const [failuresRes, overallRes] = await Promise.all([
      pool.query(failuresQuery),
      pool.query(overallQuery),
    ]);

    // Collect all org_ids to resolve names in one query
    const allOrgIds = new Set<number>();
    for (const row of failuresRes.rows) {
      if (row.org_ids) {
        for (const id of row.org_ids) {
          if (id) allOrgIds.add(id);
        }
      }
    }

    const orgNameMap = new Map<number, string>();
    if (allOrgIds.size > 0) {
      const orgRes = await pool.query(orgNamesQuery, [
        Array.from(allOrgIds),
      ]);
      for (const row of orgRes.rows) {
        orgNameMap.set(row.id_org, row.org_name);
      }
    }

    // Build classified alerts
    const alerts = failuresRes.rows.map((row, idx) => {
      const failureType = classifyFailure(
        row.response_status_code,
        row.response_status_code_description,
        row.error_sample
      );

      const orgNames = (row.org_ids || [])
        .filter((id: number | null) => id !== null)
        .map((id: number) => orgNameMap.get(id) || `Org ${id}`)
        .slice(0, 5);

      const affectedEvents = (row.affected_events || []) as string[];
      const failCount = parseInt(row.fail_count, 10);

      const replyCtx: ReplyContext = {
        endpoint: row.target,
        failCount,
        affectedEvents,
        errorSnippet: row.error_sample || row.response_status_code_description || "No error detail available",
        firstFailure: new Date(row.first_failure).toLocaleDateString(),
        lastFailure: new Date(row.last_failure).toLocaleDateString(),
        affectedPaypoints: parseInt(row.affected_paypoints, 10) || 0,
      };

      const templateFn = replyTemplates[failureType];
      const suggestedReply = templateFn(replyCtx);

      return {
        id: `WH-${idx + 1}`,
        target: row.target,
        failureType,
        failCount,
        affectedEvents,
        affectedPaypoints: parseInt(row.affected_paypoints, 10) || 0,
        orgNames,
        errorSample:
          row.error_sample ||
          row.response_status_code_description ||
          `HTTP ${row.response_status_code}`,
        firstFailure: row.first_failure,
        lastFailure: row.last_failure,
        successRate: 0, // filled below
        suggestedReply,
        severity: severityForType(failureType, failCount),
      };
    });

    // Calculate per-target success rates
    if (alerts.length > 0) {
      const targets = [...new Set(alerts.map((a) => a.target))];
      const rateQuery = `
        SELECT
          target,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE success) AS succeeded
        FROM dbo.notification_logs
        WHERE created_date >= CURRENT_DATE - INTERVAL '30 days'
          AND target = ANY($1)
        GROUP BY target
      `;
      const rateRes = await pool.query(rateQuery, [targets]);
      const rateMap = new Map<string, number>();
      for (const r of rateRes.rows) {
        const total = parseInt(r.total, 10);
        const succeeded = parseInt(r.succeeded, 10);
        rateMap.set(r.target, total > 0 ? Math.round((succeeded / total) * 1000) / 10 : 100);
      }
      for (const alert of alerts) {
        alert.successRate = rateMap.get(alert.target) ?? 100;
      }
    }

    const overall = overallRes.rows[0];
    const totalAll = parseInt(overall.total, 10);
    const succeededAll = parseInt(overall.succeeded, 10);
    const failedAll = parseInt(overall.failed, 10);

    res.json({
      alerts,
      overallSuccessRate:
        totalAll > 0 ? Math.round((succeededAll / totalAll) * 1000) / 10 : 100,
      totalFailures: failedAll,
    });
  } catch (err: any) {
    console.error("Error fetching webhook alerts:", err);
    res.status(500).json({ error: err.message });
  }
});
