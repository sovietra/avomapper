from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
from typing import Optional

app = FastAPI(title="AvoMapper Geo API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
OSRM_BASE = "https://router.project-osrm.org"

HEADERS = {"User-Agent": "AvoMapper/1.0"}


@app.get("/")
def root():
    return {"service": "AvoMapper Geo API", "status": "running", "version": "1.0.0"}


@app.get("/api/geo/search")
async def search(q: str = Query(..., min_length=1), limit: int = 5):
    """Search for locations using Nominatim geocoding."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{NOMINATIM_BASE}/search",
            params={"format": "json", "q": q, "limit": limit, "addressdetails": 1},
            headers=HEADERS,
        )
        resp.raise_for_status()
        data = resp.json()

    return [
        {
            "id": item["place_id"],
            "name": item["display_name"].split(",")[0],
            "full_name": item["display_name"],
            "lat": float(item["lat"]),
            "lng": float(item["lon"]),
            "type": item.get("type", "place"),
            "importance": item.get("importance", 0),
        }
        for item in data
    ]


@app.get("/api/geo/reverse")
async def reverse_geocode(lat: float, lng: float):
    """Reverse geocode a lat/lng coordinate."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{NOMINATIM_BASE}/reverse",
            params={"format": "json", "lat": lat, "lon": lng},
            headers=HEADERS,
        )
        resp.raise_for_status()
        data = resp.json()

    if "error" in data:
        raise HTTPException(status_code=404, detail="Location not found")

    return {
        "name": data.get("display_name", ""),
        "lat": lat,
        "lng": lng,
        "address": data.get("address", {}),
    }


@app.get("/api/geo/route")
async def get_route(
    from_lat: float,
    from_lng: float,
    to_lat: float,
    to_lng: float,
    mode: str = "driving",
):
    """Get a route between two points using OSRM."""
    profile_map = {"driving": "car", "walking": "foot", "cycling": "bike"}
    profile = profile_map.get(mode, "car")

    coords = f"{from_lng},{from_lat};{to_lng},{to_lat}"

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{OSRM_BASE}/route/v1/{profile}/{coords}",
            params={"overview": "full", "geometries": "geojson", "steps": "true"},
            headers=HEADERS,
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("code") != "Ok":
        raise HTTPException(status_code=400, detail="Route not found")

    route = data["routes"][0]
    return {
        "distance_km": round(route["distance"] / 1000, 2),
        "duration_min": round(route["duration"] / 60, 1),
        "geometry": route["geometry"],
        "steps": [
            {
                "instruction": step["maneuver"]["type"],
                "distance_m": step["distance"],
                "name": step.get("name", ""),
            }
            for leg in route["legs"]
            for step in leg["steps"]
        ],
    }


@app.get("/api/geo/nearby")
async def nearby(lat: float, lng: float, category: str = "restaurant", radius: int = 1000):
    """Search for nearby places of a given category."""
    overpass_query = f"""
    [out:json];
    node[amenity={category}](around:{radius},{lat},{lng});
    out body 10;
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://overpass-api.de/api/interpreter",
            data=overpass_query,
            headers=HEADERS,
        )
        resp.raise_for_status()
        data = resp.json()

    results = []
    for element in data.get("elements", [])[:10]:
        tags = element.get("tags", {})
        results.append({
            "id": element["id"],
            "name": tags.get("name", "Unknown"),
            "lat": element["lat"],
            "lng": element["lon"],
            "category": category,
            "tags": tags,
        })
    return results
