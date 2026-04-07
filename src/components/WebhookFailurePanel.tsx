import { useState } from "react";
import {
  X, Copy, Clock, Wifi, WifiOff, AlertTriangle, Ban,
  Server, Zap, CheckCircle2, ExternalLink, Ticket
} from "lucide-react";
import type { WebhookFailureAlert, WebhookFailureType } from "@/types/api";
import { toast } from "sonner";

interface WebhookFailurePanelProps {
  alert: WebhookFailureAlert;
  onClose: () => void;
}

const failureTypeConfig: Record<
  WebhookFailureType,
  {
    label: string;
    icon: React.ElementType;
    bgClass: string;
    textClass: string;
    borderClass: string;
    remediation: string[];
  }
> = {
  timeout: {
    label: "Endpoint Timeout",
    icon: Clock,
    bgClass: "bg-orange-50",
    textClass: "text-orange-800",
    borderClass: "border-orange-200",
    remediation: [
      "Return HTTP 200 immediately, then process the payload asynchronously",
      "Check cold-start times if using serverless / Google Apps Script",
      "Our timeout is 5 seconds \u2014 ensure your handler responds within that window",
      "Consider adding a lightweight health-check route for monitoring",
    ],
  },
  rate_limited: {
    label: "Rate Limited",
    icon: Zap,
    bgClass: "bg-yellow-50",
    textClass: "text-yellow-800",
    borderClass: "border-yellow-200",
    remediation: [
      "Increase your API rate limit for webhook deliveries",
      "Settlement windows produce notification bursts \u2014 plan for peak volume",
      "Implement an internal queue: accept all deliveries, process at your own pace",
      "Contact us to discuss delivery throttling or batching on our side",
    ],
  },
  dead_endpoint: {
    label: "Endpoint Removed",
    icon: WifiOff,
    bgClass: "bg-red-50",
    textClass: "text-red-800",
    borderClass: "border-red-200",
    remediation: [
      "If intentionally removed: let us know and we'll disable the subscription",
      "If unintentional: recreate the endpoint at the same URL",
      "Queued events will be replayed once the endpoint is restored",
      "Consider cleaning up unused webhook subscriptions to avoid noise",
    ],
  },
  handler_error: {
    label: "Handler Rejection",
    icon: Ban,
    bgClass: "bg-purple-50",
    textClass: "text-purple-800",
    borderClass: "border-purple-200",
    remediation: [
      "Make event-specific fields optional in your request validation",
      "Handle each event type with its own validation logic",
      "Return HTTP 200 for event types you don't need \u2014 prevents retries",
      "We can share payload samples for any event type",
    ],
  },
  server_error: {
    label: "Server Error",
    icon: Server,
    bgClass: "bg-red-50",
    textClass: "text-red-800",
    borderClass: "border-red-200",
    remediation: [
      "Check your server logs for the root cause of the 5xx errors",
      "Events are queued and retried but dropped after 72 hours",
      "Ensure your webhook handler has proper error handling and doesn't crash",
      "Consider adding monitoring/alerting on your webhook endpoint",
    ],
  },
};

const severityStyles: Record<string, string> = {
  danger: "bg-status-danger-bg text-status-danger-text border border-status-danger-border",
  warning: "bg-status-warning-bg text-status-warning-text border border-status-warning-border",
  info: "bg-status-info-bg text-status-info-text border border-status-info-border",
};

export default function WebhookFailurePanel({ alert, onClose }: WebhookFailurePanelProps) {
  const [replyCopied, setReplyCopied] = useState(false);
  const config = failureTypeConfig[alert.failureType];
  const Icon = config.icon;

  const copyReply = () => {
    navigator.clipboard.writeText(alert.suggestedReply);
    setReplyCopied(true);
    toast.success("Partner reply copied to clipboard");
    setTimeout(() => setReplyCopied(false), 3000);
  };

  const truncatedUrl = alert.target.length > 55
    ? alert.target.slice(0, 55) + "..."
    : alert.target;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase tracking-wider text-payabli-cyan font-semibold">
            {alert.id}
          </span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${config.bgClass} ${config.textClass} border ${config.borderClass}`}>
            {config.label}
          </span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Diagnosis banner */}
        <div className={`rounded-md p-3 ${config.bgClass} border ${config.borderClass}`}>
          <div className="flex items-start gap-2">
            <Icon className={`w-4 h-4 ${config.textClass} flex-shrink-0 mt-0.5`} />
            <div>
              <div className={`text-[11px] font-semibold ${config.textClass} mb-1`}>
                {alert.failCount.toLocaleString()} failures &mdash; {config.label}
              </div>
              <div className="text-[10px] text-foreground/80 leading-relaxed">
                Endpoint: <span className="font-mono">{truncatedUrl}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="bg-muted/30 border border-border rounded-md p-2.5">
          <div className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-1.5">
            <span className="text-[10px] text-muted-foreground">Failures</span>
            <span className="text-[10px] text-foreground font-semibold">{alert.failCount.toLocaleString()}</span>

            <span className="text-[10px] text-muted-foreground">Success rate</span>
            <span className={`text-[10px] font-semibold ${alert.successRate < 90 ? "text-destructive" : alert.successRate < 98 ? "text-status-warning-text" : "text-status-success-text"}`}>
              {alert.successRate}%
            </span>

            <span className="text-[10px] text-muted-foreground">First failure</span>
            <span className="text-[10px] text-foreground">{new Date(alert.firstFailure).toLocaleDateString()}</span>

            <span className="text-[10px] text-muted-foreground">Last failure</span>
            <span className="text-[10px] text-foreground">{new Date(alert.lastFailure).toLocaleDateString()}</span>

            <span className="text-[10px] text-muted-foreground">Paypoints</span>
            <span className="text-[10px] text-foreground">{alert.affectedPaypoints}</span>

            {alert.orgNames.length > 0 && (
              <>
                <span className="text-[10px] text-muted-foreground">Organizations</span>
                <span className="text-[10px] text-foreground">{alert.orgNames.join(", ")}</span>
              </>
            )}
          </div>
        </div>

        {/* Affected events */}
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Affected events
          </div>
          <div className="flex flex-wrap gap-1">
            {alert.affectedEvents.map((evt) => (
              <span key={evt} className="text-[9px] px-2 py-0.5 rounded-full bg-muted text-foreground font-medium">
                {evt}
              </span>
            ))}
          </div>
        </div>

        {/* Error detail */}
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Error from endpoint
          </div>
          <div className={`rounded-md p-2.5 text-[10px] leading-relaxed font-mono break-all ${severityStyles[alert.severity]}`}>
            {alert.errorSample}
          </div>
        </div>

        {/* Remediation steps */}
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Recommended fix
          </div>
          <div className="space-y-1.5">
            {config.remediation.map((step, i) => (
              <div key={i} className="text-[11px] text-foreground flex items-start gap-2">
                <span className="text-[9px] text-muted-foreground font-mono mt-0.5">{i + 1}.</span>
                {step}
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={copyReply}
            className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-md text-xs font-semibold transition-all ${
              replyCopied
                ? "bg-status-success text-primary-foreground"
                : "bg-foreground text-background hover:opacity-90"
            }`}
          >
            {replyCopied ? (
              <><CheckCircle2 className="w-3 h-3" /> Copied to clipboard</>
            ) : (
              <><Copy className="w-3 h-3" /> Copy reply to partner</>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                window.open(alert.target, "_blank");
              }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Open URL
            </button>
            <button
              onClick={() => {
                const title = `[Webhook] ${config.label}: ${truncatedUrl}`;
                const body = `**${alert.failCount} failures** (${alert.firstFailure} - ${alert.lastFailure})\n\n**Failure type:** ${config.label}\n**Endpoint:** ${alert.target}\n**Success rate:** ${alert.successRate}%\n**Affected events:** ${alert.affectedEvents.join(", ")}\n**Organizations:** ${alert.orgNames.join(", ")}\n\n**Error sample:**\n\`\`\`\n${alert.errorSample}\n\`\`\`\n\n**Remediation:**\n${config.remediation.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
                navigator.clipboard.writeText(`${title}\n\n${body}`);
                toast.success("SRE ticket content copied — paste into Linear");
              }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <Ticket className="w-3 h-3" />
              Copy SRE ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
