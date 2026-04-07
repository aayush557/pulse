namespace PulseApi.Models;

public sealed record PulseSignalResponse(
    int Id,
    string SignalName,
    decimal Value,
    long PaypointId,
    string ParentIdx,
    long OrgId,
    DateTimeOffset CreatedAt);
