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

// Komponen untuk menyesuaikan tampilan peta
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

  // Inisialisasi visibleLayers berdasarkan rings atau polygons
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

  // Hitung bounds untuk geojson
  useEffect(() => {
    if (geojson) {
      try {
        // Gunakan turf untuk mendapatkan bounding box
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

  // Fungsi untuk membuat GeoJSON dari satu polygon atau ring
  const createPolygonGeoJSON = (item, isRing = false) => {
    if (isRing) {
      // Jika item adalah ring, buat polygon dengan ring tersebut sebagai exterior
      return {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [item.coordinates], // Untuk ring, harus dibungkus dalam array
        },
      };
    } else {
      // Jika item adalah polygon, gunakan semua rings-nya
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

  // Style untuk polygon dan ring
  const getItemStyle = (index, type = "polygon") => {
    // Array warna untuk berbagai item
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

    // Jika item adalah ring interior, gunakan warna dengan transparansi lebih tinggi
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
      dashArray: isRingInterior ? "4, 4" : null, // Garis putus-putus untuk ring interior
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

    // Jika layer menjadi tidak terlihat dan itu adalah layer yang dipilih,
    // hapus seleksi
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

  // Tampilkan peta kosong dengan pesan jika tidak ada data
  if (!geojson && !polygons) {
    return (
      <div className="map-container flex items-center justify-center bg-gray-100">
        <div className="text-center p-8">
          <i className="fas fa-upload text-4xl text-gray-400 mb-4"></i>
          <p className="text-gray-500">
            Upload GeoJSON untuk melihat visualisasi
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

        {/* Tampilkan original GeoJSON jika tidak ada polygon khusus */}
        {!polygons && geojson && (
          <GeoJSON
            data={geojson}
            style={{ color: "#3388ff", weight: 2, fillOpacity: 0.4 }}
          />
        )}

        {/* Tampilkan polygon individual jika ada */}
        {polygons &&
          polygons.map(
            (polygon, index) =>
              visibleLayers[index] && (
                <GeoJSON
                  key={`polygon-${index}`}
                  data={createPolygonGeoJSON(polygon)}
                  style={() => getPolygonStyle(index)}
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
                      backgroundColor: getPolygonStyle(index).fillColor,
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
            {selectedIndex !== null && (
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
