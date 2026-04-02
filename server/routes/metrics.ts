import { Router } from "express";
import { pool } from "../db.js";

export const metricsRouter = Router();

interface MetricValue {
  current: number;
  previous: number;
  changePercent: number;
  trend: number[];
  forecast: number[];
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(2));
}

function linearForecast(trend: number[], steps: number = 3): number[] {
  if (trend.length < 2) return [];
  const n = trend.length;
  const avgDelta = (trend[n - 1] - trend[0]) / (n - 1);
  const last = trend[n - 1];
  return Array.from({ length: steps }, (_, i) =>
    parseFloat((last + avgDelta * (i + 1)).toFixed(2))
  );
}

function buildMetric(current: number, previous: number, trend: number[]): MetricValue {
  return {
    current,
    previous,
    changePercent: calcChange(current, previous),
    trend,
    forecast: linearForecast(trend),
  };
}

metricsRouter.get("/summary", async (_req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayOfMonth = now.getDate();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), dayOfMonth + 1);

    // Previous period: same number of days in previous month
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevPeriod = new Date(now.getFullYear(), now.getMonth() - 1, dayOfMonth + 1);

    // --- Pay In: Current period ---
    const payinCurrentQuery = `
      SELECT
        COALESCE(SUM(total_amount), 0) AS volume,
        COUNT(*) AS tx_count,
        COUNT(DISTINCT payorid) AS customers
      FROM dbo.payabli_transactions
      WHERE transactiontime >= $1 AND transactiontime < $2
        AND org_id <> 2
        AND trans_status = 1
        AND operation = 'Sale'
    `;

    // --- Pay In: Previous period ---
    const payinPrevQuery = `
      SELECT
        COALESCE(SUM(total_amount), 0) AS volume,
        COUNT(*) AS tx_count,
        COUNT(DISTINCT payorid) AS customers
      FROM dbo.payabli_transactions
      WHERE transactiontime >= $1 AND transactiontime < $2
        AND org_id <> 2
        AND trans_status = 1
        AND operation = 'Sale'
    `;

    // --- Pay In: 7-day daily trend ---
    const payinTrendQuery = `
      SELECT
        DATE(transactiontime) AS day,
        COALESCE(SUM(total_amount), 0) AS volume,
        COUNT(*) AS tx_count,
        COUNT(DISTINCT payorid) AS customers
      FROM dbo.payabli_transactions
      WHERE transactiontime >= CURRENT_DATE - INTERVAL '7 days'
        AND transactiontime < CURRENT_DATE + INTERVAL '1 day'
        AND org_id <> 2
        AND trans_status = 1
        AND operation = 'Sale'
      GROUP BY DATE(transactiontime)
      ORDER BY day
    `;

    // --- New customers (payors created in period) ---
    const newCustomersCurrentQuery = `
      SELECT COUNT(*) AS new_customers
      FROM dbo.payabli_payors_login
      WHERE created_at >= $1 AND created_at < $2
    `;
    const newCustomersPrevQuery = `
      SELECT COUNT(*) AS new_customers
      FROM dbo.payabli_payors_login
      WHERE created_at >= $1 AND created_at < $2
    `;
    const newCustomersTrendQuery = `
      SELECT DATE(created_at) AS day, COUNT(*) AS new_customers
      FROM dbo.payabli_payors_login
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
      GROUP BY DATE(created_at)
      ORDER BY day
    `;

    // --- Total customers ---
    const totalCustomersQuery = `
      SELECT COUNT(*) AS total FROM dbo.payabli_payors_login WHERE payor_status = 1
    `;

    // --- Pay Out: Current period ---
    const payoutCurrentQuery = `
      SELECT
        COALESCE(SUM(total_amount), 0) AS volume,
        COUNT(*) AS tx_count
      FROM dbo.payabli_out_transaction
      WHERE created_at >= $1 AND created_at < $2
        AND internal_status NOT IN (0)
    `;

    // --- Pay Out: Previous period ---
    const payoutPrevQuery = `
      SELECT
        COALESCE(SUM(total_amount), 0) AS volume,
        COUNT(*) AS tx_count
      FROM dbo.payabli_out_transaction
      WHERE created_at >= $1 AND created_at < $2
        AND internal_status NOT IN (0)
    `;

    // --- Pay Out: 7-day daily trend ---
    const payoutTrendQuery = `
      SELECT
        DATE(created_at) AS day,
        COALESCE(SUM(total_amount), 0) AS volume,
        COUNT(*) AS tx_count
      FROM dbo.payabli_out_transaction
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
        AND internal_status NOT IN (0)
      GROUP BY DATE(created_at)
      ORDER BY day
    `;

    // --- Vendors ---
    const vendorTotalQuery = `
      SELECT COUNT(*) AS total FROM dbo.payabli_vendors WHERE vendor_status = 1
    `;
    const vendorNewCurrentQuery = `
      SELECT COUNT(*) AS new_vendors
      FROM dbo.payabli_vendors WHERE created_at >= $1 AND created_at < $2
    `;
    const vendorNewPrevQuery = `
      SELECT COUNT(*) AS new_vendors
      FROM dbo.payabli_vendors WHERE created_at >= $1 AND created_at < $2
    `;

    const startISO = startOfMonth.toISOString();
    const endISO = tomorrow.toISOString();
    const prevStartISO = startOfPrevMonth.toISOString();
    const prevEndISO = endOfPrevPeriod.toISOString();

    const [
      payinCurr, payinPrev, payinTrend,
      newCustCurr, newCustPrev, newCustTrend,
      totalCust,
      payoutCurr, payoutPrev, payoutTrend,
      vendorTotal, vendorNewCurr, vendorNewPrev,
    ] = await Promise.all([
      pool.query(payinCurrentQuery, [startISO, endISO]),
      pool.query(payinPrevQuery, [prevStartISO, prevEndISO]),
      pool.query(payinTrendQuery),
      pool.query(newCustomersCurrentQuery, [startISO, endISO]),
      pool.query(newCustomersPrevQuery, [prevStartISO, prevEndISO]),
      pool.query(newCustomersTrendQuery),
      pool.query(totalCustomersQuery),
      pool.query(payoutCurrentQuery, [startISO, endISO]),
      pool.query(payoutPrevQuery, [prevStartISO, prevEndISO]),
      pool.query(payoutTrendQuery),
      pool.query(vendorTotalQuery),
      pool.query(vendorNewCurrentQuery, [startISO, endISO]),
      pool.query(vendorNewPrevQuery, [prevStartISO, prevEndISO]),
    ]);

    const piCurr = payinCurr.rows[0];
    const piPrev = payinPrev.rows[0];
    const piTrend = payinTrend.rows;

    const poCurr = payoutCurr.rows[0];
    const poPrev = payoutPrev.rows[0];
    const poTrend = payoutTrend.rows;

    const totalCustomers = parseInt(totalCust.rows[0].total);
    const totalVendors = parseInt(vendorTotal.rows[0].total);
    const newVendorsCurr = parseInt(vendorNewCurr.rows[0].new_vendors);
    const newVendorsPrev = parseInt(vendorNewPrev.rows[0].new_vendors);
    const newCustCurrVal = parseInt(newCustCurr.rows[0].new_customers);
    const newCustPrevVal = parseInt(newCustPrev.rows[0].new_customers);

    res.json({
      period: {
        start: startOfMonth.toISOString().split("T")[0],
        end: now.toISOString().split("T")[0],
        label: "Month to Date",
      },
      payIn: {
        transactionVolume: buildMetric(
          parseFloat(piCurr.volume),
          parseFloat(piPrev.volume),
          piTrend.map((r: any) => parseFloat(r.volume))
        ),
        transactionCount: buildMetric(
          parseInt(piCurr.tx_count),
          parseInt(piPrev.tx_count),
          piTrend.map((r: any) => parseInt(r.tx_count))
        ),
        customers: buildMetric(
          totalCustomers,
          totalCustomers - newCustCurrVal + newCustPrevVal,
          piTrend.map((r: any) => parseInt(r.customers))
        ),
        newCustomers: buildMetric(
          newCustCurrVal,
          newCustPrevVal,
          newCustTrend.rows.map((r: any) => parseInt(r.new_customers))
        ),
      },
      payOut: {
        transactionVolume: buildMetric(
          parseFloat(poCurr.volume),
          parseFloat(poPrev.volume),
          poTrend.map((r: any) => parseFloat(r.volume))
        ),
        transactionCount: buildMetric(
          parseInt(poCurr.tx_count),
          parseInt(poPrev.tx_count),
          poTrend.map((r: any) => parseInt(r.tx_count))
        ),
        vendors: buildMetric(
          totalVendors,
          totalVendors - newVendorsCurr + newVendorsPrev,
          [] // vendor count doesn't vary daily
        ),
        newVendors: buildMetric(newVendorsCurr, newVendorsPrev, []),
      },
    });
  } catch (err: any) {
    console.error("Error fetching metrics:", err);
    res.status(500).json({ error: err.message });
  }
});
