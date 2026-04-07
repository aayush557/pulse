import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock DB pool ──────────────────────────────────────────────────────────

const mockQuery = vi.fn();

vi.mock("../db.js", () => ({
  pool: {
    query: mockQuery,
    on: vi.fn(),
  },
}));

// ── Mock env loader (prevent dotenv from running) ─────────────────────────

vi.mock("../env.js", () => ({}));

// ── Mock Anthropic SDK ────────────────────────────────────────────────────

const mockClaudeCreate = vi.fn().mockResolvedValue({
  content: [{ type: "text", text: '{"response": "test"}' }],
});

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockClaudeCreate },
  })),
}));

// ── Mock global fetch (for slack, webhook tests) ──────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Helper: create an Express app mounting a router at a prefix ───────────

function buildApp(prefix: string, router: express.Router): express.Express {
  const app = express();
  app.use(express.json());
  app.use(prefix, router);
  return app;
}

// ═══════════════════════════════════════════════════════════════════════════
//  1. ALERTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Alerts Route – GET /", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    mockQuery.mockReset();
    const { alertsRouter } = await import("../routes/alerts.js");
    app = buildApp("/alerts", alertsRouter);
  });

  const fakePayoutRow = {
    id: 101,
    title: "Payout returned",
    subtitle: "Acme Corp",
    merchant: "PPID 5",
    amount: "500.00",
    reason_code: "R01",
    reason: "Insufficient funds",
    return_date: "2026-03-30",
    created_at: "2026-03-30T12:00:00Z",
  };

  const fakeChargebackRow = {
    id: 201,
    title: "Chargeback received",
    subtitle: "Beta LLC",
    merchant: "PPID 8",
    amount: "250.00",
    reason_code: "4837",
    reason: "Fraud",
    chargeback_date: "2026-03-29",
    created_at: "2026-03-29T10:00:00Z",
  };

  const fakeDeclineRow = {
    id_paypoint: 10,
    merchant_name: "Gamma Inc",
    approved: 80,
    declined: 20,
    total: 100,
    decline_rate: "20.0",
  };

  const fakeInactiveRow = {
    id_paypoint: 15,
    merchant_name: "Delta Ltd",
    last_transaction: new Date(Date.now() - 10 * 86400000).toISOString(),
  };

  function mockAllAlertQueries() {
    mockQuery
      .mockResolvedValueOnce({ rows: [fakePayoutRow] })   // payouts
      .mockResolvedValueOnce({ rows: [fakeChargebackRow] }) // chargebacks
      .mockResolvedValueOnce({ rows: [fakeDeclineRow] })    // decline
      .mockResolvedValueOnce({ rows: [fakeInactiveRow] });  // inactive
  }

  it("returns alerts array with correct structure", async () => {
    mockAllAlertQueries();
    const res = await request(app).get("/alerts");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("alerts");
    expect(res.body).toHaveProperty("totalCount");
    expect(Array.isArray(res.body.alerts)).toBe(true);
    expect(res.body.alerts.length).toBe(4);
  });

  it("each alert has required fields", async () => {
    mockAllAlertQueries();
    const res = await request(app).get("/alerts");
    const alert = res.body.alerts[0];
    expect(alert).toHaveProperty("id");
    expect(alert).toHaveProperty("title");
    expect(alert).toHaveProperty("subtitle");
    expect(alert).toHaveProperty("category");
    expect(alert).toHaveProperty("status");
    expect(alert).toHaveProperty("timestamp");
    expect(alert).toHaveProperty("details");
  });

  it("GET /?days=7 uses 7-day interval (valid whitelist)", async () => {
    mockAllAlertQueries();
    await request(app).get("/alerts?days=7");
    const firstCallSql = mockQuery.mock.calls[0][0] as string;
    expect(firstCallSql).toContain("7 days");
  });

  it("GET /?days=30 uses 30-day interval", async () => {
    mockAllAlertQueries();
    await request(app).get("/alerts?days=30");
    const firstCallSql = mockQuery.mock.calls[0][0] as string;
    expect(firstCallSql).toContain("30 days");
  });

  it("GET /?days=999 defaults to 7 (invalid value)", async () => {
    mockAllAlertQueries();
    await request(app).get("/alerts?days=999");
    const firstCallSql = mockQuery.mock.calls[0][0] as string;
    expect(firstCallSql).toContain("7 days");
  });

  it("GET /?days=abc defaults to 7 (non-numeric)", async () => {
    mockAllAlertQueries();
    await request(app).get("/alerts?days=abc");
    const firstCallSql = mockQuery.mock.calls[0][0] as string;
    expect(firstCallSql).toContain("7 days");
  });

  it("alerts are sorted by timestamp descending", async () => {
    mockAllAlertQueries();
    const res = await request(app).get("/alerts");
    const timestamps = res.body.alerts.map((a: any) => new Date(a.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("DB down"));
    const res = await request(app).get("/alerts");
    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty("error");
  });
});

describe("Alerts Route – GET /resolutions", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    mockQuery.mockReset();
    const { alertsRouter } = await import("../routes/alerts.js");
    app = buildApp("/alerts", alertsRouter);
  });

  it("returns resolutions array", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ alert_id: "RET-1", action: "resolved", created_at: "2026-03-30T12:00:00Z" }],
    });
    const res = await request(app).get("/alerts/resolutions");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("resolutions");
    expect(res.body.resolutions).toHaveLength(1);
  });

  it("returns empty array when table does not exist (error handling)", async () => {
    mockQuery.mockRejectedValueOnce(new Error('relation "pulse.alert_resolutions" does not exist'));
    const res = await request(app).get("/alerts/resolutions");
    expect(res.status).toBe(200);
    expect(res.body.resolutions).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  2. ALERT ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe("Alert Actions Route", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    mockQuery.mockReset();
    mockClaudeCreate.mockReset();
    mockFetch.mockReset();
    const { alertActionsRouter } = await import("../routes/alertActions.js");
    app = buildApp("/alert-actions", alertActionsRouter);
  });

  describe("POST /:id/action", () => {
    it("resolve returns success", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // INSERT resolution
      const res = await request(app)
        .post("/alert-actions/RET-101/action")
        .send({ actionType: "resolve" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("resolvedAt");
    });

    it("dismiss returns success", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post("/alert-actions/CB-201/action")
        .send({ actionType: "dismiss" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("dismissedAt");
    });

    it("test_webhook with valid endpoint returns response with correct shape", async () => {
      // The route calls global fetch on the provided endpoint.
      // In the test environment fetch hits a non-existent URL and the route
      // catches the error, returning { success: false, statusCode: 0, responseTime, error }.
      // We verify the response shape is correct regardless.
      const res = await request(app)
        .post("/alert-actions/RET-101/action")
        .send({ actionType: "test_webhook", params: { endpoint: "https://example.com/hook" } });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success");
      expect(res.body).toHaveProperty("statusCode");
      expect(res.body).toHaveProperty("responseTime");
      expect(typeof res.body.responseTime).toBe("number");
    });

    it("test_webhook without endpoint returns 400", async () => {
      const res = await request(app)
        .post("/alert-actions/RET-101/action")
        .send({ actionType: "test_webhook" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("endpoint");
    });

    it("retry_payout returns requiresIntegration", async () => {
      const res = await request(app)
        .post("/alert-actions/RET-101/action")
        .send({ actionType: "retry_payout" });
      expect(res.status).toBe(200);
      expect(res.body.requiresIntegration).toBe(true);
      expect(res.body.success).toBe(false);
    });

    it("rotate_token returns requiresIntegration", async () => {
      const res = await request(app)
        .post("/alert-actions/DEC-10/action")
        .send({ actionType: "rotate_token" });
      expect(res.status).toBe(200);
      expect(res.body.requiresIntegration).toBe(true);
    });

    it("missing actionType returns 400", async () => {
      const res = await request(app)
        .post("/alert-actions/RET-101/action")
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("actionType");
    });

    it("unknown actionType returns 400", async () => {
      const res = await request(app)
        .post("/alert-actions/RET-101/action")
        .send({ actionType: "unknown_action" });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Unknown actionType");
    });
  });

  describe("POST /:id/insight", () => {
    it("returns insight text from Claude for RET alert", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          amount: "500.00",
          reason_code: "R01",
          reason: "Insufficient funds",
          return_date: "2026-03-30",
          merchant_name: "Acme Corp",
          returns_90d: 3,
        }],
      });
      mockClaudeCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "Acme Corp has had 3 returns in 90 days." }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE insight

      const res = await request(app)
        .post("/alert-actions/RET-101/insight")
        .send({});
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("insight");
      expect(res.body.insight).toContain("Acme Corp");
    });

    it("returns fallback when DB query returns no data", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // empty result for DEC prefix
      const res = await request(app)
        .post("/alert-actions/DEC-999/insight")
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.insight).toContain("Pulse will continue monitoring");
    });

    it("returns fallback on error", async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB down"));
      const res = await request(app)
        .post("/alert-actions/RET-101/insight")
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.insight).toContain("Pulse will continue monitoring");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  3. METRICS
// ═══════════════════════════════════════════════════════════════════════════

describe("Metrics Route – GET /summary", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    mockQuery.mockReset();
    const { metricsRouter } = await import("../routes/metrics.js");
    app = buildApp("/metrics", metricsRouter);
  });

  function mockAllMetricsQueries() {
    // 13 parallel queries in metrics/summary
    mockQuery
      .mockResolvedValueOnce({ rows: [{ volume: "100000", tx_count: "500", customers: "50" }] })  // payinCurr
      .mockResolvedValueOnce({ rows: [{ volume: "80000", tx_count: "400", customers: "40" }] })   // payinPrev
      .mockResolvedValueOnce({ rows: [                                                             // payinTrend
        { day: "2026-03-27", volume: "12000", tx_count: "60", customers: "10" },
        { day: "2026-03-28", volume: "13000", tx_count: "65", customers: "11" },
        { day: "2026-03-29", volume: "14000", tx_count: "70", customers: "12" },
      ] })
      .mockResolvedValueOnce({ rows: [{ new_customers: "20" }] })   // newCustCurr
      .mockResolvedValueOnce({ rows: [{ new_customers: "15" }] })   // newCustPrev
      .mockResolvedValueOnce({ rows: [                               // newCustTrend
        { day: "2026-03-27", new_customers: "3" },
        { day: "2026-03-28", new_customers: "4" },
        { day: "2026-03-29", new_customers: "5" },
      ] })
      .mockResolvedValueOnce({ rows: [{ total: "200" }] })          // totalCust
      .mockResolvedValueOnce({ rows: [{ volume: "50000", tx_count: "100" }] })  // payoutCurr
      .mockResolvedValueOnce({ rows: [{ volume: "40000", tx_count: "80" }] })   // payoutPrev
      .mockResolvedValueOnce({ rows: [                                           // payoutTrend
        { day: "2026-03-27", volume: "7000", tx_count: "14" },
        { day: "2026-03-28", volume: "7500", tx_count: "15" },
        { day: "2026-03-29", volume: "8000", tx_count: "16" },
      ] })
      .mockResolvedValueOnce({ rows: [{ total: "30" }] })             // vendorTotal
      .mockResolvedValueOnce({ rows: [{ new_vendors: "5" }] })        // vendorNewCurr
      .mockResolvedValueOnce({ rows: [{ new_vendors: "3" }] });       // vendorNewPrev
  }

  it("returns correct top-level structure", async () => {
    mockAllMetricsQueries();
    const res = await request(app).get("/metrics/summary");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("period");
    expect(res.body).toHaveProperty("payIn");
    expect(res.body).toHaveProperty("payOut");
    expect(res.body.period).toHaveProperty("start");
    expect(res.body.period).toHaveProperty("end");
    expect(res.body.period).toHaveProperty("label", "Month to Date");
  });

  it("each metric has current, previous, changePercent, trend, forecast", async () => {
    mockAllMetricsQueries();
    const res = await request(app).get("/metrics/summary");
    const tv = res.body.payIn.transactionVolume;
    expect(tv).toHaveProperty("current", 100000);
    expect(tv).toHaveProperty("previous", 80000);
    expect(tv).toHaveProperty("changePercent");
    expect(tv).toHaveProperty("trend");
    expect(tv).toHaveProperty("forecast");
    expect(Array.isArray(tv.trend)).toBe(true);
    expect(Array.isArray(tv.forecast)).toBe(true);
  });

  it("changePercent is calculated correctly", async () => {
    mockAllMetricsQueries();
    const res = await request(app).get("/metrics/summary");
    const tv = res.body.payIn.transactionVolume;
    // (100000 - 80000) / 80000 * 100 = 25
    expect(tv.changePercent).toBe(25);
  });

  it("forecast is computed from trend data (3 steps)", async () => {
    mockAllMetricsQueries();
    const res = await request(app).get("/metrics/summary");
    const tv = res.body.payIn.transactionVolume;
    // trend: [12000, 13000, 14000], avgDelta = (14000-12000)/2 = 1000
    // forecast: [15000, 16000, 17000]
    expect(tv.forecast).toHaveLength(3);
    expect(tv.forecast[0]).toBe(15000);
    expect(tv.forecast[1]).toBe(16000);
    expect(tv.forecast[2]).toBe(17000);
  });

  it("returns 500 on DB error", async () => {
    mockQuery.mockRejectedValueOnce(new Error("connection refused"));
    const res = await request(app).get("/metrics/summary");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  4. SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════

describe("Subscriptions Route", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    mockQuery.mockReset();
    const { subscriptionsRouter } = await import("../routes/subscriptions.js");
    app = buildApp("/subscriptions", subscriptionsRouter);
  });

  it("GET / returns default subscription state", async () => {
    const res = await request(app).get("/subscriptions");
    expect(res.status).toBe(200);
    expect(res.body.batch_holds).toBe(true);
    expect(res.body.payout_failures).toBe(true);
    expect(res.body.credential_expiry).toBe(true);
    expect(res.body.webhook_health).toBe(true);
    expect(res.body.merchant_inactivity).toBe(true);
    expect(res.body.decline_rate).toBe(false);
  });

  it("PUT / updates subscription state", async () => {
    const res = await request(app)
      .put("/subscriptions")
      .send({ decline_rate: true, batch_holds: false });
    expect(res.status).toBe(200);
    expect(res.body.decline_rate).toBe(true);
    expect(res.body.batch_holds).toBe(false);
  });

  it("PUT / with partial update merges correctly (unknown keys ignored)", async () => {
    const res = await request(app)
      .put("/subscriptions")
      .send({ unknown_key: true, payout_failures: false });
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("unknown_key");
    expect(res.body.payout_failures).toBe(false);
  });

  it("GET / after PUT reflects updated state", async () => {
    await request(app)
      .put("/subscriptions")
      .send({ webhook_health: false });
    const res = await request(app).get("/subscriptions");
    expect(res.body.webhook_health).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  5. SETTINGS RECOMMENDATIONS
// ═══════════════════════════════════════════════════════════════════════════

describe("Settings Recommendations Route", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    mockQuery.mockReset();
    const { settingsRecommendationsRouter } = await import("../routes/settingsRecommendations.js");
    app = buildApp("/settings-recommendations", settingsRecommendationsRouter);
  });

  function mockRecommendationQueries() {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ p50: "2500", p75: "4750", p90: "8200" }] })   // batchSizes
      .mockResolvedValueOnce({ rows: [{ median_gap: "1.5", p75_gap: "3.2", p90_gap: "6.8" }] }) // cadence
      .mockResolvedValueOnce({ rows: [{ p50: "5.5", p75: "9.2", p90: "14.7" }] });    // decline
  }

  it("GET / returns recommendations array with 3 items", async () => {
    mockRecommendationQueries();
    const res = await request(app).get("/settings-recommendations");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("recommendations");
    expect(res.body.recommendations).toHaveLength(3);
    expect(res.body).toHaveProperty("generatedAt");
  });

  it("each recommendation has required fields", async () => {
    mockRecommendationQueries();
    const res = await request(app).get("/settings-recommendations");
    const rec = res.body.recommendations[0];
    expect(rec).toHaveProperty("settingId");
    expect(rec).toHaveProperty("recommendedValue");
    expect(rec).toHaveProperty("explanation");
    expect(rec).toHaveProperty("dataPoints");
    expect(rec.dataPoints).toHaveProperty("p50");
    expect(rec.dataPoints).toHaveProperty("p75");
    expect(rec.dataPoints).toHaveProperty("p90");
  });

  it("batch holds recommendation is rounded to nearest $100", async () => {
    mockRecommendationQueries();
    const res = await request(app).get("/settings-recommendations");
    const batchRec = res.body.recommendations.find((r: any) => r.settingId === "batch_holds");
    // p75 = 4750, Math.round(4750/100)*100 = 4800
    expect(parseInt(batchRec.recommendedValue)).toBe(4800);
  });

  it("decline rate recommendation is ceiling of p90", async () => {
    mockRecommendationQueries();
    const res = await request(app).get("/settings-recommendations");
    const declineRec = res.body.recommendations.find((r: any) => r.settingId === "decline_rate");
    // p90 = 14.7, Math.ceil(14.7) = 15
    expect(parseInt(declineRec.recommendedValue)).toBe(15);
  });

  it("cache works (second call does not query DB again)", async () => {
    mockRecommendationQueries();
    await request(app).get("/settings-recommendations");
    const callCount = mockQuery.mock.calls.length;

    const res2 = await request(app).get("/settings-recommendations");
    expect(res2.status).toBe(200);
    // No additional DB calls
    expect(mockQuery.mock.calls.length).toBe(callCount);
  });

  it("POST /refresh clears cache", async () => {
    mockRecommendationQueries();
    await request(app).get("/settings-recommendations");

    const refreshRes = await request(app).post("/settings-recommendations/refresh");
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);

    // Next GET should hit DB again
    mockRecommendationQueries();
    await request(app).get("/settings-recommendations");
    // Should have made 3 new DB calls (total 6)
    expect(mockQuery.mock.calls.length).toBe(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  6. PREDICTIVE ALERTS
// ═══════════════════════════════════════════════════════════════════════════

describe("Predictive Alerts Route", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    mockQuery.mockReset();
    const { predictiveAlertsRouter } = await import("../routes/predictiveAlerts.js");
    app = buildApp("/predictive-alerts", predictiveAlertsRouter);
  });

  const merchantWithPositiveSlope = {
    paypointid: 42,
    merchant_name: "Rising Declines Inc",
    trend_data: ["8", "9", "10", "11", "12", "13", "14", "15"],
    days: ["2026-03-20", "2026-03-21", "2026-03-22", "2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27"],
    avg_rate: "11.5",
  };

  const merchantWithNegativeSlope = {
    paypointid: 43,
    merchant_name: "Improving Corp",
    trend_data: ["15", "14", "13", "12", "11", "10", "9", "8"],
    days: ["2026-03-20", "2026-03-21", "2026-03-22", "2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27"],
    avg_rate: "11.5",
  };

  const merchantBelowMinRate = {
    paypointid: 44,
    merchant_name: "Low Rate LLC",
    trend_data: ["1", "2", "2", "2", "3", "3", "3", "4"],
    days: ["2026-03-20", "2026-03-21", "2026-03-22", "2026-03-23", "2026-03-24", "2026-03-25", "2026-03-26", "2026-03-27"],
    avg_rate: "2.5",
  };

  it("GET / returns alerts array", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [merchantWithPositiveSlope] });
    const res = await request(app).get("/predictive-alerts");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("alerts");
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });

  it("only merchants with positive slope are included", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [merchantWithPositiveSlope, merchantWithNegativeSlope],
    });
    const res = await request(app).get("/predictive-alerts");
    const ids = res.body.alerts.map((a: any) => a.id);
    expect(ids).toContain("WATCH-42");
    expect(ids).not.toContain("WATCH-43");
  });

  it("only merchants with current rate >= 5% are included", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [merchantWithPositiveSlope, merchantBelowMinRate],
    });
    const res = await request(app).get("/predictive-alerts");
    const ids = res.body.alerts.map((a: any) => a.id);
    expect(ids).toContain("WATCH-42");
    expect(ids).not.toContain("WATCH-44");
  });

  it("projectedBreachDay is calculated correctly", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [merchantWithPositiveSlope] });
    const res = await request(app).get("/predictive-alerts");
    const alert = res.body.alerts[0];
    // last = 15, slope = (15-8)/7 = 1, threshold = 20
    // projected: 16, 17, 18, 19, 20 -> breach at day 5
    expect(alert.projectedBreachDay).toBe(5);
  });

  it("cache works (second call uses cached data)", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [merchantWithPositiveSlope] });
    await request(app).get("/predictive-alerts");
    const callCount = mockQuery.mock.calls.length;

    const res2 = await request(app).get("/predictive-alerts");
    expect(res2.status).toBe(200);
    expect(mockQuery.mock.calls.length).toBe(callCount);
  });

  it("POST /refresh clears cache", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [merchantWithPositiveSlope] });
    await request(app).get("/predictive-alerts");

    const refreshRes = await request(app).post("/predictive-alerts/refresh");
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.cleared).toBe(true);

    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res2 = await request(app).get("/predictive-alerts");
    expect(res2.body.alerts).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  7. SLACK
// ═══════════════════════════════════════════════════════════════════════════

describe("Slack Route – POST /support", () => {
  let app: express.Express;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.resetModules();
    mockFetch.mockReset();
    delete process.env.SLACK_WEBHOOK_URL;
    const { slackRouter } = await import("../routes/slack.js");
    app = buildApp("/slack", slackRouter);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("without SLACK_WEBHOOK_URL returns success with delivered: false", async () => {
    const res = await request(app)
      .post("/slack/support")
      .send({ message: "Help needed" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.delivered).toBe(false);
  });

  it("without message returns 400", async () => {
    const res = await request(app)
      .post("/slack/support")
      .send({ subject: "Test" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Message");
  });

  it("with valid webhook sends correctly", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test";
    // Re-import to pick up new env
    vi.resetModules();
    const { slackRouter: freshRouter } = await import("../routes/slack.js");
    const freshApp = buildApp("/slack", freshRouter);

    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const res = await request(freshApp)
      .post("/slack/support")
      .send({ message: "Test message", alertId: "RET-101" });
    expect(res.status).toBe(200);
    expect(res.body.delivered).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();

    // Verify the Block Kit payload includes the alert ID
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const blockTexts = JSON.stringify(fetchBody.blocks);
    expect(blockTexts).toContain("RET-101");
  });

  it("webhook failure returns 502", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test";
    vi.resetModules();
    const { slackRouter: freshRouter } = await import("../routes/slack.js");
    const freshApp = buildApp("/slack", freshRouter);

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("internal error"),
    });

    const res = await request(freshApp)
      .post("/slack/support")
      .send({ message: "Help" });
    expect(res.status).toBe(502);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  8. PORTFOLIO DIGEST
// ═══════════════════════════════════════════════════════════════════════════

describe("Portfolio Digest Route", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    mockQuery.mockReset();
    mockClaudeCreate.mockReset();
    const { portfolioDigestRouter } = await import("../routes/portfolioDigest.js");
    app = buildApp("/portfolio-digest", portfolioDigestRouter);
  });

  function mockAllDigestQueries() {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ volume: "250000", tx_count: "1200" }] })   // payInThisWeek
      .mockResolvedValueOnce({ rows: [{ volume: "220000", tx_count: "1100" }] })   // payInLastWeek
      .mockResolvedValueOnce({ rows: [{ volume: "60000", tx_count: "300" }] })     // payOutThisWeek
      .mockResolvedValueOnce({ rows: [{ new_customers: "25" }] })                  // newCustomers
      .mockResolvedValueOnce({ rows: [] })                                          // topMerchants
      .mockResolvedValueOnce({ rows: [] })                                          // declineRates
      .mockResolvedValueOnce({ rows: [{ total: "500", succeeded: "490" }] })       // webhookHealth
      .mockResolvedValueOnce({ rows: [{ count: "3" }] })                           // returns
      .mockResolvedValueOnce({ rows: [{ count: "1" }] });                          // chargebacks
  }

  it("GET / returns weekLabel, insights, expandedInsights", async () => {
    mockAllDigestQueries();
    mockClaudeCreate.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: JSON.stringify({
          weekLabel: "Week of Mar 30, 2026",
          insights: [
            { type: "positive", text: "Volume up 13.6% WoW." },
            { type: "info", text: "25 new customers." },
            { type: "warning", text: "3 returns this week." },
          ],
          expandedInsights: [
            { type: "info", text: "Pay-out at $60K." },
          ],
        }),
      }],
    });

    const res = await request(app).get("/portfolio-digest");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("weekLabel");
    expect(res.body).toHaveProperty("insights");
    expect(res.body).toHaveProperty("expandedInsights");
    expect(Array.isArray(res.body.insights)).toBe(true);
  });

  it("insights have correct shape", async () => {
    mockAllDigestQueries();
    mockClaudeCreate.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: JSON.stringify({
          weekLabel: "Week of Mar 30, 2026",
          insights: [{ type: "positive", text: "Good week." }],
          expandedInsights: [],
        }),
      }],
    });

    const res = await request(app).get("/portfolio-digest");
    const insight = res.body.insights[0];
    expect(insight).toHaveProperty("type");
    expect(insight).toHaveProperty("text");
    expect(["positive", "warning", "info"]).toContain(insight.type);
  });

  it("fallback works when Claude parsing fails", async () => {
    mockAllDigestQueries();
    mockClaudeCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "NOT VALID JSON!!!" }],
    });

    const res = await request(app).get("/portfolio-digest");
    expect(res.status).toBe(200);
    expect(res.body.insights.length).toBeGreaterThan(0);
    // Fallback generates basic insights from data
    expect(res.body.insights[0].text).toContain("$");
  });

  it("cache works", async () => {
    mockAllDigestQueries();
    mockClaudeCreate.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: JSON.stringify({
          weekLabel: "Week of Mar 30, 2026",
          insights: [{ type: "info", text: "Cached." }],
          expandedInsights: [],
        }),
      }],
    });
    await request(app).get("/portfolio-digest");
    const callCount = mockQuery.mock.calls.length;

    const res2 = await request(app).get("/portfolio-digest");
    expect(res2.status).toBe(200);
    expect(res2.body.fromCache).toBe(true);
    expect(mockQuery.mock.calls.length).toBe(callCount);
  });

  it("POST /refresh clears cache", async () => {
    mockAllDigestQueries();
    mockClaudeCreate.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: JSON.stringify({
          weekLabel: "W",
          insights: [],
          expandedInsights: [],
        }),
      }],
    });
    await request(app).get("/portfolio-digest");

    const refreshRes = await request(app).post("/portfolio-digest/refresh");
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.cleared).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  9. AMIGO CHAT
// ═══════════════════════════════════════════════════════════════════════════

describe("Amigo Chat Route", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    mockQuery.mockReset();
    mockClaudeCreate.mockReset();
    const { amigoRouter } = await import("../routes/amigo.js");
    app = buildApp("/amigo", amigoRouter);
  });

  function mockAmigoDbQueries() {
    // 4 parallel DB queries for context gathering
    mockQuery
      .mockResolvedValueOnce({ rows: [{ payin_volume: "100000", payin_count: "500", payout_volume: "50000", payout_count: "100" }] })
      .mockResolvedValueOnce({ rows: [{ returns_7d: "2", chargebacks_7d: "1", high_decline_merchants: "0", inactive_merchants: "3" }] })
      .mockResolvedValueOnce({ rows: [{ merchant_name: "TopMerch", volume: "20000", tx_count: "100", decline_rate: "2.5" }] })
      .mockResolvedValueOnce({ rows: [] });
  }

  it("POST /chat with message returns response", async () => {
    mockAmigoDbQueries();
    mockClaudeCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Your portfolio is healthy with $100,000 in pay-in volume this month." }],
    });

    const res = await request(app)
      .post("/amigo/chat")
      .send({ message: "How is my portfolio doing?" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("response");
    expect(typeof res.body.response).toBe("string");
  });

  it("POST /chat without message returns 400", async () => {
    const res = await request(app)
      .post("/amigo/chat")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("message");
  });

  it("context data is gathered from DB and passed to Claude", async () => {
    mockAmigoDbQueries();
    mockClaudeCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Response" }],
    });

    await request(app)
      .post("/amigo/chat")
      .send({ message: "test" });

    // Verify Claude was called with system message containing portfolio data
    expect(mockClaudeCreate).toHaveBeenCalledOnce();
    const claudeCall = mockClaudeCreate.mock.calls[0][0];
    expect(claudeCall.system).toContain("Portfolio Metrics");
    expect(claudeCall.system).toContain("100,000");
  });

  it("conversation history is forwarded to Claude", async () => {
    mockAmigoDbQueries();
    mockClaudeCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Follow-up response" }],
    });

    const history = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi! How can I help?" },
    ];

    await request(app)
      .post("/amigo/chat")
      .send({ message: "What about declines?", history });

    const claudeCall = mockClaudeCreate.mock.calls[0][0];
    // History (2) + new message (1) = 3 messages
    expect(claudeCall.messages).toHaveLength(3);
    expect(claudeCall.messages[0].content).toBe("Hello");
    expect(claudeCall.messages[2].content).toBe("What about declines?");
  });

  it("graceful fallback when DB queries fail", async () => {
    // All DB queries fail
    mockQuery.mockRejectedValue(new Error("connection timeout"));
    mockClaudeCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "I cannot access live data right now." }],
    });

    const res = await request(app)
      .post("/amigo/chat")
      .send({ message: "How is my portfolio?" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("response");
  });
});
