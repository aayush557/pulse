import { useState, useEffect, useRef } from "react";
import { MoreVertical, Eye, Zap, X, Search, Download, Filter, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { alertsData, categoryBadgeMap, statusBadgeMap, type Alert, type AlertStatus } from "@/data/alertsData";
import { predictiveAlerts } from "@/data/mlData";
import AlertDetailPanel from "./AlertDetailPanel";
import ContactSupportDialog from "./ContactSupportDialog";
import MerchantHealthCards from "./MerchantHealthCards";
import AmigoPanel from "./AmigoPanel";

interface PulseCenterViewProps {
  initialSelectedAlert?: string | null;
}

type FilterTab = "all" | "action_needed" | "no_action" | "resolved" | "watch";
type TimeRange = "7d" | "30d" | "90d";

// Convert predictive alerts into the Alert interface for unified display
const watchAlerts: Alert[] = predictiveAlerts.map((pa) => ({
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
  timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
  details: {
    description: `${pa.subtitle}'s ${pa.metricLabel.toLowerCase()} is trending upward and may cross the ${pa.threshold}% threshold within 7 days based on current trajectory.`,
    severity: "warning" as const,
    actionLabel: "Monitor this merchant",
    actionType: "view" as const,
    context: "This is a proactive signal based on historical patterns — no hold has been placed.",
    metadata: {
      "Current value": `${pa.trendData[pa.trendData.length - 1]}%`,
      "Threshold": `${pa.threshold}%`,
      "Trend": "Upward",
      "Projected breach": "~5-7 days",
    },
  },
}));

export default function PulseCenterView({ initialSelectedAlert }: PulseCenterViewProps) {
  const [alerts, setAlerts] = useState<Alert[]>([...alertsData, ...watchAlerts]);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [selectedAlert, setSelectedAlert] = useState<string | null>(initialSelectedAlert || null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showContactSupport, setShowContactSupport] = useState(false);
  const [showAmigo, setShowAmigo] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [merchantFilter, setMerchantFilter] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
  const credAlert = alerts.find((a) => a.category === "credential" && a.status !== "dismissed");

  const filterTabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "all", label: "All alerts" },
    { key: "action_needed", label: "Action needed", count: actionCount },
    { key: "watch", label: "Watch", count: watchCount },
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

  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 bg-card border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Pulse center</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Resolve issues directly — no navigation required</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAmigo(!showAmigo)}
            className="flex items-center gap-1.5 border border-ai-border bg-ai-bg rounded-md px-2.5 py-1.5 text-[11px] text-ai-text font-medium hover:bg-ai-bg/80 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Ask Amigo
          </button>
          <button className="flex items-center gap-1.5 border border-border rounded-md px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted/50 transition-colors">
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
              placeholder="Search alerts..."
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
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-2 px-4 py-3">
        <div className="bg-card border border-border rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground">Alerts this week</div>
          <div className="text-lg font-bold text-foreground">{statsAll.length}</div>
          <div className="text-[10px] text-muted-foreground">{actionCount + alerts.filter(a => a.status === "no_action").length} unresolved</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground">Action required</div>
          <div className="text-lg font-bold text-destructive">{actionCount}</div>
          <div className="text-[10px] text-muted-foreground">Needs attention</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground">Watch signals</div>
          <div className="text-lg font-bold text-status-watch">{watchCount}</div>
          <div className="text-[10px] text-muted-foreground">Predictive</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground">Resolved</div>
          <div className="text-lg font-bold text-status-success">{resolvedCount}</div>
          <div className="text-[10px] text-muted-foreground">This week</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground">Credential expiry</div>
          <div className="text-lg font-bold text-status-warning">{credAlert ? "18d" : "—"}</div>
          <div className="text-[10px] text-muted-foreground">{credAlert ? "REST API Token" : "No upcoming"}</div>
        </div>
      </div>

      {/* Main content: table + detail/amigo panel */}
      <div className={`px-4 pb-4 ${(selectedAlertData || showAmigo) ? "grid grid-cols-[1fr_370px] gap-3 items-start" : ""}`}>
        {/* Table */}
        <div>
          <div className="grid grid-cols-[28px_1fr_100px_80px_70px_120px_50px_36px] gap-0 px-3 pb-1.5 border-b border-border mb-0">
            {["", "Alert", "Category", "Merchant", "Amount", "Status", "Time", ""].map((h, i) => (
              <span key={i} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">{h}</span>
            ))}
          </div>

          <div className="bg-card border border-border rounded-lg overflow-visible">
            {displayRows.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">No alerts match this filter</div>
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
                              <div className="text-xs font-semibold text-foreground">{row.alerts.length} alerts — {row.merchant}</div>
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
                          isIndented
                          onSelect={() => { setSelectedAlert(alert.id); setShowAmigo(false); }}
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
                    onSelect={() => { setSelectedAlert(row.alert.id); setShowAmigo(false); }}
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
        {showAmigo && !selectedAlertData && (
          <div className="sticky top-4">
            <AmigoPanel onClose={() => setShowAmigo(false)} />
          </div>
        )}
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
    </div>
  );
}

// ── Single alert row component ──
function AlertRow({
  alert, isSelected, isIndented, onSelect, openDropdown, setOpenDropdown, onDismiss, dropdownRef,
}: {
  alert: Alert;
  isSelected: boolean;
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
      className={`grid grid-cols-[28px_1fr_100px_80px_70px_120px_50px_36px] gap-0 px-3 py-2.5 items-center border-b border-border/30 last:border-b-0 cursor-pointer transition-colors hover:bg-muted/30 ${isSelected ? "bg-sidebar-accent" : ""} ${alert.status === "resolved" ? "opacity-70" : ""} ${isIndented ? "pl-8" : ""} ${alert.status === "watch" ? "border-l-2 border-l-status-watch" : ""}`}
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
                <X className="w-3 h-3" /> Dismiss alert
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
