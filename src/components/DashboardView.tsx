import MetricCard from "./MetricCard";
import AlertBanner from "./AlertBanner";
import PortfolioDigest from "./PortfolioDigest";

interface DashboardViewProps {
  onNavigate: (view: string) => void;
  onSelectAlert: (id: string) => void;
}

export default function DashboardView({ onNavigate, onSelectAlert }: DashboardViewProps) {
  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-3 pb-2 bg-card border-b border-border/50">
        <h2 className="text-sm font-semibold text-foreground">Hello, Aayush Bhargava!</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Here you can review the health of your payment business.</p>
      </div>

      {/* Time range */}
      <div className="flex justify-end px-4 py-2">
        <div className="border border-border rounded-md px-3 py-1 text-[11px] text-foreground bg-card flex items-center gap-2">
          <span className="text-muted-foreground">Time Range</span>
          <span className="font-medium">Month to Date</span>
          <span className="text-muted-foreground">Apr 01 – Apr 02, 2026</span>
        </div>
      </div>

      {/* Alert banner */}
      <AlertBanner onNavigate={onNavigate} onSelectAlert={onSelectAlert} />

      {/* Portfolio Intelligence Digest */}
      <PortfolioDigest />

      {/* Pay In metrics */}
      <div className="px-4 mt-4">
        <div className="text-xs font-semibold text-foreground mb-2">Pay In</div>
        <div className="grid grid-cols-4 gap-2">
          <MetricCard
            label="Transaction Volume" value="$98,389,126" change="20.33%" subtext="Last period $81,766,845"
            historicalData={[72, 78, 81, 85, 88, 94, 98].map(v => v * 1_000_000)}
            forecastData={[102, 105.5, 108.2].map(v => v * 1_000_000)}
          />
          <MetricCard
            label="Transaction Count" value="348,382" change="11.76%" subtext="Last period 311,716"
            historicalData={[290, 305, 312, 320, 330, 340, 348].map(v => v * 1000)}
            forecastData={[355, 362, 370].map(v => v * 1000)}
          />
          <MetricCard
            label="Customers" value="4,134,553" change="4.55%" subtext="Last period 3,954,436"
            historicalData={[3800, 3850, 3900, 3954, 4000, 4070, 4135].map(v => v * 1000)}
            forecastData={[4180, 4220, 4260].map(v => v * 1000)}
          />
          <MetricCard
            label="New Customers" value="16,952" change="2.8%" subtext="Last period 16,488"
            historicalData={[15200, 15800, 16100, 16488, 16600, 16780, 16952]}
            forecastData={[17200, 17500, 17800]}
          />
        </div>
      </div>

      {/* Pay Out metrics */}
      <div className="px-4 mt-4 pb-4">
        <div className="text-xs font-semibold text-foreground mb-2">Pay Out</div>
        <div className="grid grid-cols-4 gap-2">
          <MetricCard
            label="Transaction Volume" value="$2,993,041" change="69.67%" subtext="Last period $1,764,075"
            historicalData={[1200, 1500, 1764, 2100, 2400, 2700, 2993].map(v => v * 1000)}
            forecastData={[3100, 3250, 3380].map(v => v * 1000)}
          />
          <MetricCard
            label="Transaction Count" value="744" change="33.81%" subtext="Last period 556"
            historicalData={[420, 480, 556, 600, 650, 700, 744]}
            forecastData={[780, 810, 845]}
          />
          <MetricCard
            label="Vendors" value="31,496" change="7.13%" subtext="Last period 29,400"
            historicalData={[27500, 28200, 29400, 30000, 30600, 31100, 31496]}
            forecastData={[32200, 32900, 33600]}
          />
          <MetricCard
            label="New Vendors" value="135" change="150%" subtext="Last period 54"
            historicalData={[32, 38, 54, 72, 90, 112, 135]}
            forecastData={[142, 150, 158]}
          />
        </div>
      </div>
    </div>
  );
}
