using Microsoft.EntityFrameworkCore;
using PulseSubscriptions.Data.PostgreSql.Configurations;
using PulseSubscriptions.Data.PostgreSql.Models;

namespace PulseSubscriptions.Data.PostgreSql;

internal class PulseSubscriptionsDbContext : DbContext
{
    public PulseSubscriptionsDbContext(DbContextOptions<PulseSubscriptionsDbContext> options)
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
