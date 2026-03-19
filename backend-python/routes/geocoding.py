"""Geocoding utilities for AvoMapper."""
import httpx

NOMINATIM_BASE = "https://nominatim.openstreetmap.org"
HEADERS = {"User-Agent": "AvoMapper/1.0"}


async def geocode(query: str, limit: int = 5) -> list[dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{NOMINATIM_BASE}/search",
            params={"format": "json", "q": query, "limit": limit},
            headers=HEADERS,
        )
        resp.raise_for_status()
        return resp.json()


async def reverse(lat: float, lng: float) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{NOMINATIM_BASE}/reverse",
            params={"format": "json", "lat": lat, "lon": lng},
            headers=HEADERS,
        )
        resp.raise_for_status()
        return resp.json()
