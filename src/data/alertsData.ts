export type AlertStatus = "action_needed" | "no_action" | "resolved" | "dismissed" | "watch";
export type AlertCategory = "payout" | "credential" | "payin" | "webhook" | "decline" | "inactivity" | "predictive";

export interface Alert {
  id: string;
  title: string;
  subtitle: string;
  category: AlertCategory;
  categoryLabel: string;
  merchant: string;
  amount: string | null;
  status: AlertStatus;
  statusLabel: string;
  time: string;
  timestamp: Date;
  details: {
    description: string;
    severity: "danger" | "warning" | "info" | "ok";
    actionLabel?: string;
    actionType?: "fix" | "rotate" | "view" | "endpoint";
    context?: string;
    metadata?: Record<string, string>;
  };
  aiDetected?: boolean;
  aiExplanation?: string;
  signalConfidence?: "high" | "medium";
  trendData?: number[];
  projectedData?: number[];
  threshold?: number;
  metricLabel?: string;
}

export const categoryBadgeMap: Record<AlertCategory, { bg: string; text: string }> = {
  payout: { bg: "bg-status-warning-bg", text: "text-status-warning-text" },
  credential: { bg: "bg-status-purple-bg", text: "text-status-purple-text" },
  payin: { bg: "bg-status-success-bg", text: "text-status-success-text" },
  webhook: { bg: "bg-orange-50", text: "text-orange-800" },
  decline: { bg: "bg-status-danger-bg", text: "text-status-danger-text" },
  inactivity: { bg: "bg-status-info-bg", text: "text-status-info-text" },
  predictive: { bg: "bg-status-watch-bg", text: "text-status-watch-text" },
};

export const statusBadgeMap: Record<AlertStatus, { bg: string; text: string; dot: string }> = {
  action_needed: { bg: "bg-status-danger-bg", text: "text-status-danger-text", dot: "bg-destructive" },
  no_action: { bg: "bg-status-info-bg", text: "text-status-info-text", dot: "bg-status-info" },
  resolved: { bg: "bg-status-success-bg", text: "text-status-success-text", dot: "bg-status-success" },
  dismissed: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  watch: { bg: "bg-status-watch-bg", text: "text-status-watch-text", dot: "bg-status-watch" },
};
