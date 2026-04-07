using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace PulseSubscriptions.Data.PostgreSql.Extensions;

public static class PulseSubscriptionsDbContextExtensions
{
    public static IServiceCollection AddPulseSubscriptionsDbContext(
        this IServiceCollection services,
        string connectionString)
    {
        services.AddDbContext<PulseSubscriptionsDbContext>(options =>
            options.UseNpgsql(connectionString));

        return services;
    }

    public static IServiceCollection AddPulseSubscriptionsReadDbContext(
        this IServiceCollection services,
        string connectionString)
    {
        services.AddDbContext<PulseSubscriptionsReadDbContext>(options =>
            options.UseNpgsql(connectionString));

        return services;
    }
}
