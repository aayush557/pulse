import { useState } from "react";
import { X, Send, Phone, Mail } from "lucide-react";
import { toast } from "sonner";

interface ContactSupportDialogProps {
  alertId: string | null;
  onClose: () => void;
}

export default function ContactSupportDialog({ alertId, onClose }: ContactSupportDialogProps) {
  const [message, setMessage] = useState(alertId ? `Regarding alert ${alertId}: ` : "");
  const [method, setMethod] = useState<"email" | "phone">("email");

  const handleSubmit = () => {
    toast.success("Support request submitted. A team member will reach out within 2 hours.");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-foreground/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border shadow-xl w-[420px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Contact Payabli Support</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4">
          {/* Method selector */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setMethod("email")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${method === "email" ? "bg-foreground text-background" : "border border-border text-foreground hover:bg-muted/50"}`}
            >
              <Mail className="w-3 h-3" /> Email
            </button>
            <button
              onClick={() => setMethod("phone")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${method === "phone" ? "bg-foreground text-background" : "border border-border text-foreground hover:bg-muted/50"}`}
            >
              <Phone className="w-3 h-3" /> Request callback
            </button>
          </div>

          {alertId && (
            <div className="bg-muted/50 border border-border rounded-md p-2.5 text-[11px] text-muted-foreground mb-3 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-payabli-cyan" />
              Linked to alert {alertId}
            </div>
          )}

          <div className="mb-3">
            <label className="text-[11px] font-medium text-foreground mb-1 block">Subject</label>
            <input className="w-full border border-border rounded-md px-3 py-2 text-xs text-foreground bg-card outline-none focus:border-ring" defaultValue={alertId ? `Issue with alert ${alertId}` : ""} />
          </div>

          <div className="mb-3">
            <label className="text-[11px] font-medium text-foreground mb-1 block">
              {method === "email" ? "Message" : "Brief description"}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full border border-border rounded-md px-3 py-2 text-xs text-foreground bg-card outline-none focus:border-ring resize-none"
              placeholder="Describe your issue..."
            />
          </div>

          {method === "phone" && (
            <div className="mb-3">
              <label className="text-[11px] font-medium text-foreground mb-1 block">Phone number</label>
              <input className="w-full border border-border rounded-md px-3 py-2 text-xs text-foreground bg-card outline-none focus:border-ring" placeholder="+1 (555) 000-0000" />
            </div>
          )}

          <div className="bg-status-info-bg border border-status-info-border rounded-md p-2.5 text-[11px] text-status-info-text mb-4">
            {method === "email"
              ? "Our support team typically responds within 2 hours during business hours (9 AM – 6 PM ET)."
              : "A support engineer will call you back within 30 minutes during business hours."}
          </div>

          <button
            onClick={handleSubmit}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-md bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Send className="w-3 h-3" />
            {method === "email" ? "Send message" : "Request callback"}
          </button>
        </div>
      </div>
    </div>
  );
}
