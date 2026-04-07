using Microsoft.Extensions.DependencyInjection;
using PulseSubscriptions.Domain.Interfaces;
using PulseSubscriptions.Infrastructure.Repositories;

namespace PulseSubscriptions.Infrastructure.Extensions;

public static class PulseSubscriptionRepositoryExtensions
{
    public static IServiceCollection AddPulseSubscriptionRepositories(this IServiceCollection services)
    {
        services.AddScoped<IPulseSubscriptionRepository, PulseSubscriptionRepository>();
        return services;
    }
}
