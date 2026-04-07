using PulseSubscriptions.Domain.Entities;

namespace PulseSubscriptions.Domain.Interfaces;

public interface IPulseSubscriptionRepository
{
    Task<IEnumerable<PulseSubscription>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<PulseSubscription?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<PulseSubscription> CreateAsync(PulseSubscription subscription, CancellationToken cancellationToken = default);
    Task<PulseSubscription> UpdateAsync(PulseSubscription subscription, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, CancellationToken cancellationToken = default);
}
