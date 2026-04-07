import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import TopBar from "../TopBar";

describe("TopBar", () => {
  it("renders breadcrumbs correctly", () => {
    render(
      <TopBar
        breadcrumbs={[
          { label: "Home" },
          { label: "Pulse center", active: true },
        ]}
      />
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Pulse center")).toBeInTheDocument();
    // separator rendered between items
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  it("shows alert count badge when alertCount > 0", () => {
    render(<TopBar breadcrumbs={[{ label: "Home" }]} alertCount={5} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("hides badge when alertCount is 0", () => {
    render(<TopBar breadcrumbs={[{ label: "Home" }]} alertCount={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it('shows "9+" when count > 9', () => {
    render(<TopBar breadcrumbs={[{ label: "Home" }]} alertCount={12} />);
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it('bell click calls onNavigate with "intelligence"', () => {
    const onNavigate = vi.fn();
    render(
      <TopBar
        breadcrumbs={[{ label: "Home" }]}
        alertCount={3}
        onNavigate={onNavigate}
      />
    );
    // The bell button contains the alert count badge; find the button wrapping it
    const bellButton = screen.getByText("3").closest("button")!;
    fireEvent.click(bellButton);
    expect(onNavigate).toHaveBeenCalledWith("intelligence");
  });

  it("bell click does nothing when onNavigate is undefined", () => {
    // Should not throw
    render(<TopBar breadcrumbs={[{ label: "Home" }]} alertCount={3} />);
    const bellButton = screen.getByText("3").closest("button")!;
    expect(() => fireEvent.click(bellButton)).not.toThrow();
  });
});
