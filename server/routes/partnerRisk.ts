import { Router } from "express";

export const partnerRiskRouter = Router();

const ML_BASE = process.env.ML_API_URL || "http://localhost:8100";

partnerRiskRouter.get("/", async (req, res) => {
  try {
    const { tier, limit = "50", offset = "0" } = req.query;
    const params = new URLSearchParams();
    if (tier) params.set("tier", String(tier));
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    const response = await fetch(`${ML_BASE}/scores?${params}`);
    if (!response.ok) {
      throw new Error(`ML service responded ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error("Error proxying partner risk:", err.message);
    res.status(502).json({
      error: "ML service unavailable",
      detail: err.message,
    });
  }
});

partnerRiskRouter.get("/:partnerId", async (req, res) => {
  try {
    const response = await fetch(`${ML_BASE}/scores/${req.params.partnerId}`);
    if (!response.ok) {
      throw new Error(`ML service responded ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error("Error proxying partner risk detail:", err.message);
    res.status(502).json({
      error: "ML service unavailable",
      detail: err.message,
    });
  }
});

partnerRiskRouter.post("/refresh", async (_req, res) => {
  try {
    const response = await fetch(`${ML_BASE}/refresh`, { method: "POST" });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    console.error("Error refreshing ML pipeline:", err.message);
    res.status(502).json({
      error: "ML service unavailable",
      detail: err.message,
    });
  }
});
