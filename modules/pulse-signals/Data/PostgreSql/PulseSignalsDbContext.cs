using Microsoft.EntityFrameworkCore;
using PulseSignals.Data.PostgreSql.Configurations;
using PulseSignals.Data.PostgreSql.Models;

namespace PulseSignals.Data.PostgreSql;

internal class PulseSignalsDbContext : DbContext
{
    public PulseSignalsDbContext(DbContextOptions<PulseSignalsDbContext> options)
        : base(options)
    {
    }

    internal DbSet<PulseSignalEntity> PulseSignals => Set<PulseSignalEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfiguration(new PulseSignalConfiguration());
    }
}
