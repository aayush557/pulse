import { ChevronRight } from "lucide-react";
import { useMerchantHealth } from "@/hooks/useDashboardData";
import type { MerchantHealthItem } from "@/types/api";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  onFilterMerchant: (paypoint: string) => void;
}

const tierStyles: Record<string, { bg: string; text: string; dot: string }> = {
  healthy: { bg: "bg-status-success-bg", text: "text-status-success-text", dot: "bg-status-success" },
  monitoring: { bg: "bg-status-warning-bg", text: "text-status-warning-text", dot: "bg-status-warning" },
  at_risk: { bg: "bg-status-danger-bg", text: "text-status-danger-text", dot: "bg-destructive" },
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 20;
  const w = 48;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function MerchantHealthCards({ onFilterMerchant }: Props) {
  const { data, isLoading } = useMerchantHealth();

  if (isLoading) {
    return (
      <div className="px-4 py-3">
        <h3 className="text-xs font-semibold text-foreground mb-2">Portfolio Health</h3>
        <span className="text-[10px] text-muted-foreground animate-pulse">Loading merchant health...</span>
      </div>
    );
  }

  const merchants = data?.merchants || [];

  // Sort: at_risk first, then monitoring, then healthy
  const sorted = [...merchants].sort((a, b) => {
    const order = { at_risk: 0, monitoring: 1, healthy: 2 };
    return order[a.healthTier] - order[b.healthTier];
  });

  if (sorted.length === 0) return null;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xs font-semibold text-foreground">Portfolio Health</h3>
          <p className="text-[10px] text-muted-foreground">Merchant health overview based on recent activity</p>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {sorted.map((m: MerchantHealthItem) => {
          const tier = tierStyles[m.healthTier];
          return (
            <div key={m.id} className="bg-card border border-border rounded-lg p-2.5 min-w-[185px] flex-shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <div className="text-[11px] font-semibold text-foreground">{m.name}</div>
                  <div className="text-[9px] text-muted-foreground">{m.paypoint}</div>
                </div>
                <Tooltip>
                  <TooltipTrigger>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1 ${tier.bg} ${tier.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tier.dot}`} />
                      {m.healthLabel}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[10px] max-w-[220px]">
                    Based on volume trends, decline patterns, and activity signals for this paypoint.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-[10px] text-muted-foreground mb-2 leading-snug">{m.insight}</div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex flex-col items-center gap-0.5">
                  <MiniSparkline data={m.volumeTrend} color="hsl(213, 94%, 56%)" />
                  <span className="text-[8px] text-muted-foreground">Volume</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <MiniSparkline data={m.declineTrend} color="hsl(38, 92%, 50%)" />
                  <span className="text-[8px] text-muted-foreground">Declines</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <MiniSparkline data={m.chargebackTrend} color="hsl(0, 84%, 60%)" />
                  <span className="text-[8px] text-muted-foreground">CBs</span>
                </div>
              </div>
              {m.alertCount > 0 && (
                <button
                  onClick={() => onFilterMerchant(m.paypoint)}
                  className="w-full flex items-center justify-center gap-1 py-1 rounded border border-border text-[10px] font-medium text-foreground hover:bg-muted/50 transition-colors"
                >
                  View {m.alertCount} alert{m.alertCount > 1 ? "s" : ""} <ChevronRight className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
