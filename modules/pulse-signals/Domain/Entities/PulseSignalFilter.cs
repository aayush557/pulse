namespace PulseSignals.Domain.Entities;

public sealed record PulseSignalFilter(long? OrgId, long? PaypointId, string? SignalName);
