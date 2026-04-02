using PulseSignals.Data.PostgreSql.Extensions;
using PulseSignals.Infrastructure.Extensions;
using PulseSubscriptions.Data.PostgreSql.Extensions;
using PulseSubscriptions.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");

// Controllers
builder.Services.AddControllers();

// Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Pulse API",
        Version = "v1",
        Description = "Pulse pay-ops API"
    });

    var xmlFiles = Directory.GetFiles(AppContext.BaseDirectory, "*.xml");
    foreach (var xmlFile in xmlFiles)
        options.IncludeXmlComments(xmlFile);
});

// pulse-subscriptions module
builder.Services.AddPulseSubscriptionsDbContext(connectionString);
builder.Services.AddPulseSubscriptionsReadDbContext(connectionString);
builder.Services.AddPulseSubscriptionRepositories();

// pulse-signals module
builder.Services.AddPulseSignalsReadDbContext(connectionString);
builder.Services.AddPulseSignalRepositories();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Pulse API v1");
    options.RoutePrefix = string.Empty;
});

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
