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
