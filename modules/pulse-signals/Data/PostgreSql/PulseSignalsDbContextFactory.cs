using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PulseSignals.Data.PostgreSql;

internal sealed class PulseSignalsDbContextFactory : IDesignTimeDbContextFactory<PulseSignalsDbContext>
{
    public PulseSignalsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<PulseSignalsDbContext>()
            .UseNpgsql("Host=localhost;Port=5432;Database=pulse;Username=postgres;Password=postgres")
            .Options;

        return new PulseSignalsDbContext(options);
    }
}
