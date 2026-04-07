using Microsoft.EntityFrameworkCore;
using PulseSubscriptions.Data.PostgreSql;
using PulseSubscriptions.Domain.Entities;
using PulseSubscriptions.Domain.Interfaces;
using PulseSubscriptions.Infrastructure.Mappers;

namespace PulseSubscriptions.Infrastructure.Repositories;

internal sealed class PulseSubscriptionRepository : IPulseSubscriptionRepository
{
    private readonly PulseSubscriptionsDbContext _writeContext;
    private readonly PulseSubscriptionsReadDbContext _readContext;

    public PulseSubscriptionRepository(
        PulseSubscriptionsDbContext writeContext,
        PulseSubscriptionsReadDbContext readContext)
    {
        _writeContext = writeContext;
        _readContext = readContext;
    }

    public async Task<IEnumerable<PulseSubscription>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var entities = await _readContext.PulseSubscriptions
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return entities.Select(e => e.ToDomain());
    }

    public async Task<PulseSubscription?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var entity = await _readContext.PulseSubscriptions
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        return entity?.ToDomain();
    }

    public async Task<PulseSubscription> CreateAsync(PulseSubscription subscription, CancellationToken cancellationToken = default)
    {
        var entity = subscription.ToEntity();

        _writeContext.PulseSubscriptions.Add(entity);
        await _writeContext.SaveChangesAsync(cancellationToken);

        return entity.ToDomain();
    }

    public async Task<PulseSubscription> UpdateAsync(PulseSubscription subscription, CancellationToken cancellationToken = default)
    {
        var entity = await _writeContext.PulseSubscriptions
            .FirstOrDefaultAsync(e => e.Id == subscription.Id, cancellationToken)
            ?? throw new KeyNotFoundException($"PulseSubscription with id {subscription.Id} was not found.");

        entity.DeclineRate = subscription.DeclineRate;
        entity.ExpiredApi = subscription.ExpiredApi;
        entity.InactiveMerchant = subscription.InactiveMerchant;
        entity.WebhookFailures = subscription.WebhookFailures;
        entity.UpdatedAt = DateTimeOffset.UtcNow;

        await _writeContext.SaveChangesAsync(cancellationToken);

        return entity.ToDomain();
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        var entity = await _writeContext.PulseSubscriptions
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException($"PulseSubscription with id {id} was not found.");

        _writeContext.PulseSubscriptions.Remove(entity);
        await _writeContext.SaveChangesAsync(cancellationToken);
    }
}
