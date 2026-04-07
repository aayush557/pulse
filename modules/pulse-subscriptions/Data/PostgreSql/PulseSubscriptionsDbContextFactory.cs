using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PulseSubscriptions.Data.PostgreSql;

internal sealed class PulseSubscriptionsDbContextFactory : IDesignTimeDbContextFactory<PulseSubscriptionsDbContext>
{
    public PulseSubscriptionsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<PulseSubscriptionsDbContext>()
            .UseNpgsql("Host=localhost;Port=5432;Database=pulse;Username=postgres;Password=postgres")
            .Options;

        return new PulseSubscriptionsDbContext(options);
    }
}
