using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PulseSignals.Data.PostgreSql.Models;

namespace PulseSignals.Data.PostgreSql.Configurations;

internal sealed class PulseSignalConfiguration : IEntityTypeConfiguration<PulseSignalEntity>
{
    public void Configure(EntityTypeBuilder<PulseSignalEntity> builder)
    {
        builder.ToTable("pulse_signals", DbContextConstants.DEFAULT_SCHEMA);

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id")
            .UseIdentityAlwaysColumn();

        builder.Property(e => e.SignalName)
            .HasColumnName("signal_name")
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(e => e.Value)
            .HasColumnName("value")
            .IsRequired()
            .HasColumnType("numeric(18,6)");

        builder.Property(e => e.PaypointId)
            .HasColumnName("paypoint_id")
            .IsRequired();

        builder.Property(e => e.ParentIdx)
            .HasColumnName("parent_idx")
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(e => e.OrgId)
            .HasColumnName("org_id")
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired()
            .HasDefaultValueSql("now()")
            .ValueGeneratedOnAdd();
    }
}
