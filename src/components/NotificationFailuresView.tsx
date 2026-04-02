import { useState } from "react";
import {
  Clock, Zap, WifiOff, Ban, Server, Copy, CheckCircle2,
  ChevronDown, ChevronRight, Ticket, RefreshCw, Loader2,
  AlertTriangle, ExternalLink, Sparkles, Send
} from "lucide-react";
import { useNotificationFailures, useLinearConfig, useCreateLinearIssue } from "@/hooks/useDashboardData";
import type { NotificationFailureGroup, WebhookFailureType } from "@/types/api";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// ── Failure type visual config ─────────────────────────────────────────

const typeConfig: Record<WebhookFailureType, {
  icon: React.ElementType;
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}> = {
  timeout: {
    icon: Clock,
    label: "Timeout",
    bg: "bg-orange-50",
    text: "text-orange-800",
    border: "border-orange-200",
    dot: "bg-orange-500",
  },
  rate_limited: {
    icon: Zap,
    label: "Rate Limited",
    bg: "bg-yellow-50",
    text: "text-yellow-800",
    border: "border-yellow-200",
    dot: "bg-yellow-500",
  },
  dead_endpoint: {
    icon: WifiOff,
    label: "Dead Endpoint",
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  handler_error: {
    icon: Ban,
    label: "Handler Error",
    bg: "bg-purple-50",
    text: "text-purple-800",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  server_error: {
    icon: Server,
    label: "Server Error",
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-200",
    dot: "bg-red-500",
  },
};

const priorityConfig: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-red-100", text: "text-red-800", label: "Critical" },
  high: { bg: "bg-orange-100", text: "text-orange-800", label: "High" },
  medium: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Medium" },
  low: { bg: "bg-slate-100", text: "text-slate-600", label: "Low" },
};

// ── Main component ─────────────────────────────────────────────────────

export default function NotificationFailuresView() {
  const { data, isLoading, error } = useNotificationFailures();
  const { data: linearConfig } = useLinearConfig();
  const createIssue = useCreateLinearIssue();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [groupBy, setGroupBy] = useState<"type" | "priority" | "none">("type");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [createdTickets, setCreatedTickets] = useState<Record<string, { identifier: string; url: string }>>({});
  const [creatingId, setCreatingId] = useState<string | null>(null);

  // Auto-select first team when config loads
  const linearReady = linearConfig?.configured && linearConfig.teams.length > 0;
  const effectiveTeamId = selectedTeamId || (linearConfig?.teams[0]?.id ?? "");

  const handleCreateTicket = async (group: NotificationFailureGroup) => {
    if (!effectiveTeamId) return;
    setCreatingId(group.id);
    try {
      const result = await createIssue.mutateAsync({
        teamId: effectiveTeamId,
        title: group.aiAnalysis.ticketTitle,
        body: group.aiAnalysis.ticketBody,
        priority: group.aiAnalysis.priority,
        groupId: group.id,
      });
      setCreatedTickets((prev) => ({
        ...prev,
        [group.id]: { identifier: result.identifier, url: result.url },
      }));
      toast.success(`Created ${result.identifier}`);
      window.open(result.url, "_blank");
    } catch (err: any) {
      toast.error(err.message || "Failed to create ticket");
    } finally {
      setCreatingId(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/notification-failures/refresh", { method: "POST" });
      await queryClient.invalidateQueries({ queryKey: ["notification-failures"] });
      toast.success("Refreshing analysis...");
    } catch {
      toast.error("Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  };

  const copyTicket = (group: NotificationFailureGroup) => {
    const content = `${group.aiAnalysis.ticketTitle}\n\n${group.aiAnalysis.ticketBody}`;
    navigator.clipboard.writeText(content);
    setCopiedId(group.id);
    toast.success("Ticket copied to clipboard");
    setTimeout(() => setCopiedId(null), 2500);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Analyzing notification failures with AI...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-status-danger-bg border border-status-danger-border rounded-lg p-4 text-sm text-status-danger-text">
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Failed to load notification failures: {(error as Error).message}
        </div>
      </div>
    );
  }

  const groups = data?.groups || [];

  // Group the groups by failure type or priority
  const grouped = groupItems(groups, groupBy);

  // Summary stats
  const totalFailures = groups.reduce((sum, g) => sum + g.failCount, 0);
  const ongoingCount = groups.filter((g) => g.isOngoing).length;
  const criticalCount = groups.filter((g) => g.aiAnalysis.priority === "critical").length;
  const uniqueEndpoints = new Set(groups.map((g) => g.endpointHost)).size;

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Notification failures</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Webhook delivery errors grouped and analyzed
            {data?.fromCache && (
              <span className="text-[10px] ml-2 text-muted-foreground/60">
                (cached {new Date(data.generatedAt).toLocaleTimeString()})
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-border rounded-md overflow-hidden">
            {(["type", "priority", "none"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                  groupBy === g ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {g === "type" ? "By type" : g === "priority" ? "By priority" : "Flat"}
              </button>
            ))}
          </div>
          {linearReady && linearConfig.teams.length > 1 && (
            <select
              value={effectiveTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="border border-border rounded-md px-2 py-1.5 text-[11px] text-foreground bg-background"
            >
              {linearConfig.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.key} — {team.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 border border-border rounded-md px-2.5 py-1.5 text-[11px] text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
            Re-analyze
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-card border border-border rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground">Total failures</div>
          <div className="text-lg font-bold text-foreground">{totalFailures.toLocaleString()}</div>
          <div className="text-[10px] text-muted-foreground">Last 30 days</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground">Ongoing issues</div>
          <div className={`text-lg font-bold ${ongoingCount > 0 ? "text-destructive" : "text-status-success"}`}>
            {ongoingCount}
          </div>
          <div className="text-[10px] text-muted-foreground">Active in last 48h</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground">Critical</div>
          <div className={`text-lg font-bold ${criticalCount > 0 ? "text-destructive" : "text-status-success"}`}>
            {criticalCount}
          </div>
          <div className="text-[10px] text-muted-foreground">Need immediate action</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5">
          <div className="text-[10px] text-muted-foreground">Endpoints affected</div>
          <div className="text-lg font-bold text-foreground">{uniqueEndpoints}</div>
          <div className="text-[10px] text-muted-foreground">Unique hosts</div>
        </div>
      </div>

      {/* Grouped failure list */}
      {groups.length === 0 ? (
        <div className="bg-card border border-border rounded-lg py-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-status-success mx-auto mb-2" />
          <div className="text-sm font-medium text-foreground">All clear</div>
          <div className="text-xs text-muted-foreground">No significant notification failures in the last 30 days</div>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((section) => (
            <div key={section.label} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Section header (if grouped) */}
              {groupBy !== "none" && (
                <div className="px-3 py-2 border-b border-border/50 bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {section.icon && <section.icon className={`w-3.5 h-3.5 ${section.iconColor}`} />}
                    <span className="text-xs font-semibold text-foreground">{section.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {section.items.length} group{section.items.length !== 1 ? "s" : ""} &middot; {section.items.reduce((s, g) => s + g.failCount, 0).toLocaleString()} failures
                    </span>
                  </div>
                </div>
              )}

              {/* Items */}
              {section.items.map((group) => {
                const isExpanded = expandedId === group.id;
                const tc = typeConfig[group.failureType];
                const pc = priorityConfig[group.aiAnalysis.priority];
                const TypeIcon = tc.icon;

                return (
                  <div key={group.id} className="border-b border-border/30 last:border-b-0">
                    {/* Row */}
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : group.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/30 ${isExpanded ? "bg-muted/20" : ""}`}
                    >
                      {isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      }

                      {/* Ongoing indicator */}
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${group.isOngoing ? tc.dot : "bg-muted-foreground/30"}`} />

                      {/* Endpoint + summary */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {group.endpointHost}
                          </span>
                          {group.isOngoing && (
                            <span className="text-[8px] px-1.5 py-0 rounded-full bg-destructive/10 text-destructive font-semibold">
                              ONGOING
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {group.aiAnalysis.summary}
                        </div>
                      </div>

                      {/* Type badge */}
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${tc.bg} ${tc.text} border ${tc.border}`}>
                        <TypeIcon className="w-2.5 h-2.5 inline mr-0.5 -mt-px" />
                        {tc.label}
                      </span>

                      {/* Priority badge */}
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${pc.bg} ${pc.text}`}>
                        {pc.label}
                      </span>

                      {/* Fail count */}
                      <span className="text-xs font-bold text-foreground w-16 text-right flex-shrink-0">
                        {group.failCount.toLocaleString()}
                      </span>

                      {/* Success rate */}
                      <span className={`text-[11px] font-semibold w-14 text-right flex-shrink-0 ${
                        group.successRate < 90 ? "text-destructive" : group.successRate < 98 ? "text-status-warning-text" : "text-status-success-text"
                      }`}>
                        {group.successRate}%
                      </span>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-border/20 bg-muted/10">
                        <div className="grid grid-cols-[1fr_370px] gap-4">
                          {/* Left: Details */}
                          <div className="space-y-3">
                            {/* AI Analysis */}
                            <div className="bg-ai-bg border border-ai-border rounded-md p-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <Sparkles className="w-3 h-3 text-ai-text" />
                                <span className="text-[10px] font-semibold text-ai-text uppercase tracking-wider">AI Analysis</span>
                              </div>
                              <div className="space-y-1.5">
                                <div className="text-[11px] text-foreground">
                                  <span className="font-semibold">Root cause:</span> {group.aiAnalysis.rootCause}
                                </div>
                                <div className="text-[11px] text-foreground">
                                  <span className="font-semibold">Impact:</span> {group.aiAnalysis.impact}
                                </div>
                              </div>
                            </div>

                            {/* Metadata */}
                            <div className="bg-muted/30 border border-border rounded-md p-2.5">
                              <div className="grid grid-cols-[100px_1fr] gap-x-2 gap-y-1.5">
                                <span className="text-[10px] text-muted-foreground">Endpoint</span>
                                <span className="text-[10px] text-foreground font-mono break-all">{group.endpoint}</span>

                                <span className="text-[10px] text-muted-foreground">HTTP Status</span>
                                <span className="text-[10px] text-foreground">{group.statusCode}</span>

                                <span className="text-[10px] text-muted-foreground">Period</span>
                                <span className="text-[10px] text-foreground">
                                  {new Date(group.firstFailure).toLocaleDateString()} &ndash; {new Date(group.lastFailure).toLocaleDateString()}
                                </span>

                                <span className="text-[10px] text-muted-foreground">Paypoints</span>
                                <span className="text-[10px] text-foreground">{group.affectedPaypoints}</span>

                                <span className="text-[10px] text-muted-foreground">Organizations</span>
                                <span className="text-[10px] text-foreground">{group.orgs.map((o) => o.name).join(", ")}</span>

                                <span className="text-[10px] text-muted-foreground">Events</span>
                                <div className="flex flex-wrap gap-1">
                                  {group.affectedEvents.map((evt) => (
                                    <span key={evt} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-foreground">{evt}</span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Error samples */}
                            {group.errorSamples.length > 0 && (
                              <div>
                                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                                  Error from endpoint
                                </div>
                                {group.errorSamples.slice(0, 2).map((sample, i) => (
                                  <div key={i} className="bg-status-danger-bg border border-status-danger-border rounded-md p-2 mb-1.5 text-[10px] font-mono text-status-danger-text break-all leading-relaxed">
                                    {sample}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Right: Ticket preview */}
                          <div className="space-y-3">
                            <div className="bg-card border border-border rounded-md overflow-hidden">
                              <div className="px-3 py-2 border-b border-border/50 bg-muted/30 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Ticket className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">SRE Ticket</span>
                                </div>
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${pc.bg} ${pc.text}`}>
                                  {pc.label} priority
                                </span>
                              </div>
                              <div className="p-3 space-y-2">
                                <div className="text-xs font-semibold text-foreground">
                                  {group.aiAnalysis.ticketTitle}
                                </div>
                                <div className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed border-t border-border/30 pt-2">
                                  {group.aiAnalysis.ticketBody}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2">
                              {/* Primary action: Create in Linear or view created ticket */}
                              {createdTickets[group.id] ? (
                                <a
                                  href={createdTickets[group.id].url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center justify-center gap-1.5 py-2 rounded-md bg-status-success text-primary-foreground text-xs font-semibold w-full"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  {createdTickets[group.id].identifier} — View in Linear
                                </a>
                              ) : linearReady ? (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCreateTicket(group); }}
                                  disabled={creatingId === group.id}
                                  className="flex items-center justify-center gap-1.5 py-2 rounded-md bg-foreground text-background text-xs font-semibold w-full hover:opacity-90 transition-all disabled:opacity-60"
                                >
                                  {creatingId === group.id
                                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Creating...</>
                                    : <><Send className="w-3 h-3" /> Create in Linear</>
                                  }
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); copyTicket(group); }}
                                  className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold w-full transition-all ${
                                    copiedId === group.id
                                      ? "bg-status-success text-primary-foreground"
                                      : "bg-foreground text-background hover:opacity-90"
                                  }`}
                                >
                                  {copiedId === group.id
                                    ? <><CheckCircle2 className="w-3 h-3" /> Copied</>
                                    : <><Copy className="w-3 h-3" /> Copy ticket</>
                                  }
                                </button>
                              )}

                              {/* Secondary actions */}
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); copyTicket(group); }}
                                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-border text-[11px] font-medium transition-all ${
                                    copiedId === group.id
                                      ? "bg-status-success/10 text-status-success-text border-status-success"
                                      : "text-foreground hover:bg-muted/50"
                                  }`}
                                >
                                  {copiedId === group.id
                                    ? <><CheckCircle2 className="w-3 h-3" /> Copied</>
                                    : <><Copy className="w-3 h-3" /> Copy</>
                                  }
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); window.open(group.endpoint, "_blank"); }}
                                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-border text-[11px] font-medium text-foreground hover:bg-muted/50 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Open URL
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Grouping helper ────────────────────────────────────────────────────

interface GroupSection {
  label: string;
  icon?: React.ElementType;
  iconColor?: string;
  items: NotificationFailureGroup[];
}

function groupItems(
  items: NotificationFailureGroup[],
  by: "type" | "priority" | "none"
): GroupSection[] {
  if (by === "none") {
    return [{ label: "All", items }];
  }

  if (by === "type") {
    const buckets = new Map<WebhookFailureType, NotificationFailureGroup[]>();
    for (const item of items) {
      const list = buckets.get(item.failureType) || [];
      list.push(item);
      buckets.set(item.failureType, list);
    }
    const order: WebhookFailureType[] = ["timeout", "dead_endpoint", "rate_limited", "handler_error", "server_error"];
    return order
      .filter((t) => buckets.has(t))
      .map((t) => ({
        label: typeConfig[t].label,
        icon: typeConfig[t].icon,
        iconColor: typeConfig[t].text,
        items: buckets.get(t)!,
      }));
  }

  // by priority
  const buckets = new Map<string, NotificationFailureGroup[]>();
  for (const item of items) {
    const p = item.aiAnalysis.priority;
    const list = buckets.get(p) || [];
    list.push(item);
    buckets.set(p, list);
  }
  const order = ["critical", "high", "medium", "low"];
  return order
    .filter((p) => buckets.has(p))
    .map((p) => ({
      label: priorityConfig[p].label,
      icon: AlertTriangle,
      iconColor: priorityConfig[p].text,
      items: buckets.get(p)!,
    }));
}
