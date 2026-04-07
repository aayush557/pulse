import { useQuery, useMutation } from "@tanstack/react-query";
import type {
  MetricsSummary, AlertsResponse, MerchantHealthResponse, WebhookAlertsResponse,
  PartnerRiskResponse, NotificationFailuresResponse, LinearConfigResponse, LinearIssueResponse,
  AmigoChatResponse, PortfolioDigestResponse, PredictiveAlertsResponse,
  AlertActionResponse, AlertResolutionsResponse, SettingsRecommendationsResponse, SubscriptionsResponse,
} from "@/types/api";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function useMetricsSummary() {
  return useQuery<MetricsSummary>({
    queryKey: ["metrics", "summary"],
    queryFn: () => fetchJson<MetricsSummary>("/api/metrics/summary"),
    refetchInterval: 60_000, // refresh every minute
    staleTime: 30_000,
  });
}

export function useAlerts(days?: number) {
  return useQuery<AlertsResponse>({
    queryKey: ["alerts", days ?? 7],
    queryFn: () => fetchJson<AlertsResponse>(`/api/alerts?days=${days || 7}`),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useMerchantHealth() {
  return useQuery<MerchantHealthResponse>({
    queryKey: ["merchant-health"],
    queryFn: () => fetchJson<MerchantHealthResponse>("/api/merchant-health"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useWebhookAlerts() {
  return useQuery<WebhookAlertsResponse>({
    queryKey: ["alerts", "webhooks"],
    queryFn: () => fetchJson<WebhookAlertsResponse>("/api/alerts/webhooks"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useNotificationFailures() {
  return useQuery<NotificationFailuresResponse>({
    queryKey: ["notification-failures"],
    queryFn: () => fetchJson<NotificationFailuresResponse>("/api/notification-failures"),
    staleTime: 5 * 60_000, // AI analysis is cached server-side, no need to refetch often
    refetchInterval: 5 * 60_000,
  });
}

export function useLinearConfig() {
  return useQuery<LinearConfigResponse>({
    queryKey: ["linear", "config"],
    queryFn: () => fetchJson<LinearConfigResponse>("/api/linear/config"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateLinearIssue() {
  return useMutation<LinearIssueResponse, Error, {
    teamId: string;
    title: string;
    body: string;
    priority: string;
    groupId: string;
  }>({
    mutationFn: async (data) => {
      const res = await fetch("/api/linear/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Failed to create issue");
      }
      return res.json();
    },
  });
}

export function usePartnerRisk(tier?: string) {
  const params = new URLSearchParams({ limit: "200" });
  if (tier) params.set("tier", tier);
  return useQuery<PartnerRiskResponse>({
    queryKey: ["partner-risk", tier ?? "all"],
    queryFn: () => fetchJson<PartnerRiskResponse>(`/api/partner-risk?${params}`),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}

// ── Amigo AI Chat ──────────────────────────────────────────────────────

export function useAmigoChat() {
  return useMutation<AmigoChatResponse, Error, {
    message: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  }>({
    mutationFn: async (data) => {
      const res = await fetch("/api/amigo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Failed to get response");
      }
      return res.json();
    },
  });
}

// ── Portfolio Digest ───────────────────────────────────────────────────

export function usePortfolioDigest() {
  return useQuery<PortfolioDigestResponse>({
    queryKey: ["portfolio-digest"],
    queryFn: () => fetchJson<PortfolioDigestResponse>("/api/portfolio-digest"),
    staleTime: 30 * 60_000, // 30 min — server caches for 1hr
    refetchOnWindowFocus: false,
  });
}

// ── Predictive Alerts ──────────────────────────────────────────────────

export function usePredictiveAlerts() {
  return useQuery<PredictiveAlertsResponse>({
    queryKey: ["alerts", "predictive"],
    queryFn: () => fetchJson<PredictiveAlertsResponse>("/api/alerts/predictive"),
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  });
}

// ── Alert Resolutions ─────────────────────────────────────────────────

export function useAlertResolutions() {
  return useQuery<AlertResolutionsResponse>({
    queryKey: ["alert-resolutions"],
    queryFn: () => fetchJson<AlertResolutionsResponse>("/api/alerts/resolutions"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ── Alert Actions ──────────────────────────────────────────────────────

export function useAlertAction() {
  return useMutation<AlertActionResponse, Error, {
    alertId: string;
    actionType: string;
    params?: Record<string, any>;
  }>({
    mutationFn: async ({ alertId, actionType, params }) => {
      const res = await fetch(`/api/alerts/${alertId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType, params }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Action failed");
      }
      return res.json();
    },
  });
}

// ── Resolution Insight (AI-generated) ─────────────────────────────────

export function useResolutionInsight() {
  return useMutation<{ insight: string }, Error, { alertId: string }>({
    mutationFn: async ({ alertId }) => {
      const res = await fetch(`/api/alerts/${alertId}/insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to generate insight");
      return res.json();
    },
  });
}

// ── Settings Recommendations ───────────────────────────────────────────

export function useSettingsRecommendations() {
  return useQuery<SettingsRecommendationsResponse>({
    queryKey: ["settings", "recommendations"],
    queryFn: () => fetchJson<SettingsRecommendationsResponse>("/api/settings/recommendations"),
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}

// ── Subscriptions ─────────────────────────────────────────────────────

export function useSubscriptions() {
  return useQuery<SubscriptionsResponse>({
    queryKey: ["subscriptions"],
    queryFn: () => fetchJson<SubscriptionsResponse>("/api/subscriptions"),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSubscriptions() {
  return useMutation<SubscriptionsResponse, Error, Record<string, boolean>>({
    mutationFn: async (data) => {
      const res = await fetch("/api/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update subscriptions");
      return res.json();
    },
  });
}
