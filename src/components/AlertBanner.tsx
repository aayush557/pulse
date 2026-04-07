import { useState } from "react";
import { ChevronUp, ChevronDown, ArrowRight } from "lucide-react";
import { useAlerts } from "@/hooks/useDashboardData";
import type { LiveAlert } from "@/types/api";

interface AlertBannerProps {
  onNavigate: (view: string) => void;
  onSelectAlert: (id: string) => void;
}

export default function AlertBanner({ onNavigate, onSelectAlert }: AlertBannerProps) {
  const [expanded, setExpanded] = useState(true);
  const { data, isLoading } = useAlerts();

  const alerts = data?.alerts || [];
  const actionAlerts = alerts.filter((a) => a.status === "action_needed");
  const noActionAlerts = alerts.filter((a) => a.status === "no_action");
  const totalUnresolved = actionAlerts.length + noActionAlerts.length;

  const displayAlerts = [...actionAlerts.slice(0, 2), ...noActionAlerts.slice(0, 1)];

  const severityColors: Record<string, { dot: string; badge: string; badgeText: string }> = {
    action_needed: { dot: "bg-destructive", badge: "bg-status-danger-bg", badgeText: "text-status-danger-text" },
    no_action: { dot: "bg-status-purple", badge: "bg-status-purple-bg", badgeText: "text-status-purple-text" },
  };

  if (isLoading) {
    return (
      <div className="mx-4 mt-3 bg-card border border-border rounded-lg p-3">
        <span className="text-xs text-muted-foreground animate-pulse">Loading alerts...</span>
      </div>
    );
  }

  if (totalUnresolved === 0) {
    return (
      <div className="mx-4 mt-3 bg-card border border-border rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-status-success" />
          <span className="text-xs font-semibold text-foreground">All clear — no alerts need attention</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-3 bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
      >
        <div className="w-2 h-2 rounded-full bg-destructive" />
        <span className="text-xs font-semibold text-foreground">Pulse — {totalUnresolved} alerts need your attention</span>
        <span className="bg-status-danger-bg text-status-danger-text text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
          {actionAlerts.length} action required
        </span>
        <span className="ml-auto text-[11px] text-primary font-medium flex items-center gap-1">
          {expanded ? "Hide" : "Show"} {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>

      {expanded && displayAlerts.length > 0 && (
        <div className="grid grid-cols-3 border-t border-border/50">
          {displayAlerts.map((alert: LiveAlert) => {
            const colors = severityColors[alert.status] || severityColors.no_action;
            return (
              <button
                key={alert.id}
                onClick={() => { onNavigate("pulse"); onSelectAlert(alert.id); }}
                className="p-3 border-r border-border/50 last:border-r-0 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${colors.badge} ${colors.badgeText}`}>
                    {alert.status === "action_needed" ? "Action needed" : "No action needed"}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-foreground">{alert.title}</div>
                <div className="text-[10px] text-muted-foreground">{alert.subtitle} · {alert.amount || "—"}</div>
                <div className="text-[10px] text-primary font-medium mt-1 flex items-center gap-1">
                  {alert.details.actionLabel || "View details"} <ArrowRight className="w-2.5 h-2.5" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
