using Microsoft.AspNetCore.Mvc;
using PulseApi.Models;
using PulseSignals.Domain.Entities;
using PulseSignals.Domain.Interfaces;

namespace PulseApi.Controllers;

[ApiController]
[Route("api/pulse-signals")]
[Produces("application/json")]
public sealed class PulseSignalsController : ControllerBase
{
    private readonly IPulseSignalRepository _repository;

    public PulseSignalsController(IPulseSignalRepository repository)
    {
        _repository = repository;
    }

    /// <summary>Returns all pulse signals, with optional filtering.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<PulseSignalResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] long? orgId,
        [FromQuery] long? paypointId,
        [FromQuery] string? signalName,
        CancellationToken cancellationToken)
    {
        var filter = new PulseSignalFilter(orgId, paypointId, signalName);
        var signals = await _repository.GetAllAsync(filter, cancellationToken);
        var response = signals.Select(ToResponse);
        return Ok(response);
    }

    /// <summary>Returns a single pulse signal by id.</summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(PulseSignalResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id, CancellationToken cancellationToken)
    {
        try
        {
            var signal = await _repository.GetByIdAsync(id, cancellationToken);
            return Ok(ToResponse(signal!));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    private static PulseSignalResponse ToResponse(PulseSignal signal) =>
        new(
            signal.Id,
            signal.SignalName,
            signal.Value,
            signal.PaypointId,
            signal.ParentIdx,
            signal.OrgId,
            signal.CreatedAt);
}
