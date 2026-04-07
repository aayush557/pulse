using Microsoft.AspNetCore.Mvc;
using PulseApi.Models;
using PulseSubscriptions.Domain.Entities;
using PulseSubscriptions.Domain.Interfaces;

namespace PulseApi.Controllers;

[ApiController]
[Route("api/pulse-subscriptions")]
[Produces("application/json")]
public sealed class PulseSubscriptionsController : ControllerBase
{
    private readonly IPulseSubscriptionRepository _repository;

    public PulseSubscriptionsController(IPulseSubscriptionRepository repository)
    {
        _repository = repository;
    }

    /// <summary>Returns all pulse subscriptions.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<PulseSubscriptionResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
    {
        var subscriptions = await _repository.GetAllAsync(cancellationToken);
        var response = subscriptions.Select(ToResponse);
        return Ok(response);
    }

    /// <summary>Returns a single pulse subscription by id.</summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(PulseSubscriptionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id, CancellationToken cancellationToken)
    {
        var subscription = await _repository.GetByIdAsync(id, cancellationToken);

        if (subscription is null)
            return NotFound();

        return Ok(ToResponse(subscription));
    }

    /// <summary>Creates a new pulse subscription.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(PulseSubscriptionResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(
        [FromBody] CreatePulseSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        var domain = new PulseSubscription
        {
            DeclineRate = request.DeclineRate,
            ExpiredApi = request.ExpiredApi,
            InactiveMerchant = request.InactiveMerchant,
            WebhookFailures = request.WebhookFailures
        };

        var created = await _repository.CreateAsync(domain, cancellationToken);
        var response = ToResponse(created);

        return CreatedAtAction(nameof(GetById), new { id = created.Id }, response);
    }

    /// <summary>Fully updates an existing pulse subscription.</summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(PulseSubscriptionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(
        int id,
        [FromBody] UpdatePulseSubscriptionRequest request,
        CancellationToken cancellationToken)
    {
        var domain = new PulseSubscription
        {
            Id = id,
            DeclineRate = request.DeclineRate,
            ExpiredApi = request.ExpiredApi,
            InactiveMerchant = request.InactiveMerchant,
            WebhookFailures = request.WebhookFailures
        };

        try
        {
            var updated = await _repository.UpdateAsync(domain, cancellationToken);
            return Ok(ToResponse(updated));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    /// <summary>Deletes a pulse subscription by id.</summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        try
        {
            await _repository.DeleteAsync(id, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    private static PulseSubscriptionResponse ToResponse(PulseSubscription subscription) =>
        new(
            subscription.Id,
            subscription.DeclineRate,
            subscription.ExpiredApi,
            subscription.InactiveMerchant,
            subscription.WebhookFailures,
            subscription.CreatedAt,
            subscription.UpdatedAt);
}
