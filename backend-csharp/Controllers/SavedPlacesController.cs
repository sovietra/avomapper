using Microsoft.AspNetCore.Mvc;
using AvoMapper.Models;

namespace AvoMapper.Controllers;

[ApiController]
[Route("api/places")]
public class SavedPlacesController : ControllerBase
{
    private static readonly List<SavedPlace> _places = new();

    [HttpGet]
    public IActionResult GetAll([FromQuery] Guid? userId)
    {
        var results = userId.HasValue
            ? _places.Where(p => p.UserId == userId.Value)
            : _places;
        return Ok(results);
    }

    [HttpGet("{id:guid}")]
    public IActionResult GetById(Guid id)
    {
        var place = _places.FirstOrDefault(p => p.Id == id);
        return place is null ? NotFound() : Ok(place);
    }

    [HttpPost]
    public IActionResult Save([FromBody] SavePlaceRequest request)
    {
        var place = new SavedPlace(
            Guid.NewGuid(),
            request.UserId,
            request.Name,
            request.Address,
            request.Lat,
            request.Lng,
            request.Category,
            DateTime.UtcNow
        );
        _places.Add(place);
        return CreatedAtAction(nameof(GetById), new { id = place.Id }, place);
    }

    [HttpDelete("{id:guid}")]
    public IActionResult Delete(Guid id)
    {
        var place = _places.FirstOrDefault(p => p.Id == id);
        if (place is null) return NotFound();
        _places.Remove(place);
        return NoContent();
    }
}
