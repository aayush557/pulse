import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AmigoIntelligenceView from "../AmigoIntelligenceView";

// Mock child components
vi.mock("../PortfolioDigest", () => ({
  default: () => <div data-testid="portfolio-digest">Portfolio Digest</div>,
}));

vi.mock("../AmigoPanel", () => ({
  default: ({ onClose }: any) => (
    <div data-testid="amigo-panel">Amigo Panel</div>
  ),
}));

vi.mock("@/hooks/useDashboardData", () => ({
  usePredictiveAlerts: vi.fn(),
  useAlerts: vi.fn(),
}));

import { usePredictiveAlerts, useAlerts } from "@/hooks/useDashboardData";

describe("AmigoIntelligenceView", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAlerts).mockReturnValue({
      data: {
        alerts: [
          { status: "action_needed", id: "1", title: "", subtitle: "", category: "payout", categoryLabel: "", merchant: "", amount: null, statusLabel: "", time: "", timestamp: "", details: { description: "", severity: "info" } },
          { status: "action_needed", id: "2", title: "", subtitle: "", category: "payout", categoryLabel: "", merchant: "", amount: null, statusLabel: "", time: "", timestamp: "", details: { description: "", severity: "info" } },
          { status: "no_action", id: "3", title: "", subtitle: "", category: "payout", categoryLabel: "", merchant: "", amount: null, statusLabel: "", time: "", timestamp: "", details: { description: "", severity: "info" } },
        ],
        totalCount: 15,
      },
    } as any);

    vi.mocked(usePredictiveAlerts).mockReturnValue({
      data: {
        alerts: [
          { id: "P1", title: "Decline up", subtitle: "Merchant A", merchant: "M1", trendData: [1, 2, 3], projectedData: [3, 4], threshold: 5, metricLabel: "Rate", time: "1d", projectedBreachDay: 3 },
          { id: "P2", title: "Chargeback up", subtitle: "Merchant B", merchant: "M2", trendData: [2, 3, 4], projectedData: [4, 5], threshold: 6, metricLabel: "Rate", time: "2d", projectedBreachDay: 4 },
        ],
      },
    } as any);
  });

  it("renders stats cards (active signals, action required, predictive)", () => {
    render(<AmigoIntelligenceView />);
    expect(screen.getByText("Active signals")).toBeInTheDocument();
    expect(screen.getByText("Action required")).toBeInTheDocument();
    expect(screen.getByText("Predictive signals")).toBeInTheDocument();
  });

  it("renders PortfolioDigest", () => {
    render(<AmigoIntelligenceView />);
    expect(screen.getByTestId("portfolio-digest")).toBeInTheDocument();
  });

  it("renders AmigoPanel", () => {
    render(<AmigoIntelligenceView />);
    expect(screen.getByTestId("amigo-panel")).toBeInTheDocument();
  });

  it("shows predictive alerts summary when data available", () => {
    render(<AmigoIntelligenceView />);
    expect(screen.getByText("Predictive Signals")).toBeInTheDocument();
    expect(screen.getByText("Merchant A")).toBeInTheDocument();
    expect(screen.getByText("Merchant B")).toBeInTheDocument();
  });

  it("shows correct counts from API data", () => {
    render(<AmigoIntelligenceView />);
    // totalCount = 15 for active signals
    expect(screen.getByText("15")).toBeInTheDocument();
    // actionCount = 2 and predictiveCount = 2, both appear as "2"
    // They show up in stats cards and also in the predictive signals badge
    const twos = screen.getAllByText("2");
    // At least 2: one for action required card, one for predictive card
    expect(twos.length).toBeGreaterThanOrEqual(2);
  });
});
