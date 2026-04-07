export type WebhookFailureType =
  | "timeout"
  | "rate_limited"
  | "dead_endpoint"
  | "handler_error"
  | "server_error";

export interface ReplyContext {
  endpoint: string;
  failCount: number;
  affectedEvents: string[];
  errorSnippet: string;
  firstFailure: string;
  lastFailure: string;
  affectedPaypoints: number;
}

const formatEvents = (events: string[]): string =>
  events.map((e) => `"${e}"`).join(", ");

export const replyTemplates: Record<
  WebhookFailureType,
  (ctx: ReplyContext) => string
> = {
  timeout: (ctx) =>
    `Subject: Webhook delivery — endpoint timing out

Hi,

We've detected ${ctx.failCount} webhook delivery failures to your endpoint at ${ctx.endpoint} between ${ctx.firstFailure} and ${ctx.lastFailure}. Your server is not responding within our 5-second delivery timeout.

Affected event types: ${formatEvents(ctx.affectedEvents)}
Affected paypoints: ${ctx.affectedPaypoints}

Recommended fix:
- Return HTTP 200 immediately upon receiving the webhook payload, then process it asynchronously in the background.
- If your endpoint is a Google Apps Script or serverless function, ensure cold-start times don't push response times above 5 seconds.
- Consider adding a lightweight health-check endpoint we can monitor.

Events that fail delivery are queued and retried, but will be dropped after 72 hours if the endpoint remains unreachable.

Please let us know once you've made changes and we can verify delivery is restored.`,

  rate_limited: (ctx) =>
    `Subject: Webhook delivery — hitting your rate limit

Hi,

We've recorded ${ctx.failCount} webhook delivery failures to ${ctx.endpoint} between ${ctx.firstFailure} and ${ctx.lastFailure}. Your API is rejecting our requests with a rate-limit error.

Error detail: ${ctx.errorSnippet}
Affected event types: ${formatEvents(ctx.affectedEvents)}

During settlement and batch-processing windows, notification volume can spike significantly. Your current rate limit is causing deliveries to be rejected during these peaks.

Options to resolve:
1. Increase your API's rate limit for our webhook source IP/user-agent.
2. Let us know and we can explore delivery throttling or batching on our side.
3. Implement a webhook queue on your end that accepts all deliveries and processes them at your own pace.

We're happy to coordinate on the best approach for your integration.`,

  dead_endpoint: (ctx) =>
    `Subject: Webhook endpoint no longer active

Hi,

Your webhook URL ${ctx.endpoint} is returning HTTP 404. ${ctx.errorSnippet.includes("unsubscribe") ? 'The response body says "please unsubscribe me," which typically means the webhook was deleted or deactivated on your end.' : "The endpoint appears to no longer exist."}

We've recorded ${ctx.failCount} failed deliveries between ${ctx.firstFailure} and ${ctx.lastFailure}.
Affected event types: ${formatEvents(ctx.affectedEvents)}

Next steps:
- If you intentionally removed this webhook, please let us know and we'll disable the subscription to stop retry attempts.
- If this was unintentional, recreate the endpoint at the same URL and we'll replay any queued events.

Please confirm how you'd like to proceed so we can clean this up.`,

  handler_error: (ctx) =>
    `Subject: Webhook handler returning errors for certain events

Hi,

Your endpoint at ${ctx.endpoint} is returning HTTP 400 errors when we deliver certain notification types. We've recorded ${ctx.failCount} failures between ${ctx.firstFailure} and ${ctx.lastFailure}.

Error from your server: ${ctx.errorSnippet}
Affected event types: ${formatEvents(ctx.affectedEvents)}

This typically means your webhook handler expects fields that aren't present in all event types. For example, payment-related fields may not be included in boarding or merchant-lifecycle events.

Recommended fix:
- Make optional any fields that are specific to a single event type (e.g., transaction amount, payment method).
- Handle each event type with its own validation logic rather than applying a single schema to all events.
- Return HTTP 200 for event types you don't need to process — this prevents unnecessary retries.

We're happy to share payload samples for any event type if that would help.`,

  server_error: (ctx) =>
    `Subject: Webhook endpoint returning server errors

Hi,

Your endpoint at ${ctx.endpoint} has returned ${ctx.failCount} server errors (HTTP 5xx) between ${ctx.firstFailure} and ${ctx.lastFailure}.

Affected event types: ${formatEvents(ctx.affectedEvents)}
Affected paypoints: ${ctx.affectedPaypoints}

Events that fail delivery are queued and retried, but will be dropped after 72 hours. We recommend checking your server logs for the root cause.

Please let us know once the issue is resolved and we can verify delivery is restored.`,
};

export function classifyFailure(
  statusCode: number,
  statusDescription: string | null,
  responseContent: string | null
): WebhookFailureType {
  if (
    statusCode === 0 &&
    statusDescription?.toLowerCase().includes("timeout")
  ) {
    return "timeout";
  }
  if (statusCode === 429) {
    return "rate_limited";
  }
  if (
    statusCode === 400 &&
    responseContent?.toLowerCase().includes("rate limit")
  ) {
    return "rate_limited";
  }
  if (
    statusCode === 404 &&
    responseContent?.toLowerCase().includes("unsubscribe")
  ) {
    return "dead_endpoint";
  }
  if (statusCode === 404) {
    return "dead_endpoint";
  }
  if (statusCode === 400) {
    return "handler_error";
  }
  if (statusCode >= 500 && statusCode < 600) {
    return "server_error";
  }
  // Default: treat unknown errors as server errors
  return "server_error";
}

export function severityForType(
  type: WebhookFailureType,
  failCount: number
): "danger" | "warning" | "info" {
  if (type === "dead_endpoint") return "danger";
  if (type === "server_error" && failCount > 50) return "danger";
  if (type === "timeout" && failCount > 100) return "danger";
  if (type === "rate_limited") return "warning";
  if (type === "handler_error") return "warning";
  return "info";
}
