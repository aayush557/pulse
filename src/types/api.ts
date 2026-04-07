export interface MetricValue {
  current: number;
  previous: number;
  changePercent: number;
  trend: number[];
  forecast: number[];
}

export interface MetricsSummary {
  period: {
    start: string;
    end: string;
    label: string;
  };
  payIn: {
    transactionVolume: MetricValue;
    transactionCount: MetricValue;
    customers: MetricValue;
    newCustomers: MetricValue;
  };
  payOut: {
    transactionVolume: MetricValue;
    transactionCount: MetricValue;
    vendors: MetricValue;
    newVendors: MetricValue;
  };
}

export interface AlertDetail {
  description: string;
  severity: "danger" | "warning" | "info" | "ok";
  actionLabel?: string;
  actionType?: string;
  context?: string;
  metadata?: Record<string, string>;
}

export interface LiveAlert {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  categoryLabel: string;
  merchant: string;
  amount: string | null;
  status: "action_needed" | "no_action" | "resolved" | "dismissed" | "watch";
  statusLabel: string;
  time: string;
  timestamp: string;
  details: AlertDetail;
  aiDetected?: boolean;
  aiExplanation?: string;
  signalConfidence?: "high" | "medium";
}

export interface AlertsResponse {
  alerts: LiveAlert[];
  totalCount: number;
}

export interface MerchantHealthItem {
  id: string;
  name: string;
  paypoint: string;
  healthTier: "healthy" | "monitoring" | "at_risk";
  healthLabel: string;
  insight: string;
  volumeTrend: number[];
  declineTrend: number[];
  chargebackTrend: number[];
  alertCount: number;
}

export interface MerchantHealthResponse {
  merchants: MerchantHealthItem[];
}

// Webhook failure alerts

export type WebhookFailureType =
  | "timeout"
  | "rate_limited"
  | "dead_endpoint"
  | "handler_error"
  | "server_error";

export interface WebhookFailureAlert {
  id: string;
  target: string;
  failureType: WebhookFailureType;
  failCount: number;
  affectedEvents: string[];
  affectedPaypoints: number;
  orgNames: string[];
  errorSample: string;
  firstFailure: string;
  lastFailure: string;
  successRate: number;
  suggestedReply: string;
  severity: "danger" | "warning" | "info";
}

export interface WebhookAlertsResponse {
  alerts: WebhookFailureAlert[];
  overallSuccessRate: number;
  totalFailures: number;
}

// ── Notification Failures (AI-analyzed) ─────────────────────────────

export interface NotificationFailureOrg {
  id: number;
  name: string;
}

export interface NotificationFailureAI {
  summary: string;
  rootCause: string;
  impact: string;
  ticketTitle: string;
  ticketBody: string;
  priority: "critical" | "high" | "medium" | "low";
}

export interface NotificationFailureGroup {
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
  orgs: NotificationFailureOrg[];
  errorSamples: string[];
  successRate: number;
  totalDeliveries: number;
  isOngoing: boolean;
  aiAnalysis: NotificationFailureAI;
}

export interface NotificationFailuresResponse {
  groups: NotificationFailureGroup[];
  fromCache: boolean;
  generatedAt: string;
}

// ── Linear Integration ─────────────────────────────────────────────

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearConfigResponse {
  configured: boolean;
  teams: LinearTeam[];
}

export interface LinearIssueResponse {
  id: string;
  identifier: string;
  title: string;
  url: string;
  groupId: string;
}

// ── Partner Risk (ML Pipeline) ──────────────────────────────────────

export interface RateDetail {
  observed_rate: number;
  posterior_mean: number;
  ci_lower: number;
  ci_upper: number;
  p_elevated: number;
  z_score: number;
  peer_group: string;
  peer_mean: number;
  rolling_z: number;
  cusum_alarm: boolean;
  trend_direction: "rising" | "falling" | "stable";
  weekly_rates: number[];
}

export interface PartnerRiskScore {
  partner_id: string;
  combined_score: number;
  tier: "elevated" | "watch" | "normal";
  decline: RateDetail | null;
  returns: RateDetail | null;
  chargeback: RateDetail | null;
  n_paypoints: number;
  total_txns: number;
  total_amount: number;
}

export interface PartnerRiskResponse {
  total: number;
  limit: number;
  offset: number;
  partners: PartnerRiskScore[];
}

// ── Amigo AI Chat ──────────────────────────────────────────────────────

export interface AmigoChatRequest {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AmigoChatResponse {
  response: string;
}

// ── Portfolio Digest ───────────────────────────────────────────────────

export interface PortfolioInsight {
  type: "positive" | "warning" | "info";
  text: string;
}

export interface PortfolioDigestResponse {
  weekLabel: string;
  insights: PortfolioInsight[];
  expandedInsights: PortfolioInsight[];
  fromCache: boolean;
  generatedAt: string;
}

// ── Predictive Alerts ──────────────────────────────────────────────────

export interface PredictiveAlertItem {
  id: string;
  title: string;
  subtitle: string;
  merchant: string;
  trendData: number[];
  projectedData: number[];
  threshold: number;
  metricLabel: string;
  time: string;
  projectedBreachDay: number | null;
}

export interface PredictiveAlertsResponse {
  alerts: PredictiveAlertItem[];
}

// ── Alert Resolutions ─────────────────────────────────────────────────

export interface AlertResolution {
  alert_id: string;
  action: "resolved" | "dismissed";
  created_at: string;
}

export interface AlertResolutionsResponse {
  resolutions: AlertResolution[];
}

// ── Alert Actions ──────────────────────────────────────────────────────

export interface AlertActionRequest {
  actionType: string;
  params?: Record<string, any>;
}

export interface AlertActionResponse {
  success: boolean;
  statusCode?: number;
  responseTime?: number;
  resolvedAt?: string;
  dismissedAt?: string;
  message?: string;
  requiresIntegration?: boolean;
  error?: string;
}

// ── Settings Recommendations ───────────────────────────────────────────

export interface ThresholdRecommendation {
  settingId: string;
  recommendedValue: string;
  explanation: string;
  dataPoints: {
    p50: number;
    p75: number;
    p90: number;
  };
}

export interface SubscriptionsResponse {
  batch_holds: boolean;
  payout_failures: boolean;
  credential_expiry: boolean;
  webhook_health: boolean;
  merchant_inactivity: boolean;
  decline_rate: boolean;
}

export interface SettingsRecommendationsResponse {
  recommendations: ThresholdRecommendation[];
  generatedAt: string;
}
