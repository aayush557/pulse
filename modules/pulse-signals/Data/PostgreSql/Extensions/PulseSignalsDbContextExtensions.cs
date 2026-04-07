using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace PulseSignals.Data.PostgreSql.Extensions;

public static class PulseSignalsDbContextExtensions
{
    public static IServiceCollection AddPulseSignalsDbContext(
        this IServiceCollection services,
        string connectionString)
    {
        services.AddDbContext<PulseSignalsDbContext>(options =>
            options.UseNpgsql(connectionString));

        return services;
    }

    public static IServiceCollection AddPulseSignalsReadDbContext(
        this IServiceCollection services,
        string connectionString)
    {
        services.AddDbContext<PulseSignalsReadDbContext>(options =>
            options.UseNpgsql(connectionString));

        return services;
    }
}
