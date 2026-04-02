export type AlertStatus = "action_needed" | "no_action" | "resolved" | "dismissed" | "watch";
export type AlertCategory = "payout" | "credential" | "payin" | "webhook" | "decline" | "inactivity" | "predictive" | "chargeback" | "returns" | "velocity";

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

export const alertsData: Alert[] = [
  {
    id: "PLR-001",
    title: "Payout failed",
    subtitle: "Apex Roofing LLC",
    category: "payout",
    categoryLabel: "Pay Out",
    merchant: "PPID 4821",
    amount: "$6,400",
    status: "action_needed",
    statusLabel: "Action needed",
    time: "2h ago",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    details: {
      description: "ACH payout to Apex Roofing LLC was returned by the receiving bank with code R01 (Insufficient Funds in originator account). The merchant's linked bank account may need to be reverified.",
      severity: "danger",
      actionLabel: "Retry payout",
      actionType: "fix",
      context: "This merchant has had 2 failed payouts in the last 30 days.",
      metadata: {
        "Payout ID": "PO-20260402-4821",
        "Return code": "R01 – Insufficient Funds",
        "Bank": "Chase ••••7832",
        "Original date": "Apr 01, 2026",
      },
    },
  },
  {
    id: "PLR-002",
    title: "API credential expiring",
    subtitle: "Production REST Token",
    category: "credential",
    categoryLabel: "Credential",
    merchant: "Org-wide",
    amount: null,
    status: "action_needed",
    statusLabel: "Action needed",
    time: "6h ago",
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
    details: {
      description: "Your production REST API token expires on April 20, 2026. Rotate it before expiry to avoid service interruption for all integrated merchants.",
      severity: "warning",
      actionLabel: "Rotate token",
      actionType: "rotate",
      metadata: {
        "Token": "pk_live_••••a3f9",
        "Created": "Oct 20, 2025",
        "Expires": "Apr 20, 2026",
        "Scope": "Full access",
      },
    },
  },
  {
    id: "PLR-003",
    title: "Batch hold",
    subtitle: "Sunbound Homes",
    category: "payin",
    categoryLabel: "Pay In",
    merchant: "PPID 2641",
    amount: "$14,200",
    status: "no_action",
    statusLabel: "No action needed",
    time: "Yesterday",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    details: {
      description: "A batch of $14,200 from Sunbound Homes has been placed under funding review by the acquiring bank. This is a routine compliance check for batches exceeding $10,000. No action is required — the hold typically clears within 1–2 business days.",
      severity: "info",
      actionLabel: "View batch details",
      actionType: "view",
      metadata: {
        "Batch ID": "BT-20260401-2641",
        "Hold reason": "Compliance review (>$10K)",
        "Expected release": "Apr 03, 2026",
        "Transaction count": "12 transactions",
      },
    },
  },
  {
    id: "PLR-004",
    title: "Webhook failures",
    subtitle: "api.acmehomes.com",
    category: "webhook",
    categoryLabel: "Webhook",
    merchant: "Org-wide",
    amount: "4 fails",
    status: "action_needed",
    statusLabel: "Action needed",
    time: "Yesterday",
    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000),
    details: {
      description: "The webhook endpoint api.acmehomes.com/hooks/payabli has returned 4 consecutive 5xx errors. Events are being queued but will be dropped after 72 hours if the endpoint is not restored.",
      severity: "danger",
      actionLabel: "Fix endpoint",
      actionType: "endpoint",
      context: "Last successful delivery was 18 hours ago. 23 events are currently queued.",
      metadata: {
        "Endpoint": "api.acmehomes.com/hooks/payabli",
        "Last success": "Apr 01, 2026 6:12 AM",
        "Queued events": "23",
        "Error": "HTTP 502 Bad Gateway",
      },
    },
  },
  {
    id: "PLR-005",
    title: "Batch hold released",
    subtitle: "Linen Master",
    category: "payin",
    categoryLabel: "Pay In",
    merchant: "PPID 1834",
    amount: "$8,900",
    status: "resolved",
    statusLabel: "Resolved",
    time: "2d ago",
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
    details: {
      description: "The batch hold on $8,900 from Linen Master has been released. Funds have been settled and are available for payout.",
      severity: "ok",
      metadata: {
        "Batch ID": "BT-20260330-1834",
        "Released": "Apr 01, 2026",
        "Settlement": "Completed",
      },
    },
  },
  {
    id: "PLR-006",
    title: "High decline rate detected",
    subtitle: "QuickFix Plumbing",
    category: "decline",
    categoryLabel: "Pay In",
    merchant: "PPID 3291",
    amount: "34.2%",
    status: "action_needed",
    statusLabel: "Action needed",
    time: "3h ago",
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    aiDetected: true,
    aiExplanation: "This merchant's decline rate is 3.2× higher than their own 30-day baseline, which is unusual for this paypoint's typical processing pattern.",
    signalConfidence: "high",
    details: {
      description: "QuickFix Plumbing's decline rate has reached 34.2% over the last 7 days, exceeding your 20% threshold. High decline rates may indicate card testing fraud or integration issues.",
      severity: "danger",
      actionLabel: "Investigate merchant",
      actionType: "view",
      context: "Average decline rate across your portfolio is 4.8%.",
      metadata: {
        "7-day volume": "$12,340",
        "Declined": "$4,220 (34.2%)",
        "Top decline code": "05 – Do Not Honor",
        "Previous rate": "6.1%",
      },
    },
  },
  {
    id: "PLR-007",
    title: "Merchant inactive 5 days",
    subtitle: "Harbor View Dental",
    category: "inactivity",
    categoryLabel: "Pay In",
    merchant: "PPID 5102",
    amount: "$0",
    status: "no_action",
    statusLabel: "No action needed",
    time: "5h ago",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
    aiDetected: true,
    aiExplanation: "Transaction volume dropped to zero for 2 days — atypical given this merchant's historical weekend activity.",
    signalConfidence: "medium",
    details: {
      description: "Harbor View Dental has processed $0 in transactions for the past 5 consecutive days. This exceeds your 3-day inactivity threshold. This may indicate a closed business, integration issue, or seasonal pause.",
      severity: "info",
      actionLabel: "Contact merchant",
      actionType: "view",
      metadata: {
        "Last transaction": "Mar 28, 2026",
        "Avg. daily volume": "$2,100",
        "Days inactive": "5",
        "Status": "Active (no self-reported pause)",
      },
    },
  },
];

export const categoryBadgeMap: Record<AlertCategory, { bg: string; text: string }> = {
  payout: { bg: "bg-status-warning-bg", text: "text-status-warning-text" },
  credential: { bg: "bg-status-purple-bg", text: "text-status-purple-text" },
  payin: { bg: "bg-status-success-bg", text: "text-status-success-text" },
  webhook: { bg: "bg-orange-50", text: "text-orange-800" },
  decline: { bg: "bg-status-danger-bg", text: "text-status-danger-text" },
  inactivity: { bg: "bg-status-info-bg", text: "text-status-info-text" },
  predictive: { bg: "bg-status-watch-bg", text: "text-status-watch-text" },
  chargeback: { bg: "bg-red-50", text: "text-red-800" },
  returns: { bg: "bg-orange-50", text: "text-orange-800" },
  velocity: { bg: "bg-purple-50", text: "text-purple-800" },
};

export const statusBadgeMap: Record<AlertStatus, { bg: string; text: string; dot: string }> = {
  action_needed: { bg: "bg-status-danger-bg", text: "text-status-danger-text", dot: "bg-destructive" },
  no_action: { bg: "bg-status-info-bg", text: "text-status-info-text", dot: "bg-status-info" },
  resolved: { bg: "bg-status-success-bg", text: "text-status-success-text", dot: "bg-status-success" },
  dismissed: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  watch: { bg: "bg-status-watch-bg", text: "text-status-watch-text", dot: "bg-status-watch" },
};
