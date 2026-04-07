using PulseSubscriptions.Data.PostgreSql.Models;
using PulseSubscriptions.Domain.Entities;

namespace PulseSubscriptions.Infrastructure.Mappers;

internal static class PulseSubscriptionMapper
{
    internal static PulseSubscription ToDomain(this PulseSubscriptionEntity entity)
    {
        return new PulseSubscription
        {
            Id = entity.Id,
            DeclineRate = entity.DeclineRate,
            ExpiredApi = entity.ExpiredApi,
            InactiveMerchant = entity.InactiveMerchant,
            WebhookFailures = entity.WebhookFailures,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt
        };
    }

    internal static PulseSubscriptionEntity ToEntity(this PulseSubscription domain)
    {
        return new PulseSubscriptionEntity
        {
            Id = domain.Id,
            DeclineRate = domain.DeclineRate,
            ExpiredApi = domain.ExpiredApi,
            InactiveMerchant = domain.InactiveMerchant,
            WebhookFailures = domain.WebhookFailures,
            CreatedAt = domain.CreatedAt,
            UpdatedAt = domain.UpdatedAt
        };
    }
}
