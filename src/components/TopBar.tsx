import { Building2, HelpCircle, Bell } from "lucide-react";

interface TopBarProps {
  breadcrumbs: { label: string; active?: boolean }[];
}

export default function TopBar({ breadcrumbs }: TopBarProps) {
  return (
    <header className="h-11 bg-card border-b border-border rounded-tr-xl flex items-center px-4 gap-2 flex-shrink-0">
      <div className="flex items-center gap-1">
        {breadcrumbs.map((bc, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-[11px] text-muted-foreground/50 mx-0.5">/</span>}
            <span className={`text-xs ${bc.active ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {bc.label}
            </span>
          </span>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button className="flex items-center gap-1.5 border border-border rounded-md px-2 py-1 text-[11px] hover:bg-muted/50 transition-colors">
          <Building2 className="w-3 h-3" />
          <span>Payabli</span>
          <span className="bg-sidebar-accent text-primary text-[9px] px-1.5 py-0.5 rounded font-medium">Organization</span>
        </button>
        <button className="w-6 h-6 border border-border rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors">
          <Bell className="w-3 h-3" />
        </button>
        <button className="w-6 h-6 border border-border rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors">
          <HelpCircle className="w-3 h-3" />
        </button>
      </div>
    </header>
  );
}
