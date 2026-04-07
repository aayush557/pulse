import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AppSidebar from "../AppSidebar";

describe("AppSidebar", () => {
  const defaultProps = {
    activeView: "dashboard",
    onNavigate: vi.fn(),
    alertCount: 0,
  };

  it("renders all nav items", () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Amigo Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Pulse center")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Pulse settings")).toBeInTheDocument();
  });

  it("highlights active view", () => {
    render(<AppSidebar {...defaultProps} activeView="pulse" />);
    const pulseButton = screen.getByText("Pulse center").closest("button")!;
    expect(pulseButton.className).toContain("bg-sidebar-accent");
  });

  it("shows dynamic alert count badge on Pulse center when alertCount > 0", () => {
    render(<AppSidebar {...defaultProps} alertCount={7} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("hides badge when alertCount is 0", () => {
    render(<AppSidebar {...defaultProps} alertCount={0} />);
    // The badge should not render when alertCount is 0
    const pulseButton = screen.getByText("Pulse center").closest("button")!;
    // No extra badge span with a number
    expect(pulseButton.querySelector(".rounded-full")).toBeNull();
  });

  it("click navigates to correct view", () => {
    const onNavigate = vi.fn();
    render(<AppSidebar {...defaultProps} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText("Pulse center"));
    expect(onNavigate).toHaveBeenCalledWith("pulse");

    fireEvent.click(screen.getByText("Amigo Intelligence"));
    expect(onNavigate).toHaveBeenCalledWith("intelligence");
  });

  it('"Amigo Intelligence" nav item exists', () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByText("Amigo Intelligence")).toBeInTheDocument();
  });
});
