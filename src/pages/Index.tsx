import { useState, useCallback } from "react";
import AppSidebar from "@/components/AppSidebar";
import TopBar from "@/components/TopBar";
import DashboardView from "@/components/DashboardView";
import PulseCenterView from "@/components/PulseCenterView";
import PulseSettingsView from "@/components/PulseSettingsView";

const viewBreadcrumbs: Record<string, { label: string; active?: boolean }[]> = {
  dashboard: [{ label: "Home" }, { label: "Dashboard", active: true }],
  pulse: [{ label: "Intelligence" }, { label: "Pulse center", active: true }],
  "pulse-settings": [{ label: "Intelligence" }, { label: "Pulse settings", active: true }],
};

export default function Index() {
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  const handleNavigate = useCallback((view: string) => {
    setActiveView(view);
    if (view !== "pulse") setSelectedAlertId(null);
  }, []);

  const handleSelectAlert = useCallback((id: string) => {
    setSelectedAlertId(id);
    setActiveView("pulse");
  }, []);

  const breadcrumbs = viewBreadcrumbs[activeView] || [{ label: activeView, active: true }];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-[1280px] mx-auto flex min-h-[760px] border border-border rounded-xl bg-muted/30">
        <AppSidebar activeView={activeView} onNavigate={handleNavigate} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar breadcrumbs={breadcrumbs} />
          <main className="flex-1 overflow-y-auto">
            {activeView === "dashboard" && (
              <DashboardView onNavigate={handleNavigate} onSelectAlert={handleSelectAlert} />
            )}
            {activeView === "pulse" && (
              <PulseCenterView initialSelectedAlert={selectedAlertId} />
            )}
            {activeView === "pulse-settings" && <PulseSettingsView />}
            {!["dashboard", "pulse", "pulse-settings"].includes(activeView) && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                <div className="text-center">
                  <div className="text-lg font-semibold text-foreground mb-1">{activeView.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</div>
                  <p className="text-xs">This section is under development.</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
