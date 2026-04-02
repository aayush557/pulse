import { useState } from "react";
import {
  LayoutDashboard, Briefcase, ArrowDownToLine, FileText, Users,
  ArrowUpFromLine, Store, Settings, Code2, Brain, Activity,
  Zap, ChevronDown, ChevronRight, HelpCircle, CreditCard
} from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  badge?: number;
  children?: { label: string; path: string }[];
}

const navSections: { title: string; isPulse?: boolean; items: NavItem[] }[] = [
  {
    title: "",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "dashboard" },
      {
        label: "Portfolio", icon: Briefcase,
        children: [
          { label: "All merchants", path: "portfolio" },
          { label: "Onboarding", path: "onboarding" },
        ],
      },
    ],
  },
  {
    title: "Pay In",
    items: [
      { label: "Reports", icon: FileText, children: [{ label: "Transactions", path: "payin-transactions" }, { label: "Settlements", path: "payin-settlements" }] },
      { label: "Customers", icon: Users, path: "customers" },
    ],
  },
  {
    title: "Pay Out",
    items: [
      { label: "Reports", icon: FileText, children: [{ label: "Payouts", path: "payout-reports" }] },
      { label: "Vendors", icon: Store, path: "vendors" },
    ],
  },
  {
    title: "Pay Ops",
    items: [
      { label: "Billing Center", icon: CreditCard, path: "billing" },
      { label: "Risk Center", icon: Settings, path: "risk" },
      { label: "Developers", icon: Code2, path: "developers" },
    ],
  },
  {
    title: "Intelligence",
    isPulse: true,
    items: [
      { label: "Pulse center", icon: Activity, path: "pulse", badge: 3 },
      { label: "Pulse settings", icon: Settings, path: "pulse-settings" },
    ],
  },
];

interface AppSidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export default function AppSidebar({ activeView, onNavigate }: AppSidebarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  return (
    <aside className="w-[182px] flex-shrink-0 bg-card border-r border-border rounded-l-xl flex flex-col">
      {/* Logo */}
      <div className="px-3 py-3 flex items-center gap-2 border-b border-border/50">
        <div className="w-7 h-7 payabli-gradient rounded-lg flex items-center justify-center text-primary-foreground font-bold text-xs">P</div>
        <span className="text-sm font-semibold text-foreground">Payabli</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-1 overflow-y-auto">
        {navSections.map((section, si) => (
          <div key={si}>
            {section.title && (
              <div className={`px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider ${section.isPulse ? "text-payabli-cyan" : "text-muted-foreground"}`}>
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const isExpanded = expandedGroups.has(item.label);
              const isActive = item.path === activeView || item.children?.some((c) => c.path === activeView);

              if (item.children) {
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => toggleGroup(item.label)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-muted/50 transition-colors ${isActive ? "text-primary font-medium" : "text-muted-foreground"}`}
                    >
                      <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{item.label}</span>
                      {isExpanded ? <ChevronDown className="ml-auto w-3 h-3 opacity-40" /> : <ChevronRight className="ml-auto w-3 h-3 opacity-40" />}
                    </button>
                    {isExpanded && item.children.map((child) => (
                      <button
                        key={child.path}
                        onClick={() => onNavigate(child.path)}
                        className={`w-full text-left pl-9 pr-3 py-1.5 text-[11px] cursor-pointer hover:bg-muted/50 transition-colors ${activeView === child.path ? "text-primary font-medium bg-sidebar-accent" : "text-muted-foreground"}`}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                );
              }

              return (
                <button
                  key={item.label}
                  onClick={() => item.path && onNavigate(item.path)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-muted/50 transition-colors ${isActive ? "bg-sidebar-accent text-primary font-medium" : "text-muted-foreground"}`}
                >
                  <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto bg-payabli-cyan text-primary-foreground text-[9px] px-1.5 py-0.5 rounded-full font-semibold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border/50 p-2 mt-auto">
        <button className="w-full flex items-center gap-2 bg-foreground text-background px-3 py-2 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity">
          <Zap className="w-3 h-3" />
          Quick Actions
        </button>
        <div className="flex items-center gap-2 px-1 pt-2">
          <div className="w-6 h-6 bg-sidebar-accent rounded-full flex items-center justify-center text-[10px] font-semibold text-primary">AB</div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-foreground truncate">Aayush Bhargava</div>
            <div className="text-[9px] text-muted-foreground truncate">aayush@payabli.com</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
