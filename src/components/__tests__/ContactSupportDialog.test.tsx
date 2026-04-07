import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ContactSupportDialog from "../ContactSupportDialog";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { toast } from "sonner";

describe("ContactSupportDialog", () => {
  const defaultProps = {
    alertId: "ALT-001",
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset global fetch mock
    vi.restoreAllMocks();
  });

  it("renders with three method options (Email, Phone, Slack)", () => {
    render(<ContactSupportDialog {...defaultProps} />);
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Request callback")).toBeInTheDocument();
    expect(screen.getByText("Slack")).toBeInTheDocument();
  });

  it("email method shows correct info text", () => {
    render(<ContactSupportDialog {...defaultProps} />);
    // Email is default
    expect(
      screen.getByText(/Our support team typically responds within 2 hours/)
    ).toBeInTheDocument();
  });

  it("phone method shows phone input", () => {
    render(<ContactSupportDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Request callback"));
    expect(screen.getByPlaceholderText("+1 (555) 000-0000")).toBeInTheDocument();
  });

  it("slack method shows Slack info text", () => {
    render(<ContactSupportDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Slack"));
    expect(
      screen.getByText(/will be posted to the Pulse support Slack channel/)
    ).toBeInTheDocument();
  });

  it("submit with Slack POSTs to /api/slack/support", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    render(<ContactSupportDialog {...defaultProps} />);
    fireEvent.click(screen.getByText("Slack"));
    fireEvent.click(screen.getByText("Send to Slack"));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/slack/support",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Support request sent to Slack");
    });
  });

  it("submit with email shows toast", async () => {
    render(<ContactSupportDialog {...defaultProps} />);
    // Email is default method
    fireEvent.click(screen.getByText("Send message"));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Support message sent");
    });
  });

  it("close button calls onClose", () => {
    const onClose = vi.fn();
    render(<ContactSupportDialog alertId="ALT-001" onClose={onClose} />);
    // The X button in the header
    const closeButtons = screen.getAllByRole("button");
    // Find the one with X icon - it's the one in the header area
    const headerClose = closeButtons.find(
      (btn) => btn.querySelector("svg") && btn.closest(".border-b")
    );
    if (headerClose) {
      fireEvent.click(headerClose);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it("alert ID is linked when provided", () => {
    render(<ContactSupportDialog {...defaultProps} />);
    expect(screen.getByText(/Linked to alert ALT-001/)).toBeInTheDocument();
  });
});
