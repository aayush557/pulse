import { useState, useEffect, useRef, useCallback } from "react";
import { MoreVertical, Eye, Zap, X, Search, Download, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { categoryBadgeMap, statusBadgeMap, type Alert, type AlertStatus } from "@/data/alertsData";
import { useAlerts, usePredictiveAlerts, useAlertResolutions } from "@/hooks/useDashboardData";
import type { LiveAlert, PredictiveAlertItem } from "@/types/api";
import AlertDetailPanel from "./AlertDetailPanel";
import ContactSupportDialog from "./ContactSupportDialog";
import MerchantHealthCards from "./MerchantHealthCards";

interface PulseCenterViewProps {
  initialSelectedAlert?: string | null;
  onNavigate?: (view: string) => void;
}

type FilterTab = "all" | "action_needed" | "no_action" | "resolved" | "watch";
type TimeRange = "7d" | "30d" | "90d";

const timeRangeDays: Record<TimeRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

export default function PulseCenterView({ initialSelectedAlert, onNavigate }: PulseCenterViewProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const { data: alertsData, isLoading: alertsLoading } = useAlerts(timeRangeDays[timeRange]);
  const { data: predictiveData } = usePredictiveAlerts();
  const { data: resolutionsData } = useAlertResolutions();

  // Convert API alerts to local Alert shape
  const liveAlerts: Alert[] = (alertsData?.alerts || []).map((a: LiveAlert) => ({
    id: a.id,
    title: a.title,
    subtitle: a.subtitle,
    category: a.category as any,
    categoryLabel: a.categoryLabel,
    merchant: a.merchant,
    amount: a.amount,
    status: a.status,
    statusLabel: a.statusLabel,
    time: a.time,
    timestamp: new Date(a.timestamp),
    aiDetected: a.aiDetected,
    aiExplanation: a.aiExplanation,
    signalConfidence: a.signalConfidence,
    details: a.details as any,
  }));

  // Convert predictive alerts from the new endpoint
  const watchAlerts: Alert[] = (predictiveData?.alerts || []).map((pa: PredictiveAlertItem) => ({
    id: pa.id,
    title: pa.title,
    subtitle: pa.subtitle,
    category: "predictive" as const,
    categoryLabel: "Predictive signal",
    merchant: pa.merchant,
    amount: null,
    status: "watch" as AlertStatus,
    statusLabel: "Watch",
    time: pa.time,
    timestamp: new Date(),
    trendData: pa.trendData,
    projectedData: pa.projectedData,
    threshold: pa.threshold,
    metricLabel: pa.metricLabel,
    details: {
      description: `${pa.subtitle}'s ${pa.metricLabel.toLowerCase()} is trending upward and may cross the ${pa.threshold}% threshold within 7 days.`,
      severity: "warning" as const,
      actionLabel: "Monitor this merchant",
      actionType: "view" as const,
      metadata: {
        "Current value": `${pa.trendData[pa.trendData.length - 1]}%`,
        "Threshold": `${pa.threshold}%`,
        "Trend": "Upward",
        "Projected breach": pa.projectedBreachDay ? `~${pa.projectedBreachDay} days` : "N/A",
      },
    },
  }));

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [selectedAlert, setSelectedAlert] = useState<string | null>(initialSelectedAlert || null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showContactSupport, setShowContactSupport] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [merchantFilter, setMerchantFilter] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (liveAlerts.length > 0 || watchAlerts.length > 0) {
      const combined = [...liveAlerts, ...watchAlerts];

      // Merge persisted resolutions so resolved/dismissed alerts stay that way across reloads
      const resMap = new Map(
        (resolutionsData?.resolutions || []).map((r) => [r.alert_id, r.action])
      );
      const merged = combined.map((a) => {
        const persisted = resMap.get(a.id);
        if (persisted === "resolved") {
          return { ...a, status: "resolved" as AlertStatus, statusLabel: "Resolved" };
        }
        if (persisted === "dismissed") {
          return { ...a, status: "dismissed" as AlertStatus, statusLabel: "Dismissed" };
        }
        return a;
      });

      setAlerts(merged);
    }
  }, [alertsData, predictiveData, resolutionsData]);

  useEffect(() => {
    if (initialSelectedAlert) setSelectedAlert(initialSelectedAlert);
  }, [initialSelectedAlert]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleResolve = (id: string) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: "resolved" as AlertStatus, statusLabel: "Resolved" } : a));
  };

  const handleDismiss = (id: string) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, status: "dismissed" as AlertStatus, statusLabel: "Dismissed" } : a));
    setSelectedAlert(null);
  };

  const handleFilterMerchant = (paypoint: string) => {
    setMerchantFilter(paypoint);
    setFilterTab("all");
  };

  // Filter and sort
  const filteredAlerts = alerts
    .filter((a) => a.status !== "dismissed")
    .filter((a) => {
      if (filterTab !== "all" && a.status !== filterTab) return false;
      if (merchantFilter && a.merchant !== merchantFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const order: Record<string, number> = { action_needed: 0, watch: 1, no_action: 2, resolved: 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });

  const alertIds = filteredAlerts.map(a => a.id);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      switch (e.key) {
        case "ArrowDown":
        case "j": {
          e.preventDefault();
          setFocusedIndex(prev => {
            const next = Math.min(prev + 1, alertIds.length - 1);
            setSelectedAlert(alertIds[next] || null);
            return next;
          });
          break;
        }
        case "ArrowUp":
        case "k": {
          e.preventDefault();
          setFocusedIndex(prev => {
            const next = Math.max(prev - 1, 0);
            setSelectedAlert(alertIds[next] || null);
            return next;
          });
          break;
        }
        case "Enter": {
          if (focusedIndex >= 0 && alertIds[focusedIndex]) {
            setSelectedAlert(alertIds[focusedIndex]);
          }
          break;
        }
        case "Escape": {
          setSelectedAlert(null);
          setFocusedIndex(-1);
          break;
        }
        case "?": {
          e.preventDefault();
          setShowShortcuts(prev => !prev);
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [alertIds, focusedIndex]);

  // Smart grouping: group by merchant subtitle if 3+ alerts
  const merchantAlertCounts: Record<string, Alert[]> = {};
  filteredAlerts.forEach((a) => {
    if (!merchantAlertCounts[a.subtitle]) merchantAlertCounts[a.subtitle] = [];
    merchantAlertCounts[a.subtitle].push(a);
  });

  const groupedMerchants = new Set(
    Object.entries(merchantAlertCounts).filter(([, als]) => als.length >= 3).map(([name]) => name)
  );

  const statsAll = alerts.filter((a) => a.status !== "dismissed");
  const actionCount = alerts.filter((a) => a.status === "action_needed").length;
  const resolvedCount = alerts.filter((a) => a.status === "resolved").length;
  const watchCount = alerts.filter((a) => a.status === "watch").length;

  const filterTabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all", label: "All signals" },
    { key: "action_needed", label: "Action needed", count: actionCount },
    { key: "watch", label: "Predictive", count: watchCount },
    { key: "no_action", label: "No action needed" },
    { key: "resolved", label: "Resolved" },
  ];

  const selectedAlertData = selectedAlert ? alerts.find((a) => a.id === selectedAlert) : null;

  // Build display rows with grouping
  const displayRows: Array<{ type: "single"; alert: Alert } | { type: "group"; merchant: string; alerts: Alert[]; highestStatus: string }> = [];
  const renderedIds = new Set<string>();

  filteredAlerts.forEach((alert) => {
    if (renderedIds.has(alert.id)) return;
    if (groupedMerchants.has(alert.subtitle)) {
      const groupAlerts = merchantAlertCounts[alert.subtitle];
      groupAlerts.forEach((a) => renderedIds.add(a.id));
      const statusOrder: Record<string, number> = { action_needed: 0, watch: 1, no_action: 2, resolved: 3 };
      const highestStatus = groupAlerts.reduce((best, a) => (statusOrder[a.status] ?? 4) < (statusOrder[best.status] ?? 4) ? a : best).status;
      displayRows.push({ type: "group", merchant: alert.subtitle, alerts: groupAlerts, highestStatus });
    } else {
      renderedIds.add(alert.id);
      displayRows.push({ type: "single", alert });
    }
  });

  const toggleGroup = (merchant: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(merchant)) next.delete(merchant); else next.add(merchant);
      return next;
    });
  };

  const exportAlerts = useCallback(() => {
    if (filteredAlerts.length === 0) {
      toast("No alerts to export");
      return;
    }

    const escapeCsv = (value: string | null | undefined): string => {
      if (value == null) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = ["ID", "Title", "Subtitle", "Category", "Merchant", "Amount", "Status", "Time"];
    const rows = filteredAlerts.map((a) => [
      escapeCsv(a.id),
      escapeCsv(a.title),
      escapeCsv(a.subtitle),
      escapeCsv(a.categoryLabel),
      escapeCsv(a.merchant),
      escapeCsv(a.amount),
      escapeCsv(a.statusLabel),
      escapeCsv(a.time),
    ].join(","));

    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const date = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pulse-alerts-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast(`Exported ${filteredAlerts.length} alerts`);
  }, [filteredAlerts]);

  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 bg-card border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Pulse center</h2>
          <p className="text-xs text-muted-foreground mt-0.5">ML-powered predictive signals and portfolio alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate?.("intelligence")}
            className="flex items-center gap-1.5 border border-ai-border bg-ai-bg rounded-md px-2.5 py-1.5 text-[11px] text-ai-text font-medium hover:bg-ai-bg/80 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Ask Amigo
          </button>
          <button
            onClick={exportAlerts}
            className="flex items-center gap-1.5 border border-border rounded-md px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted/50 transition-colors"
          >
            <Download className="w-3 h-3" />
            Export
          </button>
        </div>
      </div>

      {/* Merchant Health Cards (Feature 1) */}
      <MerchantHealthCards onFilterMerchant={handleFilterMerchant} />

      {/* Active merchant filter indicator */}
      {merchantFilter && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Filtered to:</span>
          <span className="text-[10px] font-medium text-foreground bg-muted px-2 py-0.5 rounded-full">{merchantFilter}</span>
          <button onClick={() => setMerchantFilter(null)} className="text-[10px] text-primary hover:underline">Clear</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="px-4 py-2 bg-card border-b border-border/50 flex items-center gap-1.5">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1 ${filterTab === tab.key ? "bg-foreground text-background" : "border border-border text-foreground hover:bg-muted/50"}`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`text-[9px] px-1 py-0 rounded-full ${filterTab === tab.key ? "bg-background/20 text-background" : "bg-muted text-muted-foreground"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search signals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-2 py-1.5 border border-border rounded-md text-[11px] bg-card text-foreground w-40 outline-none focus:border-ring"
            />
          </div>
          <div className="flex border border-border rounded-md overflow-hidden">
            {(["7d", "30d", "90d"] as TimeRange[]).map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-2 py-1 text-[10px] font-medium transition-colors ${timeRange === t ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                Last {t === "7d" ? "7 days" : t === "30d" ? "30 days" : "90 days"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowShortcuts(true)}
            className="w-6 h-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:bg-muted/50 text-[10px] font-mono"
            title="Keyboard shortcuts"
          >
            ?
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 px-4 py-3">
        <div className="bg-card border border-border rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground">Signals this week</div>
          <div className="text-lg font-bold text-foreground">{statsAll.length}</div>
          <div className="text-[10px] text-muted-foreground">{actionCount + alerts.filter(a => a.status === "no_action").length} unresolved</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground">Action required</div>
          <div className="text-lg font-bold text-destructive">{actionCount}</div>
          <div className="text-[10px] text-muted-foreground">Needs attention</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> Predictive signals
          </div>
          <div className="text-lg font-bold text-status-watch">{watchCount}</div>
          <div className="text-[10px] text-muted-foreground">ML-detected trends</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground">Resolved</div>
          <div className="text-lg font-bold text-status-success">{resolvedCount}</div>
          <div className="text-[10px] text-muted-foreground">This week</div>
        </div>
      </div>

      {/* Main content: table + detail/amigo panel */}
      <div className={`px-4 pb-4 ${selectedAlertData ? "grid grid-cols-[1fr_370px] gap-3 items-start" : ""}`}>
        {/* Table */}
        <div>
          <div className="grid grid-cols-[28px_1fr_100px_80px_70px_120px_50px_36px] gap-0 px-3 pb-1.5 border-b border-border mb-0">
            {["", "Signal", "Category", "Merchant", "Amount", "Status", "Time", ""].map((h, i) => (
              <span key={i} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">{h}</span>
            ))}
          </div>

          <div className="bg-card border border-border rounded-lg overflow-visible">
            {alertsLoading ? (
              <div className="py-8 text-center text-muted-foreground text-xs">Loading signals...</div>
            ) : displayRows.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">No signals match this filter</div>
            ) : (
              displayRows.map((row) => {
                if (row.type === "group") {
                  const isExpanded = expandedGroups.has(row.merchant);
                  const groupStatus = statusBadgeMap[row.highestStatus as AlertStatus] || statusBadgeMap.action_needed;
                  const categories = [...new Set(row.alerts.map((a) => a.categoryLabel))];
                  return (
                    <div key={`group-${row.merchant}`}>
                      <div
                        onClick={() => toggleGroup(row.merchant)}
                        className="grid grid-cols-[28px_1fr_100px_80px_70px_120px_50px_36px] gap-0 px-3 py-2.5 items-center border-b border-border/30 cursor-pointer transition-colors hover:bg-muted/30 bg-muted/10"
                      >
                        <div className="px-1">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                        <div className="px-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${groupStatus.dot}`} />
                            <div>
                              <div className="text-xs font-semibold text-foreground">{row.alerts.length} signals — {row.merchant}</div>
                              <div className="flex items-center gap-1 mt-0.5">
                                {categories.map((cat) => (
                                  <span key={cat} className="text-[9px] px-1.5 py-0 rounded-full bg-muted text-muted-foreground">{cat}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="px-1" />
                        <div className="px-1 text-[11px] text-foreground">{row.alerts[0].merchant}</div>
                        <div className="px-1" />
                        <div className="px-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${groupStatus.bg} ${groupStatus.text}`}>
                            {row.alerts[0].statusLabel}
                          </span>
                        </div>
                        <div className="px-1 text-[11px] text-muted-foreground">{row.alerts[0].time}</div>
                        <div className="px-1" />
                      </div>
                      {isExpanded && row.alerts.map((alert) => (
                        <AlertRow
                          key={alert.id}
                          alert={alert}
                          isSelected={selectedAlert === alert.id}
                          isFocused={focusedIndex >= 0 && alertIds[focusedIndex] === alert.id}
                          isIndented
                          onSelect={() => { setSelectedAlert(alert.id); }}
                          openDropdown={openDropdown}
                          setOpenDropdown={setOpenDropdown}
                          onDismiss={handleDismiss}
                          dropdownRef={dropdownRef}
                        />
                      ))}
                    </div>
                  );
                }
                return (
                  <AlertRow
                    key={row.alert.id}
                    alert={row.alert}
                    isSelected={selectedAlert === row.alert.id}
                    isFocused={focusedIndex >= 0 && alertIds[focusedIndex] === row.alert.id}
                    onSelect={() => { setSelectedAlert(row.alert.id); }}
                    openDropdown={openDropdown}
                    setOpenDropdown={setOpenDropdown}
                    onDismiss={handleDismiss}
                    dropdownRef={dropdownRef}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Right panel */}
        {selectedAlertData && (
          <div className="sticky top-4">
            <AlertDetailPanel
              alert={selectedAlertData}
              onClose={() => setSelectedAlert(null)}
              onResolve={handleResolve}
              onDismiss={handleDismiss}
              onContactSupport={() => setShowContactSupport(true)}
            />
          </div>
        )}
      </div>

      {showContactSupport && (
        <ContactSupportDialog
          alertId={selectedAlert}
          onClose={() => setShowContactSupport(false)}
        />
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center" onClick={() => setShowShortcuts(false)}>
          <div className="bg-card border border-border rounded-lg w-[320px] shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-3 space-y-2">
              {[
                ["↓ / j", "Next signal"],
                ["↑ / k", "Previous signal"],
                ["Enter", "Open signal details"],
                ["Esc", "Close detail panel"],
                ["?", "Toggle this help"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{desc}</span>
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted font-mono">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single alert row component ──
function AlertRow({
  alert, isSelected, isFocused, isIndented, onSelect, openDropdown, setOpenDropdown, onDismiss, dropdownRef,
}: {
  alert: Alert;
  isSelected: boolean;
  isFocused?: boolean;
  isIndented?: boolean;
  onSelect: () => void;
  openDropdown: string | null;
  setOpenDropdown: (id: string | null) => void;
  onDismiss: (id: string) => void;
  dropdownRef: React.RefObject<HTMLDivElement>;
}) {
  const catColors = categoryBadgeMap[alert.category];
  const statusColors = statusBadgeMap[alert.status];

  return (
    <div
      onClick={onSelect}
      className={`grid grid-cols-[28px_1fr_100px_80px_70px_120px_50px_36px] gap-0 px-3 py-2.5 items-center border-b border-border/30 last:border-b-0 cursor-pointer transition-colors hover:bg-muted/30 ${isSelected ? "bg-sidebar-accent" : ""} ${alert.status === "resolved" ? "opacity-70" : ""} ${isIndented ? "pl-8" : ""} ${alert.status === "watch" ? "border-l-2 border-l-status-watch" : ""} ${isFocused ? "ring-1 ring-primary/30" : ""}`}
    >
      <div className="px-1">
        <input type="checkbox" className="w-3.5 h-3.5 rounded border-border" onClick={(e) => e.stopPropagation()} />
      </div>
      <div className="px-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors.dot}`} />
          <div>
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              {alert.title}
              {alert.aiDetected && (
                <span className="text-[8px] px-1.5 py-0 rounded-full bg-ai-bg text-ai-text border border-ai-border font-semibold">AI detected</span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground">{alert.id} · {alert.subtitle}</div>
          </div>
        </div>
      </div>
      <div className="px-1">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${catColors?.bg || "bg-muted"} ${catColors?.text || "text-muted-foreground"}`}>
          {alert.categoryLabel}
        </span>
      </div>
      <div className="px-1 text-[11px] text-foreground">{alert.merchant}</div>
      <div className="px-1 text-xs font-semibold text-foreground">{alert.amount || "—"}</div>
      <div className="px-1">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors.bg} ${statusColors.text}`}>
          {alert.statusLabel}
        </span>
      </div>
      <div className="px-1 text-[11px] text-muted-foreground">{alert.time}</div>
      <div className="px-1 relative" ref={dropdownRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === alert.id ? null : alert.id); }}
          className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
        {openDropdown === alert.id && (
          <div className="absolute right-0 top-full mt-0.5 bg-card border border-border rounded-lg shadow-lg z-50 min-w-[160px] animate-slide-in">
            <button onClick={() => { onSelect(); setOpenDropdown(null); }} className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted/50 flex items-center gap-2 rounded-t-lg">
              <Eye className="w-3 h-3" /> View details
            </button>
            {alert.details.actionLabel && alert.status !== "resolved" && (
              <button onClick={() => setOpenDropdown(null)} className="w-full text-left px-3 py-2 text-xs text-foreground hover:bg-muted/50 flex items-center gap-2">
                <Zap className="w-3 h-3" /> {alert.details.actionLabel}
              </button>
            )}
            <hr className="border-border/50" />
            {alert.status !== "resolved" && (
              <button
                onClick={() => { onDismiss(alert.id); setOpenDropdown(null); }}
                className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-status-danger-bg flex items-center gap-2 rounded-b-lg"
              >
                <X className="w-3 h-3" /> Dismiss signal
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
