from http.server import BaseHTTPRequestHandler
import json
import urllib.request
import urllib.parse

NOMINATIM = "https://nominatim.openstreetmap.org"
OSRM      = "https://router.project-osrm.org"
HEADERS   = {"User-Agent": "AvoMapper/1.0"}


def fetch(url, params=None):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = dict(urllib.parse.parse_qsl(parsed.query))
        path   = parsed.path

        try:
            if path == "/api/geo/search":
                q     = params.get("q", "")
                limit = int(params.get("limit", 5))
                data  = fetch(f"{NOMINATIM}/search", {
                    "format": "json", "q": q,
                    "limit": limit, "addressdetails": 1,
                })
                result = [
                    {
                        "id":       item["place_id"],
                        "name":     item["display_name"].split(",")[0],
                        "full_name": item["display_name"],
                        "lat":      float(item["lat"]),
                        "lng":      float(item["lon"]),
                        "type":     item.get("type", "place"),
                    }
                    for item in data
                ]
                self._json(result)

            elif path == "/api/geo/reverse":
                lat = params.get("lat")
                lng = params.get("lng")
                data = fetch(f"{NOMINATIM}/reverse", {
                    "format": "json", "lat": lat, "lon": lng,
                })
                if "error" in data:
                    self._json({"error": "Not found"}, 404)
                else:
                    self._json({
                        "name":    data.get("display_name", ""),
                        "lat":     float(lat),
                        "lng":     float(lng),
                        "address": data.get("address", {}),
                    })

            elif path == "/api/geo/route":
                from_lat = params.get("from_lat")
                from_lng = params.get("from_lng")
                to_lat   = params.get("to_lat")
                to_lng   = params.get("to_lng")
                mode     = params.get("mode", "driving")
                profile  = {"driving": "car", "walking": "foot", "cycling": "bike"}.get(mode, "car")
                coords   = f"{from_lng},{from_lat};{to_lng},{to_lat}"
                data = fetch(
                    f"{OSRM}/route/v1/{profile}/{coords}",
                    {"overview": "full", "geometries": "geojson"},
                )
                if data.get("code") != "Ok":
                    self._json({"error": "Route not found"}, 400)
                else:
                    rt = data["routes"][0]
                    self._json({
                        "distance_km":  round(rt["distance"] / 1000, 2),
                        "duration_min": round(rt["duration"] / 60, 1),
                        "geometry":     rt["geometry"],
                    })

            else:
                self._json({"error": "Not found"}, 404)

        except Exception as e:
            self._json({"error": str(e)}, 500)

    def _json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type",  "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass
