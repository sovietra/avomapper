namespace AvoMapper.Models;

public record SavedPlace(
    Guid Id,
    Guid UserId,
    string Name,
    string Address,
    double Lat,
    double Lng,
    string Category,
    DateTime SavedAt
);

public record SavePlaceRequest(
    Guid UserId,
    string Name,
    string Address,
    double Lat,
    double Lng,
    string Category
);
