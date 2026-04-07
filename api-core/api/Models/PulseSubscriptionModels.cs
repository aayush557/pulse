namespace PulseApi.Models;

public sealed record CreatePulseSubscriptionRequest(
    bool DeclineRate,
    bool ExpiredApi,
    bool InactiveMerchant,
    bool WebhookFailures);

public sealed record UpdatePulseSubscriptionRequest(
    bool DeclineRate,
    bool ExpiredApi,
    bool InactiveMerchant,
    bool WebhookFailures);

public sealed record PulseSubscriptionResponse(
    int Id,
    bool DeclineRate,
    bool ExpiredApi,
    bool InactiveMerchant,
    bool WebhookFailures,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
