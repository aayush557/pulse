import { useState, useEffect } from "react";
import {
  X, ExternalLink, MessageSquare, CheckCircle2, AlertTriangle,
  Info, ShieldAlert, RefreshCw, Key, RotateCcw, Copy, Wifi,
  ArrowRight, Loader2, Shield, Eye, EyeOff, Sparkles, Lightbulb
} from "lucide-react";
import { type Alert } from "@/data/alertsData";
import { resolutionInsights } from "@/data/mlData";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AlertDetailPanelProps {
  alert: Alert;
  onClose: () => void;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
  onContactSupport: () => void;
}

const severityIcon: Record<string, React.ElementType> = {
  danger: ShieldAlert,
  warning: AlertTriangle,
  info: Info,
  ok: CheckCircle2,
};

const severityStyles: Record<string, string> = {
  danger: "bg-status-danger-bg text-status-danger-text border border-status-danger-border",
  warning: "bg-status-warning-bg text-status-warning-text border border-status-warning-border",
  info: "bg-status-info-bg text-status-info-text border border-status-info-border",
  ok: "bg-status-success-bg text-status-success-text border border-status-success-border",
};

type FlowStep = "details" | "action" | "processing" | "success" | "confirm_dismiss" | "resolved";

export default function AlertDetailPanel({ alert, onClose, onResolve, onDismiss, onContactSupport }: AlertDetailPanelProps) {
  const [step, setStep] = useState<FlowStep>("details");
  const [showToken, setShowToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [retryBank, setRetryBank] = useState("same");
  const [testResult, setTestResult] = useState<"idle" | "testing" | "success" | "fail">("idle");

  useEffect(() => {
    setStep("details");
    setShowToken(false);
    setTokenCopied(false);
    setRetryBank("same");
    setTestResult("idle");
  }, [alert.id]);

  const currentStepIndex = step === "details" ? 0 : step === "action" ? 1 : (step === "processing" || step === "success" || step === "resolved") ? 2 : 0;

  const handleStartAction = () => setStep("action");

  const handleExecuteAction = () => {
    setStep("processing");
    setTimeout(() => {
      setStep("success");
      onResolve(alert.id);
    }, 2000);
  };

  const simulateWebhookTest = () => {
    setTestResult("testing");
    setTimeout(() => setTestResult("success"), 2500);
  };

  const copyToken = (text: string) => {
    navigator.clipboard.writeText(text);
    setTokenCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setTokenCopied(false), 2000);
  };

  // ── Success screen with Resolution Intelligence (Feature 10) ──
  if (step === "success" || step === "resolved") {
    const successMessages: Record<string, { title: string; desc: string; nextSteps: string[] }> = {
      fix: {
        title: "Payout retry initiated",
        desc: `A new ACH payout of ${alert.amount} to ${alert.subtitle} has been submitted. It will process within 1–2 business days.`,
        nextSteps: ["Monitor payout status in Pay Out → Transactions", "Verify merchant bank account if retry fails again"],
      },
      rotate: {
        title: "API token rotated",
        desc: `Your new production REST API token is active. The old token (pk_live_••••a3f9) will be deactivated in 24 hours.`,
        nextSteps: ["Update all integrations with the new token", "Old token expires in 24 hours — grace period active"],
      },
      endpoint: {
        title: "Webhook endpoint restored",
        desc: `${alert.subtitle} is now responding successfully. Queued events will be replayed automatically.`,
        nextSteps: ["23 queued events will be replayed over the next 10 minutes", "Monitor webhook logs for delivery confirmations"],
      },
    };
    const msg = successMessages[alert.details.actionType || "view"] || {
      title: "Alert resolved",
      desc: `${alert.title} for ${alert.subtitle} has been marked as resolved.`,
      nextSteps: [],
    };

    const insight = resolutionInsights[alert.details.actionType || "view"];

    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden animate-slide-in">
        <StepBar currentStep={2} />
        <div className="p-5 text-center">
          <div className="w-11 h-11 bg-status-success-bg border border-status-success-border rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-5 h-5 text-status-success" />
          </div>
          <div className="text-sm font-semibold text-status-success-text mb-1">{msg.title}</div>
          <div className="text-[11px] text-muted-foreground mb-4 leading-relaxed">{msg.desc}</div>
          {msg.nextSteps.length > 0 && (
            <div className="bg-status-success-bg border border-status-success-border rounded-md p-3 mb-3 text-left">
              <div className="text-[10px] font-semibold text-status-success-text uppercase tracking-wider mb-2">Next steps</div>
              {msg.nextSteps.map((s, i) => (
                <div key={i} className="text-[11px] text-foreground flex items-start gap-2 mb-1 last:mb-0">
                  <CheckCircle2 className="w-3 h-3 text-status-success flex-shrink-0 mt-0.5" />
                  {s}
                </div>
              ))}
            </div>
          )}

          {/* Resolution Intelligence (Feature 10) */}
          {insight && (
            <div className="bg-insight-bg border border-insight-border rounded-md p-3 mb-3 text-left">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb className="w-3 h-3 text-insight-text" />
                <span className="text-[10px] font-semibold text-insight-text uppercase tracking-wider">What we learned</span>
              </div>
              <div className="text-[11px] text-foreground leading-relaxed">{insight.message}</div>
            </div>
          )}

          <button onClick={onClose} className="w-full py-2 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted/50 transition-colors">
            Back to alerts
          </button>
        </div>
      </div>
    );
  }

  // ── Processing screen ──
  if (step === "processing") {
    const processingLabels: Record<string, string> = {
      fix: "Submitting payout retry...",
      rotate: "Generating new API token...",
      endpoint: "Verifying endpoint connection...",
    };
    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden animate-slide-in">
        <StepBar currentStep={2} />
        <div className="p-8 text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <div className="text-sm font-semibold text-foreground mb-1">
            {processingLabels[alert.details.actionType || "view"] || "Processing..."}
          </div>
          <div className="text-[11px] text-muted-foreground">This may take a few seconds</div>
        </div>
      </div>
    );
  }

  // ── Dismiss confirmation ──
  if (step === "confirm_dismiss") {
    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden animate-slide-in">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <span className="text-[9px] uppercase tracking-wider text-payabli-cyan font-semibold">Dismiss alert</span>
          <button onClick={() => setStep("details")} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="p-4 text-center">
          <div className="w-11 h-11 bg-status-danger-bg border border-status-danger-border rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div className="text-sm font-semibold text-foreground mb-1">Dismiss "{alert.title}"?</div>
          <div className="text-[11px] text-muted-foreground mb-4">
            This alert will be hidden from your active feed. You can still find it in the dismissed alerts section. This action won't resolve the underlying issue.
          </div>
          <button
            onClick={() => { onDismiss(alert.id); setStep("details"); onClose(); toast.success("Alert dismissed"); }}
            className="w-full py-2 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold mb-2 hover:opacity-90 transition-opacity"
          >
            Yes, dismiss alert
          </button>
          <button onClick={() => setStep("details")} className="w-full py-2 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted/50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Action step (Step 2) ──
  if (step === "action") {
    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden animate-slide-in">
        <StepBar currentStep={1} />
        <div className="px-3 pt-2">
          <div className="text-[9px] uppercase tracking-wider text-payabli-cyan font-semibold">{alert.id}</div>
          <div className="text-[13px] font-semibold text-foreground mt-0.5 pb-2 border-b border-border/50">
            {alert.details.actionLabel}
          </div>
        </div>
        <div className="px-3 py-3">
          {alert.details.actionType === "fix" && <RetryPayoutStep alert={alert} retryBank={retryBank} setRetryBank={setRetryBank} />}
          {alert.details.actionType === "rotate" && <RotateTokenStep alert={alert} showToken={showToken} setShowToken={setShowToken} tokenCopied={tokenCopied} onCopy={copyToken} />}
          {alert.details.actionType === "endpoint" && <FixEndpointStep alert={alert} testResult={testResult} onTest={simulateWebhookTest} />}

          <button
            onClick={handleExecuteAction}
            disabled={alert.details.actionType === "endpoint" && testResult !== "success"}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-foreground text-background text-xs font-semibold mb-2 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {alert.details.actionType === "fix" && <><RefreshCw className="w-3 h-3" /> Confirm & retry payout</>}
            {alert.details.actionType === "rotate" && <><Key className="w-3 h-3" /> Generate new token</>}
            {alert.details.actionType === "endpoint" && <><Wifi className="w-3 h-3" /> Confirm endpoint fix</>}
            {!["fix", "rotate", "endpoint"].includes(alert.details.actionType || "") && <><ArrowRight className="w-3 h-3" /> Confirm</>}
          </button>
          <button onClick={() => setStep("details")} className="w-full py-2 rounded-md border border-border text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
            ← Back to review
          </button>
        </div>
      </div>
    );
  }

  // ── Details step (Step 1 – Review) ──
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden animate-slide-in">
      <StepBar currentStep={0} />
      <div className="px-3 pt-2 flex items-start justify-between">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-payabli-cyan font-semibold flex items-center gap-1.5">
            {alert.id}
            {alert.aiDetected && (
              <span className="text-[8px] px-1.5 py-0 rounded-full bg-ai-bg text-ai-text border border-ai-border font-semibold normal-case">AI detected</span>
            )}
          </div>
          <div className="text-[13px] font-semibold text-foreground mt-0.5 pb-2 border-b border-border/50">
            {alert.title} — {alert.subtitle}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-3 py-3">
        <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 mb-3">
          {alert.details.metadata && Object.entries(alert.details.metadata).map(([k, v]) => (
            <div key={k} className="contents">
              <span className="text-[11px] text-muted-foreground">{k}</span>
              <span className="text-[11px] text-foreground">{v}</span>
            </div>
          ))}
        </div>
        <div className={`rounded-md p-3 text-[11px] leading-relaxed mb-3 ${severityStyles[alert.details.severity]}`}>
          {alert.details.description}
        </div>

        {/* Why Pulse flagged this (Feature 2 - AI explanation) */}
        {alert.aiDetected && alert.aiExplanation && (
          <div className="bg-ai-bg border border-ai-border rounded-md p-3 text-[11px] leading-relaxed mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3 h-3 text-ai-text" />
              <span className="text-[10px] font-semibold text-ai-text uppercase tracking-wider">Why Pulse flagged this</span>
            </div>
            <div className="text-foreground">{alert.aiExplanation}</div>
          </div>
        )}

        {/* Signal confidence indicator (Feature 9) */}
        {alert.aiDetected && alert.signalConfidence && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <Tooltip>
                <TooltipTrigger className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                  Signal confidence
                  <Info className="w-2.5 h-2.5" />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px] max-w-[240px]">
                  Confidence reflects how far this signal deviates from this merchant's historical pattern — not a risk rating.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all ${alert.signalConfidence === "high" ? "bg-status-success w-[85%]" : "bg-status-warning w-[55%]"}`}
              />
            </div>
            <div className={`text-[10px] ${alert.signalConfidence === "high" ? "text-status-success-text" : "text-status-warning-text"}`}>
              {alert.signalConfidence === "high"
                ? "High confidence — this pattern is significantly outside normal range"
                : "Monitoring — this pattern is elevated but not definitively anomalous"}
            </div>
          </div>
        )}

        {alert.details.context && (
          <div className="bg-muted/50 border border-border rounded-md p-2.5 text-[11px] text-muted-foreground mb-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {alert.details.context}
          </div>
        )}

        {/* Watch alert note */}
        {alert.status === "watch" && (
          <div className="bg-status-watch-bg border border-status-watch-border rounded-md p-2.5 text-[11px] text-status-watch-text mb-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            This is a proactive signal based on historical patterns — no hold has been placed.
          </div>
        )}

        {alert.details.actionLabel && alert.status !== "resolved" && (
          <button
            onClick={handleStartAction}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-foreground text-background text-xs font-semibold mb-2 hover:opacity-90 transition-opacity"
          >
            <ArrowRight className="w-3 h-3" />
            {alert.details.actionLabel}
          </button>
        )}

        {alert.status !== "resolved" && alert.status !== "watch" && (
          <>
            <button
              onClick={() => { onResolve(alert.id); setStep("resolved"); }}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md bg-status-success text-primary-foreground text-xs font-semibold mb-2 hover:opacity-90 transition-opacity"
            >
              <CheckCircle2 className="w-3 h-3" />
              Mark as resolved
            </button>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={onContactSupport}
                className="flex items-center justify-center gap-1.5 py-2 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
              >
                <MessageSquare className="w-3 h-3" />
                Contact support
              </button>
              <button
                onClick={() => setStep("confirm_dismiss")}
                className="flex items-center justify-center gap-1.5 py-2 rounded-md border border-border text-xs font-medium text-destructive hover:bg-status-danger-bg transition-colors"
              >
                <X className="w-3 h-3" />
                Dismiss
              </button>
            </div>
          </>
        )}

        {alert.status === "watch" && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              onClick={onContactSupport}
              className="flex items-center justify-center gap-1.5 py-2 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <MessageSquare className="w-3 h-3" />
              Contact merchant
            </button>
            <button
              onClick={() => { onDismiss(alert.id); onClose(); }}
              className="flex items-center justify-center gap-1.5 py-2 rounded-md border border-border text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="w-3 h-3" />
              Dismiss signal
            </button>
          </div>
        )}

        {alert.status === "resolved" && (
          <div className="bg-status-success-bg border border-status-success-border rounded-md p-3 text-[11px] text-status-success-text">
            <CheckCircle2 className="w-4 h-4 inline mr-1.5" />
            This alert has been resolved.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step bar component ──
function StepBar({ currentStep }: { currentStep: number }) {
  const steps = ["Review", "Action", "Resolve"];
  return (
    <div className="flex items-center gap-0 px-3 py-2.5 border-b border-border/50">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          {i > 0 && <div className="w-6 h-px bg-border mx-1" />}
          <div className={`w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center text-[9px] font-semibold ${
            i < currentStep ? "border-status-success bg-status-success text-primary-foreground" :
            i === currentStep ? "border-primary text-primary" :
            "border-muted-foreground/30 text-muted-foreground/50"
          }`}>
            {i < currentStep ? "✓" : i + 1}
          </div>
          <span className={`text-[10px] ${
            i < currentStep ? "text-status-success font-medium" :
            i === currentStep ? "text-primary font-medium" :
            "text-muted-foreground/50"
          }`}>{s}</span>
        </div>
      ))}
    </div>
  );
}

// ── Retry Payout flow ──
function RetryPayoutStep({ alert, retryBank, setRetryBank }: { alert: Alert; retryBank: string; setRetryBank: (v: string) => void }) {
  return (
    <div className="space-y-3 mb-4">
      <div className="bg-status-warning-bg border border-status-warning-border rounded-md p-2.5 text-[11px] text-status-warning-text flex items-start gap-2">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        The original payout failed with R01 (Insufficient Funds). Retrying will submit a new ACH debit.
      </div>
      <div>
        <div className="text-[11px] font-medium text-foreground mb-2">Payout details</div>
        <div className="bg-muted/30 border border-border rounded-md p-2.5">
          <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1">
            <span className="text-[10px] text-muted-foreground">Merchant</span>
            <span className="text-[10px] text-foreground font-medium">{alert.subtitle}</span>
            <span className="text-[10px] text-muted-foreground">Amount</span>
            <span className="text-[10px] text-foreground font-semibold">{alert.amount}</span>
            <span className="text-[10px] text-muted-foreground">Payout ID</span>
            <span className="text-[10px] text-foreground font-mono">{alert.details.metadata?.["Payout ID"]}</span>
          </div>
        </div>
      </div>
      <div>
        <div className="text-[11px] font-medium text-foreground mb-2">Bank account</div>
        <label className={`flex items-center gap-2.5 p-2.5 rounded-md border cursor-pointer mb-1.5 transition-colors ${retryBank === "same" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
          <input type="radio" name="bank" checked={retryBank === "same"} onChange={() => setRetryBank("same")} className="w-3.5 h-3.5 accent-primary" />
          <div>
            <div className="text-[11px] font-medium text-foreground">Same bank account</div>
            <div className="text-[10px] text-muted-foreground">{alert.details.metadata?.["Bank"] || "Chase ••••7832"}</div>
          </div>
        </label>
        <label className={`flex items-center gap-2.5 p-2.5 rounded-md border cursor-pointer transition-colors ${retryBank === "new" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
          <input type="radio" name="bank" checked={retryBank === "new"} onChange={() => setRetryBank("new")} className="w-3.5 h-3.5 accent-primary" />
          <div>
            <div className="text-[11px] font-medium text-foreground">Request new bank details</div>
            <div className="text-[10px] text-muted-foreground">Send merchant a secure link to update bank info</div>
          </div>
        </label>
      </div>
    </div>
  );
}

// ── Rotate Token flow ──
function RotateTokenStep({ alert, showToken, setShowToken, tokenCopied, onCopy }: {
  alert: Alert; showToken: boolean; setShowToken: (v: boolean) => void; tokenCopied: boolean; onCopy: (t: string) => void;
}) {
  const newToken = "pk_live_9x8kF2mNqR7vL4wJ3bHt6pYs";
  return (
    <div className="space-y-3 mb-4">
      <div className="bg-status-warning-bg border border-status-warning-border rounded-md p-2.5 text-[11px] text-status-warning-text flex items-start gap-2">
        <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        A new token will be generated. The old token will remain active for a 24-hour grace period.
      </div>
      <div>
        <div className="text-[11px] font-medium text-foreground mb-2">Current token</div>
        <div className="bg-muted/30 border border-border rounded-md p-2.5">
          <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1">
            <span className="text-[10px] text-muted-foreground">Token</span>
            <span className="text-[10px] text-foreground font-mono">{alert.details.metadata?.["Token"]}</span>
            <span className="text-[10px] text-muted-foreground">Expires</span>
            <span className="text-[10px] text-destructive font-medium">{alert.details.metadata?.["Expires"]}</span>
            <span className="text-[10px] text-muted-foreground">Scope</span>
            <span className="text-[10px] text-foreground">{alert.details.metadata?.["Scope"]}</span>
          </div>
        </div>
      </div>
      <div>
        <div className="text-[11px] font-medium text-foreground mb-2">New token preview</div>
        <div className="bg-muted/30 border border-border rounded-md p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">New token</span>
            <button onClick={() => setShowToken(!showToken)} className="text-muted-foreground hover:text-foreground">
              {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          </div>
          <div className="font-mono text-[11px] text-foreground bg-card border border-border rounded px-2 py-1.5 flex items-center justify-between">
            <span>{showToken ? newToken : "pk_live_••••••••••••••••••••••••"}</span>
            <button
              onClick={() => onCopy(newToken)}
              className={`text-[10px] px-1.5 py-0.5 rounded ${tokenCopied ? "bg-status-success-bg text-status-success-text" : "bg-primary/10 text-primary hover:bg-primary/20"}`}
            >
              {tokenCopied ? "Copied!" : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5">Scope: Full access · Same permissions as current token</div>
        </div>
      </div>
    </div>
  );
}

// ── Fix Endpoint flow ──
function FixEndpointStep({ alert, testResult, onTest }: {
  alert: Alert; testResult: string; onTest: () => void;
}) {
  return (
    <div className="space-y-3 mb-4">
      <div className="bg-status-danger-bg border border-status-danger-border rounded-md p-2.5 text-[11px] text-status-danger-text flex items-start gap-2">
        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        {alert.details.metadata?.["Queued events"]} events are queued and will be dropped in 72 hours if not resolved.
      </div>
      <div>
        <div className="text-[11px] font-medium text-foreground mb-2">Endpoint details</div>
        <div className="bg-muted/30 border border-border rounded-md p-2.5">
          <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1">
            <span className="text-[10px] text-muted-foreground">URL</span>
            <span className="text-[10px] text-foreground font-mono break-all">{alert.details.metadata?.["Endpoint"]}</span>
            <span className="text-[10px] text-muted-foreground">Error</span>
            <span className="text-[10px] text-destructive font-medium">{alert.details.metadata?.["Error"]}</span>
            <span className="text-[10px] text-muted-foreground">Last success</span>
            <span className="text-[10px] text-foreground">{alert.details.metadata?.["Last success"]}</span>
          </div>
        </div>
      </div>
      <div>
        <div className="text-[11px] font-medium text-foreground mb-2">Test connection</div>
        {testResult === "idle" && (
          <button onClick={onTest} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted/50 transition-colors">
            <Wifi className="w-3 h-3" /> Send test ping
          </button>
        )}
        {testResult === "testing" && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-status-info-bg border border-status-info-border">
            <div className="w-2 h-2 rounded-full bg-status-info animate-pulse" />
            <span className="text-[11px] text-status-info-text">Testing connection to {alert.subtitle}...</span>
          </div>
        )}
        {testResult === "success" && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-status-success-bg border border-status-success-border">
            <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
            <span className="text-[11px] text-status-success-text">Endpoint responding — HTTP 200 OK (142ms)</span>
          </div>
        )}
        {testResult === "fail" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-status-danger-bg border border-status-danger-border">
              <X className="w-3.5 h-3.5 text-destructive" />
              <span className="text-[11px] text-status-danger-text">Endpoint still unreachable</span>
            </div>
            <button onClick={onTest} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted/50 transition-colors">
              <RotateCcw className="w-3 h-3" /> Retry test
            </button>
          </div>
        )}
      </div>
      {testResult === "success" && (
        <div className="bg-status-info-bg border border-status-info-border rounded-md p-2.5 text-[11px] text-status-info-text flex items-start gap-2">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          Confirming will replay all {alert.details.metadata?.["Queued events"]} queued events to the restored endpoint.
        </div>
      )}
    </div>
  );
}
