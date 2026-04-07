using Microsoft.EntityFrameworkCore;
using PulseSignals.Data.PostgreSql;
using PulseSignals.Domain.Entities;
using PulseSignals.Domain.Interfaces;
using PulseSignals.Infrastructure.Mappers;

namespace PulseSignals.Infrastructure.Repositories;

internal sealed class PulseSignalRepository(
    PulseSignalsReadDbContext readContext) : IPulseSignalRepository
{
    public async Task<IEnumerable<PulseSignal>> GetAllAsync(
        PulseSignalFilter filter,
        CancellationToken cancellationToken = default)
    {
        var query = readContext.PulseSignals.AsNoTracking();

        if (filter.OrgId is not null)
            query = query.Where(e => e.OrgId == filter.OrgId.Value);

        if (filter.PaypointId is not null)
            query = query.Where(e => e.PaypointId == filter.PaypointId.Value);

        if (filter.SignalName is not null)
            query = query.Where(e => e.SignalName == filter.SignalName);

        var entities = await query.ToListAsync(cancellationToken);

        return entities.Select(e => e.ToDomain());
    }

    public async Task<PulseSignal?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var entity = await readContext.PulseSignals
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

        if (entity is null)
            throw new KeyNotFoundException($"PulseSignal with id {id} was not found.");

        return entity.ToDomain();
    }
}
