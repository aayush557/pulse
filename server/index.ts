import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { metricsRouter } from "./routes/metrics.js";
import { alertsRouter } from "./routes/alerts.js";
import { merchantHealthRouter } from "./routes/merchantHealth.js";
import { pool } from "./db.js";

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/metrics", metricsRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/merchant-health", merchantHealthRouter);

app.get("/api/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", db: result.rows[0].ok === 1 });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Pulse API server running on http://localhost:${PORT}`);
});
