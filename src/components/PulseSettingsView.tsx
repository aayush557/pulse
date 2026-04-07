import { useState, useEffect } from "react";
import { Mail, Clock, Calendar, Save, Bell, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useSettingsRecommendations, useSubscriptions, useUpdateSubscriptions } from "@/hooks/useDashboardData";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";

interface ToggleSetting {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  badge: "mvp" | "soon";
  config?: { label: string; value: string; suffix?: string };
}

export default function PulseSettingsView() {
  const { data: recsData } = useSettingsRecommendations();
  const { data: subsData } = useSubscriptions();
  const updateSubs = useUpdateSubscriptions();
  const queryClient = useQueryClient();

  const getRecommendation = (settingId: string) => {
    if (!recsData?.recommendations) return null;
    return recsData.recommendations.find((r) => r.settingId === settingId);
  };

  const [settings, setSettings] = useState<ToggleSetting[]>([
    { id: "batch_holds", title: "Batch holds", description: "Alert when a merchant batch is placed under funding review", enabled: true, badge: "mvp", config: { label: "Min. hold amount", value: "5000", suffix: "$" } },
    { id: "payout_failures", title: "Payout failures", description: "Alert when a payout or ACH return reaches a failed or returned status", enabled: true, badge: "mvp" },
    { id: "credential_expiry", title: "Credential expiration", description: "Alert at 30 days and 7 days before an API token expires", enabled: true, badge: "mvp" },
    { id: "webhook_health", title: "Webhook health", description: "Alert when an endpoint accumulates 3+ delivery failures in 30 minutes", enabled: true, badge: "mvp" },
    { id: "merchant_inactivity", title: "Merchant inactivity", description: "Alert when a paypoint processes $0 for consecutive days", enabled: true, badge: "mvp", config: { label: "Days", value: "3", suffix: "d" } },
    { id: "decline_rate", title: "Decline rate anomaly", description: "Alert when a merchant's decline rate crosses your threshold", enabled: false, badge: "soon", config: { label: "Threshold", value: "20", suffix: "%" } },
  ]);

  // Sync toggle state from server when subscription data loads
  useEffect(() => {
    if (subsData) {
      setSettings((prev) =>
        prev.map((s) => {
          const serverVal = subsData[s.id as keyof typeof subsData];
          return typeof serverVal === "boolean" ? { ...s, enabled: serverVal } : s;
        })
      );
    }
  }, [subsData]);

  const [recipients, setRecipients] = useState("ops@payabli.com, aayush@payabli.com");
  const [quietHours, setQuietHours] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  const toggleSetting = (id: string) => {
    if (settings.find((s) => s.id === id)?.badge === "soon") return;

    setSettings((prev) => prev.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));

    const current = settings.find((s) => s.id === id);
    if (current) {
      updateSubs.mutate(
        { [id]: !current.enabled },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
            toast.success("Settings saved");
          },
          onError: () => {
            // Revert on failure
            setSettings((prev) => prev.map((s) => s.id === id ? { ...s, enabled: current.enabled } : s));
            toast.error("Failed to save setting");
          },
        }
      );
    }
  };

  const updateConfig = (id: string, value: string) => {
    setSettings((prev) => prev.map((s) => s.id === id && s.config ? { ...s, config: { ...s.config, value } } : s));
  };

  const applyRecommendation = (settingId: string, value: string) => {
    updateConfig(settingId, value);
    toast.success("AI recommendation applied");
  };

  const handleSave = () => {
    const payload: Record<string, boolean> = {};
    settings.forEach((s) => { payload[s.id] = s.enabled; });
    updateSubs.mutate(payload, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
        toast.success("Pulse settings saved successfully");
      },
      onError: () => {
        toast.error("Failed to save settings");
      },
    });
  };

  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-foreground mb-0.5">Pulse settings</h2>
      <p className="text-xs text-muted-foreground mb-4">Control which signals Pulse monitors. Every category is opt-in.</p>

      {/* Alert subscriptions */}
      <div className="bg-card border border-border rounded-lg mb-3">
        <div className="px-3 py-2.5 border-b border-border/50">
          <h3 className="text-xs font-semibold text-foreground">Alert subscriptions</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Configure which portfolio events Pulse monitors.</p>
        </div>
        {settings.map((s) => {
          const aiRec = getRecommendation(s.id);
          return (
            <div key={s.id} className="flex items-start gap-3 px-3 py-2.5 border-b border-border/20 last:border-b-0">
              <div className="flex-1">
                <div className="text-xs font-medium text-foreground mb-0.5">{s.title}</div>
                <div className="text-[11px] text-muted-foreground">{s.description}</div>
                {s.config && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-muted-foreground">{s.config.label}</span>
                    <div className="flex items-center border border-border rounded px-2 py-0.5">
                      {s.config.suffix === "$" && <span className="text-[10px] text-muted-foreground mr-1">$</span>}
                      <input
                        type="text"
                        value={s.config.value}
                        onChange={(e) => updateConfig(s.id, e.target.value)}
                        className="w-12 text-[11px] text-foreground bg-transparent outline-none"
                        disabled={s.badge === "soon"}
                      />
                      {s.config.suffix && s.config.suffix !== "$" && <span className="text-[10px] text-muted-foreground ml-1">{s.config.suffix}</span>}
                    </div>
                  </div>
                )}
                {/* AI Threshold Recommendation (Feature 5) */}
                {aiRec && s.config && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="mt-2 inline-flex items-center gap-2 bg-ai-bg border border-ai-border rounded-md px-2.5 py-1.5">
                        <Sparkles className="w-3 h-3 text-ai-text flex-shrink-0" />
                        <span className="text-[10px] text-ai-text">{aiRec.explanation}</span>
                        <button
                          onClick={() => applyRecommendation(s.id, aiRec.recommendedValue)}
                          className="text-[9px] font-semibold text-ai-text bg-ai-border/50 hover:bg-ai-border rounded px-1.5 py-0.5 transition-colors flex-shrink-0"
                        >
                          Apply
                        </button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px] max-w-[260px]">
                      This threshold is calibrated to your portfolio's historical patterns. It's designed to catch meaningful anomalies without generating noise for normal variation.
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${s.badge === "mvp" ? "bg-status-success-bg text-status-success-text" : "bg-status-purple-bg text-status-purple-text"}`}>
                  {s.badge === "mvp" ? "MVP" : "Coming soon"}
                </span>
                <button
                  onClick={() => toggleSetting(s.id)}
                  className={`w-8 h-[18px] rounded-full relative transition-colors flex-shrink-0 ${s.enabled ? "bg-primary" : "bg-muted-foreground/30"} ${s.badge === "soon" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  disabled={s.badge === "soon"}
                >
                  <div className={`w-3.5 h-3.5 bg-card rounded-full absolute top-[2px] transition-all ${s.enabled ? "left-[17px]" : "left-[2px]"}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delivery preferences */}
      <div className="bg-card border border-border rounded-lg mb-3">
        <div className="px-3 py-2.5 border-b border-border/50">
          <h3 className="text-xs font-semibold text-foreground">Delivery preferences</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Critical alerts always fire immediately regardless of quiet hours.</p>
        </div>

        <div className="px-3 py-2.5 border-b border-border/20 flex items-center gap-3">
          <div className="w-6 h-6 bg-sidebar-accent rounded flex items-center justify-center flex-shrink-0">
            <Mail className="w-3 h-3 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-foreground mb-0.5">Alert recipients</div>
            <input
              type="text"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-[11px] text-foreground bg-card outline-none focus:border-ring"
            />
          </div>
        </div>

        <div className="px-3 py-2.5 border-b border-border/20 flex items-center gap-3">
          <div className="w-6 h-6 bg-sidebar-accent rounded flex items-center justify-center flex-shrink-0">
            <Clock className="w-3 h-3 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-foreground mb-0.5">Quiet hours (10 PM – 8 AM)</div>
            <div className="text-[11px] text-muted-foreground">Non-critical alerts batch and deliver at 8 AM.</div>
          </div>
          <button
            onClick={() => setQuietHours(!quietHours)}
            className={`w-8 h-[18px] rounded-full relative transition-colors flex-shrink-0 cursor-pointer ${quietHours ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <div className={`w-3.5 h-3.5 bg-card rounded-full absolute top-[2px] transition-all ${quietHours ? "left-[17px]" : "left-[2px]"}`} />
          </button>
        </div>

        <div className="px-3 py-2.5 flex items-center gap-3">
          <div className="w-6 h-6 bg-sidebar-accent rounded flex items-center justify-center flex-shrink-0">
            <Calendar className="w-3 h-3 text-primary" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-foreground mb-0.5">Weekly portfolio digest</div>
            <div className="text-[11px] text-muted-foreground">Summary of portfolio activity every Monday</div>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-status-purple-bg text-status-purple-text mr-2">Coming soon</span>
          <button className="w-8 h-[18px] rounded-full relative bg-muted-foreground/30 opacity-50 cursor-not-allowed flex-shrink-0">
            <div className="w-3.5 h-3.5 bg-card rounded-full absolute top-[2px] left-[2px]" />
          </button>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-1.5 bg-foreground text-background px-4 py-2 rounded-md text-xs font-semibold hover:opacity-90 transition-opacity"
      >
        <Save className="w-3 h-3" />
        Save preferences
      </button>
    </div>
  );
}
