namespace PulseSignals.Domain.Entities;

public sealed class PulseSignal
{
    public int Id { get; set; }
    public string SignalName { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public long PaypointId { get; set; }
    public string ParentIdx { get; set; } = string.Empty;
    public long OrgId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
