namespace PulseSubscriptions.Domain.Entities;

public sealed class PulseSubscription
{
    public int Id { get; set; }
    public bool DeclineRate { get; set; }
    public bool ExpiredApi { get; set; }
    public bool InactiveMerchant { get; set; }
    public bool WebhookFailures { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
