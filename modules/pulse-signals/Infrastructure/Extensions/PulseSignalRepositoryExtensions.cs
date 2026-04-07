using Microsoft.Extensions.DependencyInjection;
using PulseSignals.Domain.Interfaces;
using PulseSignals.Infrastructure.Repositories;

namespace PulseSignals.Infrastructure.Extensions;

public static class PulseSignalRepositoryExtensions
{
    public static IServiceCollection AddPulseSignalRepositories(this IServiceCollection services)
    {
        services.AddScoped<IPulseSignalRepository, PulseSignalRepository>();
        return services;
    }
}
