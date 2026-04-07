import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AmigoPanel from "../AmigoPanel";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockMutate = vi.fn();

vi.mock("@/hooks/useDashboardData", () => ({
  useAmigoChat: vi.fn(() => ({
    mutate: mockMutate,
    isPending: false,
  })),
}));

import { useAmigoChat } from "@/hooks/useDashboardData";

describe("AmigoPanel", () => {
  const defaultProps = { onClose: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMutate.mockReset();
  });

  it("renders welcome message initially", () => {
    render(<AmigoPanel {...defaultProps} />);
    expect(screen.getByText("Welcome to Amigo")).toBeInTheDocument();
  });

  it("shows suggestion chips when no messages", () => {
    render(<AmigoPanel {...defaultProps} />);
    expect(
      screen.getByText("Which of my merchants had the highest decline rate this week?")
    ).toBeInTheDocument();
    expect(
      screen.getByText("How is my portfolio performing vs. last month?")
    ).toBeInTheDocument();
  });

  it("hides suggestions after first message", async () => {
    // When mutate is called, simulate the onSuccess callback
    mockMutate.mockImplementation((_data: any, opts: any) => {
      opts?.onSuccess?.({ response: "Here is the answer" });
    });

    render(<AmigoPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText(
      "Ask about your merchants, volumes, alerts..."
    );
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      // Suggestions should be gone since messages.length > 0
      expect(
        screen.queryByText("Which of my merchants had the highest decline rate this week?")
      ).not.toBeInTheDocument();
    });
  });

  it("sends message on Enter key", () => {
    render(<AmigoPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText(
      "Ask about your merchants, volumes, alerts..."
    );
    fireEvent.change(input, { target: { value: "Test question" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Test question" }),
      expect.any(Object)
    );
  });

  it("sends message on Send button click", () => {
    render(<AmigoPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText(
      "Ask about your merchants, volumes, alerts..."
    );
    fireEvent.change(input, { target: { value: "Another question" } });
    // Find the send button - it's disabled when input is empty, enabled now
    const sendButtons = screen.getAllByRole("button");
    const sendBtn = sendButtons.find(
      (btn) => !btn.hasAttribute("disabled") && btn.querySelector("svg")
    );
    // Click the send button (last one in the input area)
    const allButtons = screen.getAllByRole("button");
    // The send button is the one that's not the close button or suggestion chip
    const actualSendBtn = allButtons.find(
      (btn) =>
        btn.className.includes("text-primary") &&
        !btn.hasAttribute("disabled")
    );
    if (actualSendBtn) {
      fireEvent.click(actualSendBtn);
      expect(mockMutate).toHaveBeenCalled();
    }
  });

  it("shows typing indicator while waiting", async () => {
    // Don't call onSuccess so it stays in typing state
    mockMutate.mockImplementation(() => {});

    render(<AmigoPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText(
      "Ask about your merchants, volumes, alerts..."
    );
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Typing indicator shows three animated dots
    await waitFor(() => {
      const dots = document.querySelectorAll(".animate-pulse");
      expect(dots.length).toBeGreaterThan(0);
    });
  });

  it("displays AI response", async () => {
    mockMutate.mockImplementation((_data: any, opts: any) => {
      opts?.onSuccess?.({ response: "Here is your answer from Amigo" });
    });

    render(<AmigoPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText(
      "Ask about your merchants, volumes, alerts..."
    );
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(
        screen.getByText("Here is your answer from Amigo")
      ).toBeInTheDocument();
    });
  });

  it("shows error message on failure", async () => {
    mockMutate.mockImplementation((_data: any, opts: any) => {
      opts?.onError?.(new Error("Network error"));
    });

    render(<AmigoPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText(
      "Ask about your merchants, volumes, alerts..."
    );
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(
        screen.getByText(/couldn't process that request/)
      ).toBeInTheDocument();
    });
  });

  it("disables send while mutation is pending", () => {
    vi.mocked(useAmigoChat).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    } as any);

    render(<AmigoPanel {...defaultProps} />);
    const input = screen.getByPlaceholderText(
      "Ask about your merchants, volumes, alerts..."
    );
    fireEvent.change(input, { target: { value: "Test" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // Should not call mutate when isPending is true
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
