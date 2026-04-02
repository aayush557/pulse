// ML Intelligence Layer mock data

export interface MerchantHealth {
  id: string;
  name: string;
  paypoint: string;
  healthTier: "healthy" | "monitoring" | "at_risk";
  healthLabel: string;
  insight: string;
  volumeTrend: number[]; // 7 days
  declineTrend: number[]; // 7 days
  chargebackTrend: number[]; // 7 days
  alertCount: number;
}

export const merchantHealthData: MerchantHealth[] = [
  {
    id: "mh-1",
    name: "Bickford Homes",
    paypoint: "PPID 3102",
    healthTier: "healthy",
    healthLabel: "Healthy",
    insight: "Volume up 12% this week",
    volumeTrend: [4200, 4800, 5100, 4900, 5300, 5800, 6100],
    declineTrend: [3.1, 2.8, 3.0, 2.9, 2.7, 3.2, 2.6],
    chargebackTrend: [0.1, 0.1, 0.0, 0.1, 0.0, 0.1, 0.0],
    alertCount: 0,
  },
  {
    id: "mh-2",
    name: "Castle Management",
    paypoint: "PPID 2890",
    healthTier: "healthy",
    healthLabel: "Healthy",
    insight: "Steady processing — no anomalies",
    volumeTrend: [8100, 7900, 8300, 8500, 8200, 8400, 8600],
    declineTrend: [4.0, 4.2, 3.8, 4.1, 3.9, 4.0, 3.7],
    chargebackTrend: [0.2, 0.1, 0.2, 0.1, 0.2, 0.1, 0.2],
    alertCount: 0,
  },
  {
    id: "mh-3",
    name: "Apex Roofing LLC",
    paypoint: "PPID 4821",
    healthTier: "at_risk",
    healthLabel: "At Risk",
    insight: "2 payout failures + webhook down",
    volumeTrend: [3200, 3100, 2800, 2600, 2400, 2100, 1800],
    declineTrend: [5.2, 6.1, 8.4, 12.3, 15.8, 17.2, 18.0],
    chargebackTrend: [0.3, 0.4, 0.5, 0.6, 0.8, 0.9, 1.1],
    alertCount: 3,
  },
  {
    id: "mh-4",
    name: "QuickFix Plumbing",
    paypoint: "PPID 3291",
    healthTier: "at_risk",
    healthLabel: "At Risk",
    insight: "Decline rate elevated — above 30-day baseline",
    volumeTrend: [2100, 1900, 1800, 1700, 1600, 1500, 1400],
    declineTrend: [6.1, 8.4, 12.0, 18.5, 24.2, 30.1, 34.2],
    chargebackTrend: [0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0],
    alertCount: 1,
  },
  {
    id: "mh-5",
    name: "Sunbound Homes",
    paypoint: "PPID 2641",
    healthTier: "monitoring",
    healthLabel: "Monitoring",
    insight: "Batch hold under review — monitoring",
    volumeTrend: [6800, 7200, 7100, 6900, 7400, 7000, 6500],
    declineTrend: [4.5, 5.0, 6.2, 8.1, 10.4, 12.8, 14.0],
    chargebackTrend: [0.3, 0.3, 0.4, 0.4, 0.5, 0.5, 0.6],
    alertCount: 1,
  },
  {
    id: "mh-6",
    name: "Harbor View Dental",
    paypoint: "PPID 5102",
    healthTier: "monitoring",
    healthLabel: "Monitoring",
    insight: "No transactions in 5 days — unusual pattern",
    volumeTrend: [2100, 2300, 2000, 1800, 400, 0, 0],
    declineTrend: [3.8, 4.0, 3.5, 3.9, 0, 0, 0],
    chargebackTrend: [0.1, 0.1, 0.1, 0.0, 0, 0, 0],
    alertCount: 1,
  },
  {
    id: "mh-7",
    name: "Linen Master",
    paypoint: "PPID 1834",
    healthTier: "healthy",
    healthLabel: "Healthy",
    insight: "Batch hold released — back to normal",
    volumeTrend: [3900, 4100, 4000, 4200, 4400, 4300, 4500],
    declineTrend: [2.5, 2.3, 2.6, 2.4, 2.2, 2.5, 2.1],
    chargebackTrend: [0.0, 0.1, 0.0, 0.0, 0.1, 0.0, 0.0],
    alertCount: 0,
  },
];

export interface PortfolioInsight {
  type: "positive" | "warning" | "info";
  text: string;
}

export const portfolioDigest = {
  weekLabel: "Week of Apr 1, 2026",
  insights: [
    { type: "positive" as const, text: "Strong week — Pay In volume up 20.3% vs. last period, driven by Bickford Homes (+$42K) and Castle Management (+$31K)" },
    { type: "warning" as const, text: "2 merchants show elevated decline rates — Apex Roofing (18%) and Sunbound Homes (14%) are above their 30-day baselines" },
    { type: "info" as const, text: "Payout velocity is healthy — 744 disbursements processed, 99.1% success rate this week" },
  ],
  expandedInsights: [
    { type: "positive" as const, text: "New customer acquisition up 2.8% — 16,952 new customers onboarded this period" },
    { type: "info" as const, text: "Webhook delivery rate at 99.7% — 1 endpoint experienced temporary issues (resolved)" },
    { type: "warning" as const, text: "Harbor View Dental inactive for 5 days — may warrant a check-in call" },
    { type: "positive" as const, text: "Average transaction size increased 8.2% to $282 across the portfolio" },
    { type: "info" as const, text: "API token for Production REST expires in 18 days — rotation recommended before Apr 20" },
  ],
};

export interface AiThresholdRec {
  settingId: string;
  recommendedValue: string;
  explanation: string;
}

export const aiThresholdRecommendations: AiThresholdRec[] = [
  { settingId: "batch_holds", recommendedValue: "8200", explanation: "Recommended: $8,200 based on your portfolio's average batch size" },
  { settingId: "merchant_inactivity", recommendedValue: "4", explanation: "Recommended: 4 days based on your merchants' typical processing cadence" },
  { settingId: "decline_rate", recommendedValue: "15", explanation: "Recommended: 15% based on your portfolio's decline rate distribution" },
];

export interface PredictiveAlert {
  id: string;
  title: string;
  subtitle: string;
  merchant: string;
  trendData: number[]; // 14 days historical
  projectedData: number[]; // 7 days forecast
  threshold: number;
  metricLabel: string;
  time: string;
}

export const predictiveAlerts: PredictiveAlert[] = [
  {
    id: "WATCH-001",
    title: "Merchant trending toward funding hold",
    subtitle: "Sunbound Homes",
    merchant: "PPID 2641",
    trendData: [4.2, 4.8, 5.1, 5.5, 6.0, 6.8, 7.2, 7.9, 8.5, 9.1, 9.8, 10.4, 11.2, 12.0],
    projectedData: [12.8, 13.5, 14.2, 14.9, 15.5, 16.1, 16.8],
    threshold: 15,
    metricLabel: "Chargeback rate (%)",
    time: "1h ago",
  },
  {
    id: "WATCH-002",
    title: "Decline rate approaching threshold",
    subtitle: "Harbor View Dental",
    merchant: "PPID 5102",
    trendData: [3.8, 4.0, 4.5, 5.2, 5.8, 6.5, 7.1, 8.0, 8.8, 9.5, 10.2, 11.0, 12.1, 13.5],
    projectedData: [14.8, 16.0, 17.2, 18.3, 19.2, 20.0, 20.8],
    threshold: 20,
    metricLabel: "Decline rate (%)",
    time: "4h ago",
  },
];

// Resolution intelligence messages
export const resolutionInsights: Record<string, { icon: string; message: string }> = {
  fix: {
    icon: "insight",
    message: "Apex Roofing LLC has had 2 ACH returns in 90 days. Pulse will monitor this vendor's bank account health going forward.",
  },
  rotate: {
    icon: "insight",
    message: "Your token rotation completed 12 days before expiry. Pulse will remind you 30 days before the new token expires.",
  },
  endpoint: {
    icon: "insight",
    message: "Your endpoint was unreachable for 47 minutes. Pulse detected the failure after 3 delivery attempts and notified you within 2 minutes.",
  },
  view: {
    icon: "insight",
    message: "Pulse will continue monitoring this merchant's activity and alert you if the pattern recurs.",
  },
};

// AI detected explanations
export const aiDetectedExplanations: Record<string, string> = {
  "PLR-006": "This merchant's decline rate is 3.2× higher than their own 30-day baseline, which is unusual for this paypoint's typical processing pattern.",
  "PLR-007": "Transaction volume dropped to zero for 2 days — atypical given this merchant's historical weekend activity.",
};

// Metric card forecast data
export const metricForecasts: Record<string, number[]> = {
  "payin-volume": [102_000_000, 105_500_000, 108_200_000],
  "payin-count": [355_000, 362_000, 370_000],
  "payin-customers": [4_180_000, 4_220_000, 4_260_000],
  "payin-new-customers": [17_200, 17_500, 17_800],
  "payout-volume": [3_100_000, 3_250_000, 3_380_000],
  "payout-count": [780, 810, 845],
  "payout-vendors": [32_200, 32_900, 33_600],
  "payout-new-vendors": [142, 150, 158],
};

// Amigo suggestions
export const amigoSuggestions = [
  "Which of my merchants had the highest decline rate this week?",
  "How is Sunbound Homes performing vs. last month?",
  "Which alerts have been open longest?",
  "What's my total payout volume this quarter?",
];

export const amigoSampleResponses: Record<string, string> = {
  "Which of my merchants had the highest decline rate this week?":
    "QuickFix Plumbing (PPID 3291) has the highest decline rate this week at **34.2%**, which is significantly above their 30-day baseline of 6.1%. The primary decline code is 05 — Do Not Honor. I recommend reviewing their integration and contacting the merchant to verify their processing setup.",
  "How is Sunbound Homes performing vs. last month?":
    "Sunbound Homes processed **$94,200** this month, down 8% from March. Their decline rate has been stable at 4.2%. There's currently an active batch hold on $14,200 — Payabli's team is reviewing it and expects to release funds within 1–2 business days.",
  "Which alerts have been open longest?":
    "The oldest open alert is **PLR-004** (Webhook failures for api.acmehomes.com), created yesterday with 23 queued events. Next is **PLR-003** (Batch hold for Sunbound Homes), also from yesterday. Both are awaiting resolution.",
  "What's my total payout volume this quarter?":
    "Your total payout volume for Q2 2026 (Apr 1–2) is **$2,993,041** across 744 disbursements with a 99.1% success rate. Compared to Q1's daily average, you're trending 69.7% higher in volume.",
};
