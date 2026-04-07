import { useState, useCallback } from "react";
import AppSidebar from "@/components/AppSidebar";
import TopBar from "@/components/TopBar";
import DashboardView from "@/components/DashboardView";
import PulseCenterView from "@/components/PulseCenterView";
import AmigoIntelligenceView from "@/components/AmigoIntelligenceView";
import PulseSettingsView from "@/components/PulseSettingsView";
import NotificationFailuresView from "@/components/NotificationFailuresView";
import { useAlerts } from "@/hooks/useDashboardData";

const viewBreadcrumbs: Record<string, { label: string; active?: boolean }[]> = {
  dashboard: [{ label: "Home" }, { label: "Dashboard", active: true }],
  pulse: [{ label: "Intelligence" }, { label: "Pulse center", active: true }],
  "pulse-settings": [{ label: "Intelligence" }, { label: "Pulse settings", active: true }],
  "notification-failures": [{ label: "Intelligence" }, { label: "Notifications", active: true }],
  intelligence: [{ label: "Intelligence" }, { label: "Amigo Intelligence", active: true }],
};

export default function Index() {
  const [activeView, setActiveView] = useState("dashboard");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const { data: alertsData } = useAlerts();
  const alertCount = alertsData?.alerts?.filter((a: any) => a.status === "action_needed").length ?? 0;

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
        <AppSidebar activeView={activeView} onNavigate={handleNavigate} alertCount={alertCount} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar breadcrumbs={breadcrumbs} alertCount={alertCount} onNavigate={handleNavigate} />
          <main className="flex-1 overflow-y-auto">
            {activeView === "dashboard" && (
              <DashboardView onNavigate={handleNavigate} onSelectAlert={handleSelectAlert} />
            )}
            {activeView === "pulse" && (
              <PulseCenterView initialSelectedAlert={selectedAlertId} onNavigate={handleNavigate} />
            )}
            {activeView === "intelligence" && <AmigoIntelligenceView />}
            {activeView === "pulse-settings" && <PulseSettingsView />}
            {activeView === "notification-failures" && <NotificationFailuresView />}
            {!["dashboard", "pulse", "pulse-settings", "notification-failures", "intelligence"].includes(activeView) && (
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
