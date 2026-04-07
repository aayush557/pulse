using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PulseSubscriptions.Data.PostgreSql.Models;

namespace PulseSubscriptions.Data.PostgreSql.Configurations;

internal sealed class PulseSubscriptionConfiguration : IEntityTypeConfiguration<PulseSubscriptionEntity>
{
    public void Configure(EntityTypeBuilder<PulseSubscriptionEntity> builder)
    {
        builder.ToTable("pulse_subscriptions", DbContextConstants.DEFAULT_SCHEMA);

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id")
            .UseIdentityAlwaysColumn();

        builder.Property(e => e.DeclineRate)
            .HasColumnName("decline_rate")
            .IsRequired();

        builder.Property(e => e.ExpiredApi)
            .HasColumnName("expired_api")
            .IsRequired();

        builder.Property(e => e.InactiveMerchant)
            .HasColumnName("inactive_merchant")
            .IsRequired();

        builder.Property(e => e.WebhookFailures)
            .HasColumnName("webhook_failures")
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired()
            .HasDefaultValueSql("now()")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired()
            .HasDefaultValueSql("now()")
            .ValueGeneratedOnAddOrUpdate();
    }
}
