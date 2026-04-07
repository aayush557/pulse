import { useState } from "react";
import { Sparkles, ChevronRight, X } from "lucide-react";
import { usePortfolioDigest } from "@/hooks/useDashboardData";
import type { PortfolioInsight } from "@/types/api";

const borderColors: Record<string, string> = {
  positive: "border-l-status-success",
  warning: "border-l-status-warning",
  info: "border-l-status-info",
};

const bgColors: Record<string, string> = {
  positive: "bg-status-success-bg",
  warning: "bg-status-warning-bg",
  info: "bg-status-info-bg",
};

function InsightRow({ insight }: { insight: PortfolioInsight }) {
  return (
    <div className={`border-l-[3px] ${borderColors[insight.type]} ${bgColors[insight.type]} rounded-r-md px-3 py-2 text-[11px] text-foreground leading-relaxed`}>
      {insight.text}
    </div>
  );
}

export default function PortfolioDigest() {
  const [showModal, setShowModal] = useState(false);
  const { data: digest, isLoading, error } = usePortfolioDigest();

  if (isLoading) {
    return (
      <div className="mx-4 mt-3 bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border/50 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-status-purple" />
          <h3 className="text-xs font-semibold text-foreground">Weekly Intelligence</h3>
        </div>
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">Generating weekly insights...</div>
      </div>
    );
  }

  if (error || !digest) {
    return (
      <div className="mx-4 mt-3 bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border/50 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-status-purple" />
          <h3 className="text-xs font-semibold text-foreground">Weekly Intelligence</h3>
        </div>
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">Unable to load insights right now.</div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-4 mt-3 bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-status-purple" />
            <div>
              <h3 className="text-xs font-semibold text-foreground">Weekly Intelligence — {digest?.weekLabel || "This Week"}</h3>
            </div>
          </div>
        </div>
        <div className="px-3 py-3 space-y-2">
          {(digest?.insights || []).map((insight, i) => (
            <InsightRow key={i} insight={insight} />
          ))}
        </div>
        <div className="px-3 pb-2.5 flex items-center justify-between">
          <button
            onClick={() => setShowModal(true)}
            className="text-[11px] text-primary font-medium flex items-center gap-1 hover:underline"
          >
            View full analysis <ChevronRight className="w-3 h-3" />
          </button>
          <span className="text-[9px] text-muted-foreground">Generated from your portfolio data · Updated every Monday at 8 AM</span>
        </div>
      </div>

      {/* Full analysis modal */}
      {showModal && (
        <div className="fixed inset-0 bg-foreground/30 z-50 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="bg-card border border-border rounded-lg w-[560px] max-h-[80vh] overflow-y-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between sticky top-0 bg-card z-10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-status-purple" />
                <h3 className="text-sm font-semibold text-foreground">Full Portfolio Analysis — {digest?.weekLabel || "This Week"}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Key Highlights</div>
              {(digest?.insights || []).map((insight, i) => (
                <InsightRow key={i} insight={insight} />
              ))}
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 mt-4 pt-3 border-t border-border/50">Additional Insights</div>
              {(digest?.expandedInsights || []).map((insight, i) => (
                <InsightRow key={i} insight={insight} />
              ))}
            </div>
            <div className="px-4 py-3 border-t border-border/50 text-[9px] text-muted-foreground">
              Generated from your portfolio data · Updated every Monday at 8 AM
            </div>
          </div>
        </div>
      )}
    </>
  );
}
