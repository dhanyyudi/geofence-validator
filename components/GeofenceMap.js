"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  LayersControl,
  ZoomControl,
} from "react-leaflet";
import * as turf from "@turf/turf";

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

export default function GeofenceMap({
  geojson,
  polygons,
  rings,
  onSelectPolygon,
  onSelectRing,
  onLayerToggle,
}) {
  const [mapBounds, setMapBounds] = useState(null);
  const [selectedPolygonIndex, setSelectedPolygonIndex] = useState(null);
  const [selectedRingIndex, setSelectedRingIndex] = useState(null);
  const [visibleLayers, setVisibleLayers] = useState({});
  const mapRef = useRef(null);
  const geoJsonLayers = useRef({});

  // Initialize visibleLayers based on rings or polygons
  useEffect(() => {
    console.log("Map component received rings:", rings ? rings.length : 0);

    if (rings && rings.length > 0) {
      const initialVisibility = {};
      rings.forEach((ring, index) => {
        if (ring) {
          initialVisibility[index] = true;
          console.log(`Setting initial visibility for ring ${index}: true`);
        }
      });
      setVisibleLayers(initialVisibility);
    } else if (polygons && polygons.length > 0) {
      const initialVisibility = {};
      polygons.forEach((_, index) => {
        initialVisibility[index] = true;
      });
      setVisibleLayers(initialVisibility);
    }
  }, [rings, polygons]);

  // Calculate bounds for geojson
  useEffect(() => {
    if (geojson) {
      try {
        // Use turf to get the bounding box
        const bbox = turf.bbox(geojson);
        // Convert turf bbox [minX, minY, maxX, maxY] to Leaflet bounds [[minY, minX], [maxY, maxX]]
        const bounds = [
          [bbox[1], bbox[0]], // SW corner [lat, lng]
          [bbox[3], bbox[2]], // NE corner [lat, lng]
        ];
        setMapBounds(bounds);
      } catch (error) {
        console.error("Error calculating bounds:", error);
      }
    }
  }, [geojson]);

  // Function to create GeoJSON from a single polygon or ring
  const createPolygonGeoJSON = (item, isRing = false) => {
    if (isRing) {
      // If item is a ring, create a polygon with that ring as exterior
      return {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [item.coordinates], // For ring, must be wrapped in array
        },
      };
    } else {
      // If item is a polygon, use all its rings
      return {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: item.coordinates,
        },
      };
    }
  };

  // Style for polygons and rings
  const getItemStyle = (index, type = "polygon") => {
    // Array of colors for different items
    const colors = [
      "#3388ff", // Blue
      "#33a02c", // Green
      "#ff7f00", // Orange
      "#e31a1c", // Red
      "#6a3d9a", // Purple
      "#b15928", // Brown
      "#a6cee3", // Light Blue
      "#b2df8a", // Light Green
      "#fb9a99", // Light Red
      "#fdbf6f", // Light Orange
    ];

    // If item is an interior ring, use color with higher transparency
    const isRingInterior =
      type === "ring" && rings && rings[index] && rings[index].isInterior;

    const selectedItem =
      type === "ring" ? selectedRingIndex : selectedPolygonIndex;

    return {
      color: index === selectedItem ? "#ff4500" : colors[index % colors.length],
      weight: index === selectedItem ? 4 : isRingInterior ? 1 : 2,
      opacity: 0.9,
      fillColor:
        index === selectedItem ? "#ff7f50" : colors[index % colors.length],
      fillOpacity: isRingInterior ? 0.2 : 0.4,
      dashArray: isRingInterior ? "4, 4" : null, // Dashed line for interior rings
    };
  };

  const handlePolygonClick = (index) => {
    setSelectedPolygonIndex(index);
    if (onSelectPolygon) {
      onSelectPolygon(index);
    }
  };

  const handleRingClick = (index) => {
    setSelectedRingIndex(index);
    if (onSelectRing) {
      onSelectRing(index);
    }
  };

  const handleLayerToggle = (index, visible, type = "polygon") => {
    setVisibleLayers((prev) => {
      const updated = { ...prev, [index]: visible };
      if (onLayerToggle) {
        onLayerToggle(updated, type);
      }
      return updated;
    });

    // If layer becomes invisible and it is the selected layer,
    // clear selection
    if (!visible) {
      if (type === "ring" && index === selectedRingIndex) {
        setSelectedRingIndex(null);
        if (onSelectRing) {
          onSelectRing(null);
        }
      } else if (type === "polygon" && index === selectedPolygonIndex) {
        setSelectedPolygonIndex(null);
        if (onSelectPolygon) {
          onSelectPolygon(null);
        }
      }
    }
  };

  // Display empty map with message if no data
  if (!geojson && !polygons) {
    return (
      <div className="map-container flex items-center justify-center bg-gray-100">
        <div className="text-center p-8">
          <i className="fas fa-upload text-4xl text-gray-400 mb-4"></i>
          <p className="text-gray-500">
            Upload GeoJSON to see visualization
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container">
      <MapContainer
        style={{ height: "100%", width: "100%" }}
        center={[0, 0]}
        zoom={2}
        scrollWheelZoom={true}
        zoomControl={false}
        ref={mapRef}
      >
        <ZoomControl position="bottomright" />

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Terrain">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {mapBounds && <MapBounds bounds={mapBounds} />}

        {/* Display original GeoJSON if no specific polygons */}
        {!polygons && geojson && (
          <GeoJSON
            data={geojson}
            style={{ color: "#3388ff", weight: 2, fillOpacity: 0.4 }}
          />
        )}

        {/* Display individual polygons if available */}
        {polygons &&
          polygons.map(
            (polygon, index) =>
              visibleLayers[index] && (
                <GeoJSON
                  key={`polygon-${index}`}
                  data={createPolygonGeoJSON(polygon)}
                  style={() => getItemStyle(index, "polygon")}
                  eventHandlers={{
                    click: () => handlePolygonClick(index),
                  }}
                />
              )
          )}
      </MapContainer>

      {/* Layer Control Panel */}
      {polygons && polygons.length > 1 && (
        <div className="layer-control">
          <h3 className="font-medium text-sm mb-2">Polygon Layers</h3>
          {polygons.map((polygon, index) => (
            <div key={`layer-${index}`} className="layer-item">
              <input
                type="checkbox"
                id={`layer-${index}`}
                className="layer-checkbox"
                checked={visibleLayers[index] || false}
                onChange={(e) => handleLayerToggle(index, e.target.checked)}
              />
              <label htmlFor={`layer-${index}`} className="text-sm">
                Polygon {index + 1}
                <div className="layer-legend">
                  <div
                    className="color-square"
                    style={{
                      backgroundColor: getItemStyle(index, "polygon").fillColor,
                    }}
                  ></div>
                  <span className="text-xs text-gray-600">
                    {(polygon.area / 1000000).toFixed(2)} km²
                  </span>
                </div>
              </label>
            </div>
          ))}
          <hr className="my-2" />
          <div className="flex justify-between">
            <button
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={() => {
                const allVisible = Object.values(visibleLayers).some((v) => !v);
                const newState = {};
                polygons.forEach((_, i) => {
                  newState[i] = allVisible;
                });
                setVisibleLayers(newState);
                if (onLayerToggle) onLayerToggle(newState);
              }}
            >
              {Object.values(visibleLayers).some((v) => !v)
                ? "Show All"
                : "Hide All"}
            </button>
            {selectedPolygonIndex !== null && (
              <button
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={() => {
                  handlePolygonClick(null);
                }}
              >
                Clear Selection
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
