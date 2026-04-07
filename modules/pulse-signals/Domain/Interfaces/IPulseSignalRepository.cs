using PulseSignals.Domain.Entities;

namespace PulseSignals.Domain.Interfaces;

public interface IPulseSignalRepository
{
    Task<IEnumerable<PulseSignal>> GetAllAsync(PulseSignalFilter filter, CancellationToken cancellationToken = default);
    Task<PulseSignal?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
}
