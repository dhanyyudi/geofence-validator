"use client";

import { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  ZoomControl,
} from "react-leaflet";
import * as turf from "@turf/turf";

// Component for adjusting map view
function MapBounds({ bounds }) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds);
    }
  }, [bounds, map]);

  return null;
}

export default function PolylineViewer({ conversionResult }) {
  const [mapBounds, setMapBounds] = useState(null);
  const [copySuccess, setCopySuccess] = useState(null);
  const [coordinatesVisible, setCoordinatesVisible] = useState(false);
  const mapRef = useRef(null);
  const coordTextareaRef = useRef(null);

  // Calculate bounds for the map
  useEffect(() => {
    if (!conversionResult || !conversionResult.success) return;

    try {
      // Use turf to get the bounding box
      const bbox = turf.bbox(conversionResult.geojson);

      // Convert turf bbox [minX, minY, maxX, maxY] to Leaflet bounds [[minY, minX], [maxY, maxX]]
      const bounds = [
        [bbox[1], bbox[0]], // SW corner [lat, lng]
        [bbox[3], bbox[2]], // NE corner [lat, lng]
      ];

      setMapBounds(bounds);
    } catch (error) {
      console.error("Error calculating bounds:", error);
    }
  }, [conversionResult]);

  const handleDownloadGeoJSON = () => {
    if (!conversionResult || !conversionResult.success) return;

    const jsonString = JSON.stringify(conversionResult.geojson, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "polyline_decoded.geojson";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyCoordinates = () => {
    if (!conversionResult || !conversionResult.success) return;

    // Format coordinates as a readable list
    const formattedCoords = conversionResult.coordinates
      .map((coord) => `[${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}]`)
      .join(",\n");

    navigator.clipboard
      .writeText(`[\n${formattedCoords}\n]`)
      .then(() => {
        setCopySuccess("Coordinates copied!");
        setTimeout(() => setCopySuccess(null), 2000);
      })
      .catch((err) => {
        console.error("Error copying coordinates:", err);
        setCopySuccess("Failed to copy");
      });
  };

  const toggleCoordinatesVisibility = () => {
    setCoordinatesVisible(!coordinatesVisible);
  };

  // Style for the GeoJSON feature
  const geoJSONStyle = {
    color: "#3388ff",
    weight: 4,
    opacity: 0.8,
    fillColor: "#3388ff",
    fillOpacity: 0.2,
  };

  if (!conversionResult || !conversionResult.success) {
    return (
      <div className="h-[calc(100vh-200px)] bg-white rounded-lg shadow-md overflow-hidden flex items-center justify-center">
        <div className="text-center p-8">
          <i className="fas fa-route text-gray-300 text-5xl mb-4"></i>
          <p className="text-gray-500">
            Enter an encoded polyline to see visualization
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center">
            <i className="fas fa-map-marked-alt mr-2 text-blue-500"></i>
            Decoded Polyline
          </h3>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleCoordinatesVisibility}
              className="btn btn-outline py-1 px-3 text-sm"
            >
              <i className={`fas fa-list mr-1`}></i>
              {coordinatesVisible ? "Hide Coordinates" : "Show Coordinates"}
            </button>

            <button
              onClick={handleCopyCoordinates}
              className="btn btn-outline py-1 px-3 text-sm"
            >
              <i className="fas fa-copy mr-1"></i>
              Copy
              {copySuccess && (
                <span className="text-xs text-green-500 ml-1">
                  {copySuccess}
                </span>
              )}
            </button>

            <button
              onClick={handleDownloadGeoJSON}
              className="btn btn-primary py-1 px-3 text-sm"
            >
              <i className="fas fa-download mr-1"></i>
              Download GeoJSON
            </button>
          </div>
        </div>
      </div>

      {coordinatesVisible && (
        <div className="p-4 border-b bg-gray-50">
          <div className="text-sm text-gray-600 mb-2">
            <span className="font-medium">Coordinates</span>
            <span className="ml-2 text-xs">
              ({conversionResult.coordinates.length} points,{" "}
              {conversionResult.outputType === "polygon"
                ? "Polygon"
                : "LineString"}
              )
            </span>
          </div>
          <div className="relative">
            <textarea
              ref={coordTextareaRef}
              readOnly
              value={conversionResult.coordinates
                .map(
                  (coord) => `[${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}]`
                )
                .join(",\n")}
              className="w-full p-3 border border-gray-300 rounded-lg bg-white text-xs font-mono h-48 overflow-auto"
            />
          </div>
        </div>
      )}

      <div className="h-[calc(100vh-300px)]">
        <MapContainer
          style={{ height: "100%", width: "100%" }}
          center={[0, 0]}
          zoom={2}
          scrollWheelZoom={true}
          zoomControl={false}
          ref={mapRef}
        >
          <ZoomControl position="bottomright" />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {mapBounds && <MapBounds bounds={mapBounds} />}

          <GeoJSON data={conversionResult.geojson} style={geoJSONStyle} />
        </MapContainer>
      </div>

      <div className="p-4 bg-gray-50 border-t">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700">
              Input Polyline
            </h4>
            <div className="mt-1 p-2 bg-white border border-gray-300 rounded-lg">
              <div className="max-h-16 overflow-auto text-xs font-mono break-all">
                {conversionResult.encodedPolyline}
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700">Stats</h4>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="p-2 bg-white border border-gray-300 rounded-lg">
                <div className="text-xs text-gray-500">Points</div>
                <div className="font-medium">
                  {conversionResult.coordinates.length}
                </div>
              </div>
              <div className="p-2 bg-white border border-gray-300 rounded-lg">
                <div className="text-xs text-gray-500">Type</div>
                <div className="font-medium capitalize">
                  {conversionResult.outputType}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
