import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AlertDetailPanel from "../AlertDetailPanel";
import type { Alert } from "@/data/alertsData";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

// Mock recharts to avoid rendering issues in test
vi.mock("recharts", () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  ReferenceLine: () => <div />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
  ComposedChart: ({ children }: any) => <div data-testid="composed-chart">{children}</div>,
}));

// Mock tooltip from ui
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children, className }: any) => <span className={className}>{children}</span>,
}));

const mockActionMutate = vi.fn();
const mockInsightMutate = vi.fn();

vi.mock("@/hooks/useDashboardData", () => ({
  useAlertAction: vi.fn(() => ({
    mutate: mockActionMutate,
    isPending: false,
  })),
  useResolutionInsight: vi.fn(() => ({
    mutate: mockInsightMutate,
    isPending: false,
  })),
}));

import { toast } from "sonner";

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
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
    timestamp: new Date(),
    details: {
      description: "ACH payout returned due to NSF",
      severity: "danger",
      actionLabel: "Retry payout",
      actionType: "fix",
      metadata: {
        "Payout ID": "PO-1234",
        "Amount": "$500.00",
      },
    },
    ...overrides,
  };
}

describe("AlertDetailPanel", () => {
  const defaultProps = {
    onClose: vi.fn(),
    onResolve: vi.fn(),
    onDismiss: vi.fn(),
    onContactSupport: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockActionMutate.mockReset();
    mockInsightMutate.mockReset();
  });

  it("renders alert details (metadata, description, severity)", () => {
    render(<AlertDetailPanel alert={makeAlert()} {...defaultProps} />);
    expect(screen.getByText("ALT-001")).toBeInTheDocument();
    expect(screen.getByText(/Failed payout/)).toBeInTheDocument();
    expect(screen.getByText("ACH payout returned due to NSF")).toBeInTheDocument();
    expect(screen.getByText("Payout ID")).toBeInTheDocument();
    expect(screen.getByText("PO-1234")).toBeInTheDocument();
  });

  it("shows AI detected badge when alert.aiDetected is true", () => {
    render(
      <AlertDetailPanel
        alert={makeAlert({ aiDetected: true })}
        {...defaultProps}
      />
    );
    expect(screen.getByText("AI detected")).toBeInTheDocument();
  });

  it("action button starts the action flow", () => {
    render(<AlertDetailPanel alert={makeAlert()} {...defaultProps} />);
    fireEvent.click(screen.getByText("Retry payout"));
    // Should move to action step - "Confirm & retry payout" button should appear
    expect(screen.getByText(/Confirm & retry payout/)).toBeInTheDocument();
  });

  it("resolve button calls onResolve", () => {
    const onResolve = vi.fn();
    render(
      <AlertDetailPanel
        alert={makeAlert()}
        {...defaultProps}
        onResolve={onResolve}
      />
    );
    fireEvent.click(screen.getByText("Mark as resolved"));
    expect(onResolve).toHaveBeenCalledWith("ALT-001");
  });

  it("dismiss flow shows confirmation dialog", () => {
    render(<AlertDetailPanel alert={makeAlert()} {...defaultProps} />);
    // There should be a "Dismiss" button
    const dismissBtn = screen.getByText("Dismiss");
    fireEvent.click(dismissBtn);
    // Confirmation dialog should appear
    expect(screen.getByText(/Dismiss "Failed payout"/)).toBeInTheDocument();
    expect(screen.getByText("Yes, dismiss alert")).toBeInTheDocument();
  });

  it("contact support button calls onContactSupport", () => {
    const onContactSupport = vi.fn();
    render(
      <AlertDetailPanel
        alert={makeAlert()}
        {...defaultProps}
        onContactSupport={onContactSupport}
      />
    );
    const supportBtns = screen.getAllByRole("button");
    const supportBtn = supportBtns.find((btn) => btn.textContent?.includes("Contact"));
    if (supportBtn) {
      fireEvent.click(supportBtn);
      expect(onContactSupport).toHaveBeenCalled();
    }
  });

  it("predictive alert shows trend chart", () => {
    const predictiveAlert = makeAlert({
      status: "watch",
      statusLabel: "Watch",
      trendData: [1.2, 1.5, 1.8, 2.1],
      projectedData: [2.1, 2.5, 2.8],
      threshold: 3.0,
      metricLabel: "Decline rate (%)",
      details: {
        description: "Decline rate trending up",
        severity: "warning",
      },
    });
    render(
      <AlertDetailPanel alert={predictiveAlert} {...defaultProps} />
    );
    // The composed chart mock should be rendered
    expect(screen.getByTestId("composed-chart")).toBeInTheDocument();
  });

  it("success screen shows resolution insight", async () => {
    mockActionMutate.mockImplementation((_data: any, opts: any) => {
      opts?.onSuccess?.({ success: true });
    });
    mockInsightMutate.mockImplementation((_data: any, opts: any) => {
      opts?.onSuccess?.({ insight: "This merchant has had repeated issues." });
    });

    render(<AlertDetailPanel alert={makeAlert()} {...defaultProps} />);

    // Go to action step
    fireEvent.click(screen.getByText("Retry payout"));
    // Execute the action
    fireEvent.click(screen.getByText(/Confirm & retry payout/));

    await waitFor(() => {
      expect(screen.getByText("Payout retry initiated")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("This merchant has had repeated issues.")).toBeInTheDocument();
    });
  });

  it("webhook test triggers the test_webhook action", () => {
    const webhookAlert = makeAlert({
      id: "ALT-WH-001",
      title: "Webhook failures",
      subtitle: "api.partner.com/hooks",
      category: "webhook",
      categoryLabel: "Webhook",
      details: {
        description: "Webhook endpoint returning 500 errors",
        severity: "warning",
        actionLabel: "Fix endpoint",
        actionType: "endpoint",
        metadata: {
          Endpoint: "https://api.partner.com/hooks",
        },
      },
    });

    render(<AlertDetailPanel alert={webhookAlert} {...defaultProps} />);
    // Go to action step
    fireEvent.click(screen.getByText("Fix endpoint"));

    // Find and click "Send test ping" button
    const testBtn = screen.getByText(/Send test ping/i);
    fireEvent.click(testBtn);

    expect(mockActionMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        alertId: "ALT-WH-001",
        actionType: "test_webhook",
      }),
      expect.any(Object)
    );
  });
});
