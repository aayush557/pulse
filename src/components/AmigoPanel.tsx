import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles } from "lucide-react";
import { useAmigoChat } from "@/hooks/useDashboardData";

interface Props {
  onClose: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AmigoPanel({ onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const chatMutation = useAmigoChat();

  const suggestions = [
    "Which of my merchants had the highest decline rate this week?",
    "How is my portfolio performing vs. last month?",
    "Which alerts have been open longest?",
    "What's my total payout volume this month?",
  ];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (text?: string) => {
    const msg = text || input.trim();
    if (!msg || chatMutation.isPending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setIsTyping(true);

    chatMutation.mutate(
      {
        message: msg,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      },
      {
        onSuccess: (data) => {
          setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
          setIsTyping(false);
        },
        onError: (err) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Sorry, I couldn't process that request. ${err.message}` },
          ]);
          setIsTyping(false);
        },
      }
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col h-[600px] animate-slide-in">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border/50 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-status-purple-bg flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-status-purple" />
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground">Ask Amigo</div>
            <div className="text-[9px] text-muted-foreground">Ask questions about your portfolio in plain English</div>
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-full bg-status-purple-bg flex items-center justify-center mx-auto mb-2">
              <Sparkles className="w-5 h-5 text-status-purple" />
            </div>
            <div className="text-xs font-semibold text-foreground mb-1">Welcome to Amigo</div>
            <div className="text-[10px] text-muted-foreground mb-4">Ask anything about your merchants, volumes, or alerts.</div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
              msg.role === "user"
                ? "bg-foreground text-background"
                : "bg-muted/50 border border-border text-foreground"
            }`}>
              {msg.content.split("**").map((part, j) =>
                j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-muted/50 border border-border rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "0.2s" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Suggestion chips */}
      {messages.length === 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="text-[10px] px-2.5 py-1.5 rounded-full border border-status-purple-bg bg-status-purple-bg text-status-purple-text hover:bg-status-purple-bg/80 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 border border-border rounded-md px-2.5 py-2 bg-card">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about your merchants, volumes, alerts..."
            className="flex-1 text-[11px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="text-primary hover:text-primary/80 disabled:text-muted-foreground/30"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-center mt-1.5 text-[8px] text-muted-foreground">
          Powered by Amigo · Amigo has read-only access to your portfolio data.
        </div>
      </div>
    </div>
  );
}
