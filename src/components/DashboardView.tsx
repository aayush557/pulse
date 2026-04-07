import MetricCard from "./MetricCard";
import AlertBanner from "./AlertBanner";
import MerchantHealthCards from "./MerchantHealthCards";
import { useMetricsSummary, useAlerts } from "@/hooks/useDashboardData";
import type { MetricValue } from "@/types/api";

interface DashboardViewProps {
  onNavigate: (view: string) => void;
  onSelectAlert: (id: string) => void;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return n.toLocaleString();
  return String(n);
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function MetricCardFromData({
  label,
  metric,
  isCurrency,
}: {
  label: string;
  metric: MetricValue;
  isCurrency?: boolean;
}) {
  const value = isCurrency ? formatCurrency(metric.current) : formatNumber(metric.current);
  const prev = isCurrency ? formatCurrency(metric.previous) : formatNumber(metric.previous);
  const change = `${Math.abs(metric.changePercent).toFixed(2)}%`;
  const positive = metric.changePercent >= 0;

  return (
    <MetricCard
      label={label}
      value={value}
      change={change}
      positive={positive}
      subtext={`Last period ${prev}`}
      historicalData={metric.trend.length > 0 ? metric.trend : undefined}
      forecastData={metric.forecast.length > 0 ? metric.forecast : undefined}
    />
  );
}

export default function DashboardView({ onNavigate, onSelectAlert }: DashboardViewProps) {
  const { data, isLoading, error } = useMetricsSummary();
  const { data: alertsData } = useAlerts();

  const periodLabel = data
    ? `${new Date(data.period.start).toLocaleDateString("en-US", { month: "short", day: "2-digit" })} – ${new Date(data.period.end).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}`
    : "";

  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 bg-card border-b border-border/50 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Dashboard</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Portfolio performance overview</p>
        </div>
        <div className="border border-border rounded-md px-3 py-1 text-[11px] text-foreground bg-card flex items-center gap-2">
          <span className="font-medium">{data?.period.label || "Month to Date"}</span>
          {periodLabel && <span className="text-muted-foreground">{periodLabel}</span>}
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="px-4 py-6 text-center">
          <div className="text-xs text-muted-foreground animate-pulse">Loading metrics...</div>
        </div>
      )}
      {error && (
        <div className="px-4 py-4">
          <div className="text-xs text-destructive">Failed to load metrics: {(error as Error).message}</div>
        </div>
      )}

      {/* Metrics */}
      {data && (
        <>
          <div className="px-4 pt-4">
            <div className="text-xs font-semibold text-foreground mb-2">Pay In</div>
            <div className="grid grid-cols-4 gap-2">
              <MetricCardFromData label="Transaction Volume" metric={data.payIn.transactionVolume} isCurrency />
              <MetricCardFromData label="Transaction Count" metric={data.payIn.transactionCount} />
              <MetricCardFromData label="Customers" metric={data.payIn.customers} />
              <MetricCardFromData label="New Customers" metric={data.payIn.newCustomers} />
            </div>
          </div>

          <div className="px-4 mt-3">
            <div className="text-xs font-semibold text-foreground mb-2">Pay Out</div>
            <div className="grid grid-cols-4 gap-2">
              <MetricCardFromData label="Transaction Volume" metric={data.payOut.transactionVolume} isCurrency />
              <MetricCardFromData label="Transaction Count" metric={data.payOut.transactionCount} />
              <MetricCardFromData label="Vendors" metric={data.payOut.vendors} />
              <MetricCardFromData label="New Vendors" metric={data.payOut.newVendors} />
            </div>
          </div>
        </>
      )}

      {/* Alerts */}
      <div className="mt-4">
        <AlertBanner onNavigate={onNavigate} onSelectAlert={onSelectAlert} />
      </div>

      {/* Quick alert summary */}
      <div className="mx-4 mt-2 flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-muted-foreground">
            Active signals: <span className="font-semibold text-foreground">{alertsData?.totalCount ?? 0}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Action needed: <span className="font-semibold text-destructive">{alertsData?.alerts?.filter(a => a.status === "action_needed").length ?? 0}</span>
          </div>
        </div>
        <button
          onClick={() => onNavigate("pulse")}
          className="text-[10px] text-primary font-medium hover:underline"
        >
          View all signals →
        </button>
      </div>

      {/* Merchant Health */}
      <div className="mt-1 pb-4">
        <MerchantHealthCards onFilterMerchant={(paypoint) => {
          onSelectAlert(paypoint);
          onNavigate("pulse");
        }} />
      </div>
    </div>
  );
}
