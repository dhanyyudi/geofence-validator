"use client";

import { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  ZoomControl,
} from "react-leaflet";

// Component to adjust map view
function MapBounds({ bounds }) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds);
    }
  }, [bounds, map]);

  return null;
}

export default function DirectMultiPolygonMap({
  geojson,
  selectedRingIndex,
  onSelectRing,
}) {
  const [mapBounds, setMapBounds] = useState(null);
  const [rings, setRings] = useState([]);

  useEffect(() => {
    console.log("DirectMultiPolygonMap received geojson:", geojson);
    if (!geojson) return;

    try {
      // Handle both FeatureCollection and Feature formats
      let geometry = null;
      let properties = {};

      if (
        geojson.type === "FeatureCollection" &&
        geojson.features &&
        geojson.features.length > 0
      ) {
        const feature = geojson.features[0];
        geometry = feature.geometry;
        properties = feature.properties || {};
      } else if (geojson.type === "Feature") {
        geometry = geojson.geometry;
        properties = geojson.properties || {};
      } else if (
        geojson.type === "Polygon" ||
        geojson.type === "MultiPolygon"
      ) {
        geometry = geojson;
      }

      if (!geometry) {
        console.warn("No valid geometry found in geojson");
        return;
      }

      // Process MultiPolygon
      if (geometry.type === "MultiPolygon") {
        const coordinates = geometry.coordinates;
        if (coordinates && coordinates.length > 0) {
          // Check all polygons in MultiPolygon
          let allRings = [];

          coordinates.forEach((polygon, polygonIndex) => {
            if (Array.isArray(polygon) && polygon.length > 0) {
              // Each polygon consists of 1 outer ring and several inner rings (holes)
              polygon.forEach((ring, ringIndex) => {
                allRings.push({
                  ringIndex: allRings.length, // Unique index for all rings
                  polygonIndex,
                  polygonRingIndex: ringIndex,
                  coordinates: ring,
                  isExterior: ringIndex === 0,
                  isInterior: ringIndex > 0,
                });
              });
            }
          });

          console.log(
            `Extracted ${allRings.length} rings from all polygons in MultiPolygon`
          );
          setRings(allRings);

          // Set bounds using all coordinates
          if (allRings.length > 0) {
            const allCoords = allRings.flatMap((ring) => ring.coordinates);
            const lons = allCoords.map((coord) => coord[0]);
            const lats = allCoords.map((coord) => coord[1]);
            const minLon = Math.min(...lons);
            const maxLon = Math.max(...lons);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);

            const bounds = [
              [minLat, minLon], // SW corner [lat, lng]
              [maxLat, maxLon], // NE corner [lat, lng]
            ];
            console.log("Setting map bounds for MultiPolygon:", bounds);
            setMapBounds(bounds);
          }
        }
      }
      // Process Polygon
      else if (geometry.type === "Polygon") {
        const coordinates = geometry.coordinates;
        if (coordinates && coordinates.length > 0) {
          const rings = coordinates.map((ring, index) => ({
            ringIndex: index,
            coordinates: ring,
            isExterior: index === 0,
            isInterior: index > 0,
          }));

          console.log(`Extracted ${rings.length} rings from Polygon`);
          setRings(rings);

          // Set bounds
          const allCoords = rings.flatMap((ring) => ring.coordinates);
          const lons = allCoords.map((coord) => coord[0]);
          const lats = allCoords.map((coord) => coord[1]);
          const bounds = [
            [Math.min(...lats), Math.min(...lons)],
            [Math.max(...lats), Math.max(...lons)],
          ];
          console.log("Setting map bounds for Polygon:", bounds);
          setMapBounds(bounds);
        }
      } else {
        console.warn("Unsupported geometry type:", geometry.type);
      }
    } catch (error) {
      console.error("Error processing geojson:", error);
    }
  }, [geojson]);

  // Function to create GeoJSON from a single ring
  const createRingGeoJSON = (ring) => {
    if (!ring || !ring.coordinates) {
      console.warn("Invalid ring:", ring);
      return {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [[]],
        },
      };
    }

    return {
      type: "Feature",
      properties: {
        ringIndex: ring.ringIndex,
        polygonIndex: ring.polygonIndex,
        polygonRingIndex: ring.polygonRingIndex,
        isExterior: ring.isExterior,
        isInterior: ring.isInterior,
      },
      geometry: {
        type: "Polygon",
        coordinates: [ring.coordinates], // Ring wrapped in array
      },
    };
  };

  // Style for rings
  const getRingStyle = (ring) => {
    const isSelected = ring.ringIndex === selectedRingIndex;
    const isExterior = ring.isExterior;

    // Array of colors for different rings
    const colors = [
      "#3388ff", // Blue
      "#33a02c", // Green
      "#ff7f00", // Orange
      "#e31a1c", // Red
      "#6a3d9a", // Purple
    ];

    return {
      color: isSelected ? "#ff4500" : colors[ring.ringIndex % colors.length],
      weight: isSelected ? 4 : isExterior ? 3 : 1,
      opacity: 0.9,
      fillColor: isSelected
        ? "#ff7f50"
        : colors[ring.ringIndex % colors.length],
      fillOpacity: isExterior ? 0.4 : 0.2,
      dashArray: !isExterior ? "4, 4" : null, // Dashed line for interior rings
    };
  };

  const handleRingClick = (ring) => {
    if (onSelectRing) {
      onSelectRing(ring.ringIndex);
    }
  };

  // If no geojson is provided, render a placeholder
  if (!geojson) {
    return (
      <div className="h-96 bg-white rounded-lg shadow-md overflow-hidden flex items-center justify-center">
        <div className="text-center p-8">
          <i className="fas fa-map-marked-alt text-gray-300 text-5xl mb-4"></i>
          <p className="text-gray-500">No GeoJSON data available</p>
        </div>
      </div>
    );
  }

  // Create a simplified GeoJSON for display if there's no rings (or for the fixed result)
  const createSimplifiedGeoJSON = () => {
    if (rings.length === 0) {
      return geojson;
    }

    // Otherwise return the rings as separate features
    return {
      type: "FeatureCollection",
      features: rings.map((ring) => createRingGeoJSON(ring)),
    };
  };

  return (
    <div className="h-96 bg-white rounded-lg shadow-md overflow-hidden">
      <MapContainer
        style={{ height: "100%", width: "100%" }}
        center={[0, 0]}
        zoom={2}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mapBounds && <MapBounds bounds={mapBounds} />}

        {/* If no rings are extracted, render the whole GeoJSON */}
        {rings.length === 0 && (
          <GeoJSON
            data={geojson}
            style={{
              color: "#3388ff",
              weight: 3,
              opacity: 0.9,
              fillColor: "#3388ff",
              fillOpacity: 0.4,
            }}
          />
        )}

        {/* Otherwise, render individual rings */}
        {rings.length > 0 &&
          rings.map((ring) => (
            <GeoJSON
              key={`ring-${ring.ringIndex}`}
              data={createRingGeoJSON(ring)}
              style={() => getRingStyle(ring)}
              eventHandlers={{
                click: () => handleRingClick(ring),
              }}
            />
          ))}
      </MapContainer>

      {/* Legend - Only show if we have rings and the original form (not the fixed version) */}
      {rings.length > 0 && onSelectRing && (
        <div className="p-3 bg-white border-t">
          <h3 className="font-medium text-sm mb-2">Rings</h3>
          <div className="space-y-2">
            {rings.map((ring) => (
              <div
                key={`legend-${ring.ringIndex}`}
                className={`flex items-center p-2 rounded cursor-pointer ${
                  selectedRingIndex === ring.ringIndex
                    ? "bg-blue-100"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => handleRingClick(ring)}
              >
                <div
                  className="w-4 h-4 mr-2 rounded"
                  style={{ backgroundColor: getRingStyle(ring).fillColor }}
                ></div>
                <div>
                  <div className="text-sm font-medium">
                    Ring {ring.ringIndex + 1} (
                    {ring.isExterior ? "Exterior" : "Interior"})
                  </div>
                  <div className="text-xs text-gray-600">
                    {ring.coordinates.length} points
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
