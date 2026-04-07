import PortfolioDigest from "./PortfolioDigest";
import AmigoPanel from "./AmigoPanel";
import { usePredictiveAlerts, useAlerts } from "@/hooks/useDashboardData";
import { Sparkles, TrendingUp, AlertTriangle, Activity } from "lucide-react";

export default function AmigoIntelligenceView() {
  const { data: predictiveData } = usePredictiveAlerts();
  const { data: alertsData } = useAlerts();

  const actionCount = alertsData?.alerts?.filter((a) => a.status === "action_needed").length ?? 0;
  const predictiveCount = predictiveData?.alerts?.length ?? 0;
  const totalAlerts = alertsData?.totalCount ?? 0;

  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-status-purple-bg flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-status-purple" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Amigo Intelligence</h2>
            <p className="text-xs text-muted-foreground">AI-powered portfolio insights and assistant</p>
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        <div className="bg-card border border-border rounded-lg p-2.5 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <div>
            <div className="text-lg font-bold text-foreground">{totalAlerts}</div>
            <div className="text-[10px] text-muted-foreground">Active signals</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <div>
            <div className="text-lg font-bold text-destructive">{actionCount}</div>
            <div className="text-[10px] text-muted-foreground">Action required</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-status-watch" />
          <div>
            <div className="text-lg font-bold text-status-watch">{predictiveCount}</div>
            <div className="text-[10px] text-muted-foreground">Predictive signals</div>
          </div>
        </div>
      </div>

      {/* Main content: two columns */}
      <div className="px-4 pb-4 grid grid-cols-[1fr_370px] gap-3 items-start">
        {/* Left: Portfolio Digest + Predictive Summary */}
        <div className="space-y-3">
          <PortfolioDigest />

          {/* Predictive alerts summary */}
          {predictiveCount > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border/50 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-status-watch" />
                <h3 className="text-xs font-semibold text-foreground">Predictive Signals</h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-status-watch-bg text-status-watch-text font-medium">{predictiveCount}</span>
              </div>
              <div className="px-3 py-2 space-y-2">
                {(predictiveData?.alerts || []).slice(0, 5).map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-b-0">
                    <div>
                      <div className="text-[11px] font-medium text-foreground">{alert.subtitle}</div>
                      <div className="text-[10px] text-muted-foreground">{alert.title}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] font-semibold text-status-watch">
                        {alert.trendData[alert.trendData.length - 1]}%
                      </div>
                      <div className="text-[9px] text-muted-foreground">{'\u2192'} {alert.threshold}% threshold</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Amigo Chat (always visible) */}
        <div className="sticky top-4">
          <AmigoPanel onClose={() => {}} />
        </div>
      </div>
    </div>
  );
}
