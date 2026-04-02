import { useQuery } from "@tanstack/react-query";
import type { MetricsSummary, AlertsResponse, MerchantHealthResponse } from "@/types/api";

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

export function useAlerts() {
  return useQuery<AlertsResponse>({
    queryKey: ["alerts"],
    queryFn: () => fetchJson<AlertsResponse>("/api/alerts"),
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
