using PulseSignals.Data.PostgreSql.Models;
using PulseSignals.Domain.Entities;

namespace PulseSignals.Infrastructure.Mappers;

internal static class PulseSignalMapper
{
    internal static PulseSignal ToDomain(this PulseSignalEntity entity)
    {
        return new PulseSignal
        {
            Id = entity.Id,
            SignalName = entity.SignalName,
            Value = entity.Value,
            PaypointId = entity.PaypointId,
            ParentIdx = entity.ParentIdx,
            OrgId = entity.OrgId,
            CreatedAt = entity.CreatedAt
        };
    }

    internal static PulseSignalEntity ToEntity(this PulseSignal domain)
    {
        return new PulseSignalEntity
        {
            Id = domain.Id,
            SignalName = domain.SignalName,
            Value = domain.Value,
            PaypointId = domain.PaypointId,
            ParentIdx = domain.ParentIdx,
            OrgId = domain.OrgId,
            CreatedAt = domain.CreatedAt
        };
    }
}
