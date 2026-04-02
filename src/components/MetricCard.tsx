interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  subtext?: string;
  historicalData?: number[];
  forecastData?: number[];
}

function Sparkline({ data, forecast, color }: { data: number[]; forecast?: number[]; color: string }) {
  const all = [...data, ...(forecast || [])];
  const max = Math.max(...all);
  const min = Math.min(...all);
  const range = max - min || 1;
  const h = 28;
  const w = 80;
  const totalPts = all.length;
  const toPoint = (v: number, i: number) =>
    `${(i / (totalPts - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`;

  const histPoints = data.map((v, i) => toPoint(v, i)).join(" ");
  const forecastStart = data.length > 0 ? toPoint(data[data.length - 1], data.length - 1) : "";
  const forecastPoints = forecast
    ? [forecastStart, ...forecast.map((v, i) => toPoint(v, data.length + i))].join(" ")
    : "";

  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={histPoints} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {forecast && forecastPoints && (
        <>
          <polyline points={forecastPoints} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2" opacity="0.45" />
          <text x={w - 1} y={8} textAnchor="end" fill={color} fontSize="6" opacity="0.6" fontWeight="500">forecast</text>
        </>
      )}
    </svg>
  );
}

export default function MetricCard({ label, value, change, positive = true, subtext, historicalData, forecastData }: MetricCardProps) {
  const chartColor = positive ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)";
  // Default bar data if no sparkline data provided
  const defaultBars = [40, 55, 45, 60, 50, 65];

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-lg font-bold text-foreground">{value}</div>
          {change && (
            <div className={`text-[10px] font-medium ${positive ? "text-status-success" : "text-destructive"}`}>
              {positive ? "↑" : "↓"} {change}
            </div>
          )}
        </div>
        {historicalData ? (
          <Sparkline data={historicalData} forecast={forecastData} color={chartColor} />
        ) : (
          <div className="flex items-end gap-[3px] h-[28px]">
            {defaultBars.map((h, i) => (
              <div key={i} className="w-[6px] rounded-sm bg-primary/20" style={{ height: `${h}%` }} />
            ))}
            {forecastData && (
              <>
                {[50, 55, 60].map((h, i) => (
                  <div key={`f-${i}`} className="w-[6px] rounded-sm bg-primary/10 border border-dashed border-primary/20" style={{ height: `${h}%` }} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
      {subtext && <div className="text-[10px] text-muted-foreground mt-0.5">{subtext}</div>}
    </div>
  );
}
