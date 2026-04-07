import { useState } from "react";
import { usePartnerRisk } from "@/hooks/useDashboardData";
import type { PartnerRiskScore, RateDetail } from "@/types/api";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ShieldAlert,
  Eye,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Info,
} from "lucide-react";

// ── Tier config ─────────────────────────────────────────────────────

const tierMeta: Record<
  string,
  { label: string; icon: React.ElementType; bg: string; text: string; dot: string; border: string }
> = {
  elevated: {
    label: "Elevated",
    icon: ShieldAlert,
    bg: "bg-status-danger-bg",
    text: "text-status-danger-text",
    dot: "bg-destructive",
    border: "border-destructive/30",
  },
  watch: {
    label: "Watch",
    icon: Eye,
    bg: "bg-status-warning-bg",
    text: "text-status-warning-text",
    dot: "bg-status-warning",
    border: "border-status-warning/30",
  },
  normal: {
    label: "Normal",
    icon: ShieldCheck,
    bg: "bg-status-success-bg",
    text: "text-status-success-text",
    dot: "bg-status-success",
    border: "border-status-success/30",
  },
};

// ── Sparkline ───────────────────────────────────────────────────────

function Sparkline({
  data,
  color,
  width = 64,
  height = 24,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`
    )
    .join(" ");
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Score bar ───────────────────────────────────────────────────────

function ScoreBar({ score, tier }: { score: number; tier: string }) {
  const colors: Record<string, string> = {
    elevated: "bg-destructive",
    watch: "bg-status-warning",
    normal: "bg-status-success",
  };
  return (
    <div className="flex items-center gap-2 w-28">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colors[tier] || "bg-primary"}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono font-semibold text-foreground w-7 text-right">
        {score.toFixed(0)}
      </span>
    </div>
  );
}

// ── Credible interval bar ───────────────────────────────────────────

function CredibleIntervalBar({
  rate,
  detail,
}: {
  rate: string;
  detail: RateDetail;
}) {
  const maxRate =
    rate === "decline" ? 0.6 : rate === "returns" ? 0.1 : 0.02;
  const scale = (v: number) => Math.min((v / maxRate) * 100, 100);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden cursor-help">
          {/* CI range */}
          <div
            className="absolute h-full bg-primary/20 rounded-full"
            style={{
              left: `${scale(detail.ci_lower)}%`,
              width: `${scale(detail.ci_upper) - scale(detail.ci_lower)}%`,
            }}
          />
          {/* Posterior mean */}
          <div
            className="absolute w-1.5 h-full bg-primary rounded-full"
            style={{ left: `${scale(detail.posterior_mean)}%` }}
          />
          {/* Peer mean marker */}
          <div
            className="absolute w-0.5 h-full bg-muted-foreground/50"
            style={{ left: `${scale(detail.peer_mean)}%` }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px] max-w-[240px]">
        <div>
          Posterior: {(detail.posterior_mean * 100).toFixed(2)}% [{(detail.ci_lower * 100).toFixed(2)}–{(detail.ci_upper * 100).toFixed(2)}%]
        </div>
        <div className="text-muted-foreground">
          Peer mean: {(detail.peer_mean * 100).toFixed(2)}% ({detail.peer_group})
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Trend icon ──────────────────────────────────────────────────────

function TrendIcon({ direction }: { direction: string }) {
  if (direction === "rising")
    return <TrendingUp className="w-3 h-3 text-destructive" />;
  if (direction === "falling")
    return <TrendingDown className="w-3 h-3 text-status-success" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
}

// ── Rate detail row ─────────────────────────────────────────────────

function RateDetailRow({
  label,
  rateKey,
  detail,
}: {
  label: string;
  rateKey: string;
  detail: RateDetail;
}) {
  const pElevated = detail.p_elevated;
  const zScore = detail.z_score;

  return (
    <div className="grid grid-cols-[80px_60px_1fr_60px_50px_50px_72px] items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-[10px] font-medium text-muted-foreground">
        {label}
      </span>
      <span className="text-[11px] font-mono font-semibold text-foreground">
        {(detail.observed_rate * 100).toFixed(2)}%
      </span>
      <CredibleIntervalBar rate={rateKey} detail={detail} />
      <div className="flex items-center gap-1">
        {pElevated > 0.8 ? (
          <AlertTriangle className="w-3 h-3 text-destructive" />
        ) : pElevated > 0.5 ? (
          <Info className="w-3 h-3 text-status-warning" />
        ) : null}
        <span
          className={`text-[10px] font-mono ${
            pElevated > 0.8
              ? "text-destructive font-semibold"
              : pElevated > 0.5
                ? "text-status-warning-text"
                : "text-muted-foreground"
          }`}
        >
          {(pElevated * 100).toFixed(0)}%
        </span>
      </div>
      <Tooltip>
        <TooltipTrigger>
          <span
            className={`text-[10px] font-mono ${
              Math.abs(zScore) > 2
                ? "text-destructive font-semibold"
                : Math.abs(zScore) > 1.5
                  ? "text-status-warning-text"
                  : "text-muted-foreground"
            }`}
          >
            {zScore > 0 ? "+" : ""}
            {zScore.toFixed(1)}σ
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">
          Peer group: {detail.peer_group}
        </TooltipContent>
      </Tooltip>
      <div className="flex items-center gap-1">
        <TrendIcon direction={detail.trend_direction} />
        {detail.cusum_alarm && (
          <Tooltip>
            <TooltipTrigger>
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              CUSUM alarm — sustained drift detected
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <Sparkline
        data={detail.weekly_rates}
        color={
          detail.trend_direction === "rising"
            ? "hsl(0, 84%, 60%)"
            : detail.trend_direction === "falling"
              ? "hsl(142, 71%, 45%)"
              : "hsl(213, 94%, 56%)"
        }
      />
    </div>
  );
}

// ── Expanded detail panel ───────────────────────────────────────────

function PartnerDetail({ partner }: { partner: PartnerRiskScore }) {
  const rateRows: { label: string; key: string; detail: RateDetail | null }[] = [
    { label: "Decline", key: "decline", detail: partner.decline },
    { label: "Return", key: "returns", detail: partner.returns },
    { label: "Chargeback", key: "chargeback", detail: partner.chargeback },
  ];

  return (
    <div className="bg-muted/30 border-t border-border px-4 py-3">
      {/* Header labels */}
      <div className="grid grid-cols-[80px_60px_1fr_60px_50px_50px_72px] items-center gap-2 mb-1">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
          Rate
        </span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
          Observed
        </span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
          Bayesian CI
        </span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
          P(elev)
        </span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
          Peer Z
        </span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
          Trend
        </span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
          8-wk
        </span>
      </div>

      {rateRows.map(
        (r) =>
          r.detail && (
            <RateDetailRow
              key={r.key}
              label={r.label}
              rateKey={r.key}
              detail={r.detail}
            />
          )
      )}

      {/* Model explanation */}
      <div className="mt-3 flex gap-3 text-[9px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-primary" />
          Posterior mean
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-primary/20" />
          95% credible interval
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-0.5 bg-muted-foreground/50" />
          Peer mean
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
          CUSUM alarm
        </div>
      </div>
    </div>
  );
}

// ── Main view ───────────────────────────────────────────────────────

export default function PartnerRiskView() {
  const [tierFilter, setTierFilter] = useState<string | undefined>(undefined);
  const { data, isLoading, error } = usePartnerRisk(tierFilter);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const partners = data?.partners ?? [];

  const filtered = search
    ? partners.filter((p) =>
        p.partner_id.toLowerCase().includes(search.toLowerCase())
      )
    : partners;

  const tierCounts = {
    elevated: partners.filter((p) => p.tier === "elevated").length,
    watch: partners.filter((p) => p.tier === "watch").length,
    normal: partners.filter((p) => p.tier === "normal").length,
  };

  // When using tier filter from API, counts come from the unfiltered total
  const allData = usePartnerRisk();
  const allPartners = allData.data?.partners ?? [];
  const globalCounts = {
    elevated: allPartners.filter((p) => p.tier === "elevated").length,
    watch: allPartners.filter((p) => p.tier === "watch").length,
    normal: allPartners.filter((p) => p.tier === "normal").length,
    total: allData.data?.total ?? 0,
  };

  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 bg-card border-b border-border/50">
        <h2 className="text-sm font-semibold text-foreground">
          Partner Risk Analysis
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          ML-powered risk assessment across {globalCounts.total} partners — Beta-Binomial + Peer Z-Score + Time-Series models
        </p>
      </div>

      {/* Summary cards */}
      <div className="px-4 pt-3 grid grid-cols-4 gap-2">
        {(["elevated", "watch", "normal"] as const).map((tier) => {
          const meta = tierMeta[tier];
          const count =
            tier === "elevated"
              ? globalCounts.elevated
              : tier === "watch"
                ? globalCounts.watch
                : globalCounts.normal;
          const isActive = tierFilter === tier;
          return (
            <button
              key={tier}
              onClick={() =>
                setTierFilter(isActive ? undefined : tier)
              }
              className={`bg-card border rounded-lg p-3 text-left transition-all cursor-pointer ${
                isActive ? meta.border + " border-2" : "border-border hover:border-border/80"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {meta.label}
                </span>
                <meta.icon className={`w-3.5 h-3.5 ${meta.text}`} />
              </div>
              <div className="text-lg font-bold text-foreground">{count}</div>
              <div className="text-[10px] text-muted-foreground">partners</div>
            </button>
          );
        })}
        <div className="bg-card border border-border rounded-lg p-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Coverage
          </div>
          <div className="text-lg font-bold text-foreground">
            {globalCounts.total}
          </div>
          <div className="text-[10px] text-muted-foreground">
            partners scored
          </div>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="px-4 pt-3 flex items-center gap-2">
        <input
          type="text"
          placeholder="Search partner ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 px-2 text-[11px] bg-card border border-border rounded-md w-56 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {tierFilter && (
          <button
            onClick={() => setTierFilter(undefined)}
            className="text-[10px] text-primary hover:underline"
          >
            Clear filter
          </button>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          Showing {filtered.length} of {data?.total ?? 0}
        </span>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="px-4 py-6 text-center text-xs text-muted-foreground animate-pulse">
          Loading partner risk scores...
        </div>
      )}
      {error && (
        <div className="px-4 py-4 text-xs text-destructive">
          ML service unavailable — start the Python service: <code className="bg-muted px-1 rounded">cd pulse && source ml/.venv/bin/activate && python3 -m uvicorn ml.api:app --port 8100</code>
        </div>
      )}

      {/* Partner table */}
      {!isLoading && !error && (
        <div className="px-4 pt-2 pb-4">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_80px_80px_80px_60px_60px] items-center gap-2 px-3 py-1.5 text-[9px] text-muted-foreground uppercase tracking-wider border-b border-border">
            <span>Partner</span>
            <span>Risk Score</span>
            <span>Decline</span>
            <span>Return</span>
            <span>Chargeback</span>
            <span>Paypoints</span>
            <span>Txns</span>
          </div>

          {/* Rows */}
          {filtered.map((p) => {
            const meta = tierMeta[p.tier];
            const isExpanded = expandedId === p.partner_id;
            return (
              <div
                key={p.partner_id}
                className={`border-b border-border/50 ${isExpanded ? "bg-card" : ""}`}
              >
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : p.partner_id)
                  }
                  className="w-full grid grid-cols-[1fr_100px_80px_80px_80px_60px_60px] items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-[11px] font-mono text-foreground truncate">
                      {p.partner_id || "(root)"}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1 flex-shrink-0 ${meta.bg} ${meta.text}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}
                      />
                      {meta.label}
                    </span>
                  </div>
                  <ScoreBar score={p.combined_score} tier={p.tier} />
                  <RateCell detail={p.decline} type="decline" />
                  <RateCell detail={p.returns} type="returns" />
                  <RateCell detail={p.chargeback} type="chargeback" />
                  <span className="text-[10px] text-muted-foreground text-right">
                    {p.n_paypoints}
                  </span>
                  <span className="text-[10px] text-muted-foreground text-right">
                    {p.total_txns >= 1000
                      ? `${(p.total_txns / 1000).toFixed(1)}K`
                      : p.total_txns}
                  </span>
                </button>
                {isExpanded && <PartnerDetail partner={p} />}
              </div>
            );
          })}

          {filtered.length === 0 && !isLoading && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No partners match the current filter.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Rate cell (inline in table row) ─────────────────────────────────

function RateCell({
  detail,
  type,
}: {
  detail: RateDetail | null;
  type: string;
}) {
  if (!detail)
    return <span className="text-[10px] text-muted-foreground">—</span>;

  const rate = detail.observed_rate;
  const isHot =
    (type === "decline" && rate > 0.18) ||
    (type === "returns" && rate > 0.014) ||
    (type === "chargeback" && rate > 0.0017);

  return (
    <span
      className={`text-[10px] font-mono ${
        isHot ? "text-destructive font-semibold" : "text-foreground"
      }`}
    >
      {type === "chargeback"
        ? (rate * 100).toFixed(3)
        : (rate * 100).toFixed(2)}
      %
    </span>
  );
}
