import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PortfolioDigest from "../PortfolioDigest";

vi.mock("@/hooks/useDashboardData", () => ({
  usePortfolioDigest: vi.fn(),
}));

import { usePortfolioDigest } from "@/hooks/useDashboardData";

const mockDigestData = {
  weekLabel: "Apr 1 – Apr 7",
  insights: [
    { type: "positive" as const, text: "Pay-in volume increased 12% vs. prior week" },
    { type: "warning" as const, text: "Decline rate trending upward for 3 merchants" },
  ],
  expandedInsights: [
    { type: "info" as const, text: "New merchant onboarded: Delta Corp" },
  ],
  fromCache: false,
  generatedAt: "2025-04-07T08:00:00Z",
};

describe("PortfolioDigest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    vi.mocked(usePortfolioDigest).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<PortfolioDigest />);
    expect(screen.getByText("Generating weekly insights...")).toBeInTheDocument();
  });

  it("shows error state", () => {
    vi.mocked(usePortfolioDigest).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed"),
    } as any);

    render(<PortfolioDigest />);
    expect(
      screen.getByText("Unable to load insights right now.")
    ).toBeInTheDocument();
  });

  it("renders weekly insights correctly", () => {
    vi.mocked(usePortfolioDigest).mockReturnValue({
      data: mockDigestData,
      isLoading: false,
      error: null,
    } as any);

    render(<PortfolioDigest />);
    expect(
      screen.getByText("Pay-in volume increased 12% vs. prior week")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Decline rate trending upward for 3 merchants")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Apr 1/)
    ).toBeInTheDocument();
  });

  it('"View full analysis" opens modal', () => {
    vi.mocked(usePortfolioDigest).mockReturnValue({
      data: mockDigestData,
      isLoading: false,
      error: null,
    } as any);

    render(<PortfolioDigest />);
    fireEvent.click(screen.getByText(/View full analysis/));
    expect(screen.getByText(/Full Portfolio Analysis/)).toBeInTheDocument();
  });

  it("modal shows expanded insights", () => {
    vi.mocked(usePortfolioDigest).mockReturnValue({
      data: mockDigestData,
      isLoading: false,
      error: null,
    } as any);

    render(<PortfolioDigest />);
    fireEvent.click(screen.getByText(/View full analysis/));
    expect(
      screen.getByText("New merchant onboarded: Delta Corp")
    ).toBeInTheDocument();
  });

  it("modal closes on backdrop click", async () => {
    vi.mocked(usePortfolioDigest).mockReturnValue({
      data: mockDigestData,
      isLoading: false,
      error: null,
    } as any);

    render(<PortfolioDigest />);
    fireEvent.click(screen.getByText(/View full analysis/));
    expect(screen.getByText(/Full Portfolio Analysis/)).toBeInTheDocument();

    // Click on the backdrop (the fixed overlay)
    const backdrop = screen.getByText(/Full Portfolio Analysis/).closest(".fixed");
    if (backdrop) {
      fireEvent.click(backdrop);
      await waitFor(() => {
        expect(screen.queryByText(/Full Portfolio Analysis/)).not.toBeInTheDocument();
      });
    }
  });
});
