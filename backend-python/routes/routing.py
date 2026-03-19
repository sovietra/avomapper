"""Routing utilities for AvoMapper using OSRM."""
import httpx

OSRM_BASE = "https://router.project-osrm.org"
HEADERS = {"User-Agent": "AvoMapper/1.0"}


async def get_route(from_lat: float, from_lng: float, to_lat: float, to_lng: float, profile: str = "car") -> dict:
    coords = f"{from_lng},{from_lat};{to_lng},{to_lat}"
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{OSRM_BASE}/route/v1/{profile}/{coords}",
            params={"overview": "full", "geometries": "geojson"},
            headers=HEADERS,
        )
        resp.raise_for_status()
        return resp.json()
