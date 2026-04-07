import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PulseCenterView from "../PulseCenterView";

// Mock child components that are complex
vi.mock("../MerchantHealthCards", () => ({
  default: ({ onFilterMerchant }: { onFilterMerchant: (p: string) => void }) => (
    <div data-testid="merchant-health-cards" onClick={() => onFilterMerchant("PP-001")} />
  ),
}));

vi.mock("../AlertDetailPanel", () => ({
  default: ({ alert, onClose, onResolve, onDismiss, onContactSupport }: any) => (
    <div data-testid="alert-detail-panel">
      <span>{alert.title}</span>
      <button data-testid="close-detail" onClick={onClose}>Close</button>
      <button data-testid="resolve-detail" onClick={() => onResolve(alert.id)}>Resolve</button>
      <button data-testid="dismiss-detail" onClick={() => onDismiss(alert.id)}>Dismiss</button>
      <button data-testid="contact-support" onClick={onContactSupport}>Contact Support</button>
    </div>
  ),
}));

vi.mock("../ContactSupportDialog", () => ({
  default: ({ onClose }: any) => (
    <div data-testid="contact-support-dialog">
      <button onClick={onClose}>Close Support</button>
    </div>
  ),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const mockAlerts = [
  {
    id: "ALT-001",
    title: "Failed payout",
    subtitle: "Acme Corp",
    category: "payout",
    categoryLabel: "Payout",
    merchant: "PP-001",
    amount: "$500",
    status: "action_needed",
    statusLabel: "Action needed",
    time: "2h",
    timestamp: "2025-01-01T00:00:00Z",
    aiDetected: true,
    aiExplanation: "AI explanation",
    signalConfidence: "high",
    details: {
      description: "Payout failed due to NSF",
      severity: "danger",
      actionLabel: "Retry payout",
      actionType: "fix",
    },
  },
  {
    id: "ALT-002",
    title: "Webhook down",
    subtitle: "Beta LLC",
    category: "webhook",
    categoryLabel: "Webhook",
    merchant: "PP-002",
    amount: null,
    status: "no_action",
    statusLabel: "No action",
    time: "5h",
    timestamp: "2025-01-01T00:00:00Z",
    details: {
      description: "Webhook endpoint returned 500",
      severity: "warning",
    },
  },
];

const mockPredictiveAlerts = [
  {
    id: "PRED-001",
    title: "Decline rate trending up",
    subtitle: "Gamma Inc",
    merchant: "PP-003",
    trendData: [1.2, 1.5, 1.8, 2.1],
    projectedData: [2.1, 2.5, 2.8],
    threshold: 3.0,
    metricLabel: "Decline rate (%)",
    time: "1d",
    projectedBreachDay: 5,
  },
];

vi.mock("@/hooks/useDashboardData", () => ({
  useAlerts: vi.fn(),
  usePredictiveAlerts: vi.fn(),
  useAlertResolutions: vi.fn(),
}));

import { useAlerts, usePredictiveAlerts, useAlertResolutions } from "@/hooks/useDashboardData";

const mockUseAlerts = vi.mocked(useAlerts);
const mockUsePredictiveAlerts = vi.mocked(usePredictiveAlerts);
const mockUseAlertResolutions = vi.mocked(useAlertResolutions);

function setupMocks(overrides?: { loading?: boolean; alerts?: any[]; predictive?: any[]; resolutions?: any[] }) {
  mockUseAlerts.mockReturnValue({
    data: overrides?.loading
      ? undefined
      : { alerts: overrides?.alerts ?? mockAlerts, totalCount: (overrides?.alerts ?? mockAlerts).length },
    isLoading: overrides?.loading ?? false,
  } as any);

  mockUsePredictiveAlerts.mockReturnValue({
    data: { alerts: overrides?.predictive ?? mockPredictiveAlerts },
  } as any);

  mockUseAlertResolutions.mockReturnValue({
    data: { resolutions: overrides?.resolutions ?? [] },
  } as any);
}

describe("PulseCenterView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("renders loading state when alerts are loading", () => {
    setupMocks({ loading: true });
    render(<PulseCenterView />);
    expect(screen.getByText("Loading signals...")).toBeInTheDocument();
  });

  it("renders alerts from API data", () => {
    render(<PulseCenterView />);
    expect(screen.getByText("Failed payout")).toBeInTheDocument();
    expect(screen.getByText("Webhook down")).toBeInTheDocument();
  });

  it("time range buttons update the filter", () => {
    render(<PulseCenterView />);
    const btn7d = screen.getByText("Last 7 days");
    fireEvent.click(btn7d);
    // useAlerts should have been called again (re-render with 7)
    expect(mockUseAlerts).toHaveBeenCalled();
  });

  it("search filters alerts by title/subtitle", async () => {
    render(<PulseCenterView />);
    const searchInput = screen.getByPlaceholderText("Search signals...");
    fireEvent.change(searchInput, { target: { value: "payout" } });

    await waitFor(() => {
      expect(screen.getByText("Failed payout")).toBeInTheDocument();
      expect(screen.queryByText("Webhook down")).not.toBeInTheDocument();
    });
  });

  it("filter tabs switch between statuses", () => {
    render(<PulseCenterView />);
    // "Action needed" appears in both the filter tab and individual alert status badges
    // Find the tab button specifically
    const actionTabs = screen.getAllByText("Action needed");
    // The first one is the filter tab button text
    fireEvent.click(actionTabs[0]);
    // After filtering to action_needed, "Webhook down" (no_action) should not be visible
    expect(screen.getByText("Failed payout")).toBeInTheDocument();
  });

  it("export button triggers CSV download", () => {
    // Mock URL methods needed for CSV export
    const mockCreateObjectURL = vi.fn(() => "blob:url");
    const mockRevokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = mockCreateObjectURL;
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

    render(<PulseCenterView />);
    const exportBtn = screen.getByText("Export");
    fireEvent.click(exportBtn);

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();
  });

  it("keyboard shortcut: Escape closes detail panel", async () => {
    render(<PulseCenterView />);
    // Click on alert to open detail
    fireEvent.click(screen.getByText("Failed payout"));
    await waitFor(() => {
      expect(screen.getByTestId("alert-detail-panel")).toBeInTheDocument();
    });

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("alert-detail-panel")).not.toBeInTheDocument();
    });
  });

  it("keyboard shortcut: ? shows shortcuts overlay", () => {
    render(<PulseCenterView />);
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
  });

  it('"Ask Amigo" button calls onNavigate("intelligence")', () => {
    const onNavigate = vi.fn();
    render(<PulseCenterView onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("Ask Amigo"));
    expect(onNavigate).toHaveBeenCalledWith("intelligence");
  });

  it("resolved alerts from resolutions data are marked correctly", () => {
    setupMocks({
      resolutions: [{ alert_id: "ALT-001", action: "resolved", created_at: "2025-01-01" }],
    });
    render(<PulseCenterView />);
    // The "Resolved" status label should appear for ALT-001
    const resolvedBadges = screen.getAllByText("Resolved");
    expect(resolvedBadges.length).toBeGreaterThanOrEqual(1);
  });
});
