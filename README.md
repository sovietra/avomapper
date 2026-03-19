# AvoMapper

A Google Maps-style mapping application built with React, Python FastAPI, and C# ASP.NET Core.

## Stack

- **Frontend**: React 18 + Vite + React-Leaflet + OpenStreetMap
- **Python API**: FastAPI — geocoding, routing, nearby places
- **C# API**: ASP.NET Core 8 — user management, saved places

## Running the App

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open: http://localhost:3000

### Python API
```bash
cd backend-python
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Docs: http://localhost:8000/docs

### C# API
```bash
cd backend-csharp
dotnet run
```
Swagger: http://localhost:5000/swagger

## Features

- Interactive map with OpenStreetMap tiles (dark-filtered)
- Location search via Nominatim geocoding
- Route planning via OSRM
- Nearby places search via Overpass API
- User management REST API (C#)
- Save/retrieve favorite places (C#)
- Soviet constructivist dark theme
