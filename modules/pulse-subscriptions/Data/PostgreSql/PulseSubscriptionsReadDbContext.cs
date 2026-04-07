using Microsoft.EntityFrameworkCore;
using PulseSubscriptions.Data.PostgreSql.Configurations;
using PulseSubscriptions.Data.PostgreSql.Models;

namespace PulseSubscriptions.Data.PostgreSql;

internal sealed class PulseSubscriptionsReadDbContext : DbContext
{
    public PulseSubscriptionsReadDbContext(DbContextOptions<PulseSubscriptionsReadDbContext> options)
        : base(options)
    {
    }

    internal DbSet<PulseSubscriptionEntity> PulseSubscriptions => Set<PulseSubscriptionEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfiguration(new PulseSubscriptionConfiguration());
    }
}
