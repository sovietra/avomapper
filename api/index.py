from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx

app = FastAPI(title="AvoMapper Geo API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

NOMINATIM = "https://nominatim.openstreetmap.org"
OSRM      = "https://router.project-osrm.org"
HEADERS   = {"User-Agent": "AvoMapper/1.0"}


@app.get("/api/geo/search")
async def search(q: str = Query(..., min_length=1), limit: int = 5):
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{NOMINATIM}/search",
            params={"format": "json", "q": q, "limit": limit, "addressdetails": 1},
            headers=HEADERS,
        )
        r.raise_for_status()
    return [
        {
            "id":       item["place_id"],
            "name":     item["display_name"].split(",")[0],
            "full_name": item["display_name"],
            "lat":      float(item["lat"]),
            "lng":      float(item["lon"]),
            "type":     item.get("type", "place"),
        }
        for item in r.json()
    ]


@app.get("/api/geo/reverse")
async def reverse(lat: float, lng: float):
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{NOMINATIM}/reverse",
            params={"format": "json", "lat": lat, "lon": lng},
            headers=HEADERS,
        )
        r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise HTTPException(404, "Location not found")
    return {"name": data.get("display_name", ""), "lat": lat, "lng": lng, "address": data.get("address", {})}


@app.get("/api/geo/route")
async def route(
    from_lat: float, from_lng: float,
    to_lat:   float, to_lng:   float,
    mode: str = "driving",
):
    profile = {"driving": "car", "walking": "foot", "cycling": "bike"}.get(mode, "car")
    coords  = f"{from_lng},{from_lat};{to_lng},{to_lat}"
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{OSRM}/route/v1/{profile}/{coords}",
            params={"overview": "full", "geometries": "geojson"},
            headers=HEADERS,
        )
        r.raise_for_status()
    data = r.json()
    if data.get("code") != "Ok":
        raise HTTPException(400, "Route not found")
    rt = data["routes"][0]
    return {
        "distance_km":  round(rt["distance"] / 1000, 2),
        "duration_min": round(rt["duration"] / 60, 1),
        "geometry":     rt["geometry"],
    }
