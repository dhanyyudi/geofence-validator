"use client";

import { useMemo, useRef, useState } from "react";
import {
  Map as MaplibreMap,
  Source,
  Layer,
  NavigationControl,
  AttributionControl,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MAP_STYLES,
  MAP_STYLE_LABELS,
  getGeojsonBounds,
} from "../utils/mapStyles";
import { useMapFit } from "../utils/useMapFit";

export default function PolylineViewer({ conversionResult }) {
  const mapRef = useRef(null);
  const [styleKey, setStyleKey] = useState("osm");
  const [copySuccess, setCopySuccess] = useState(null);
  const [coordinatesVisible, setCoordinatesVisible] = useState(false);
  const coordTextareaRef = useRef(null);

  const bounds = useMemo(() => {
    if (!conversionResult?.success) return null;
    return getGeojsonBounds(conversionResult.geojson);
  }, [conversionResult]);

  const { handleLoad } = useMapFit(mapRef, bounds);

  const handleDownloadGeoJSON = () => {
    if (!conversionResult?.success) return;
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
    if (!conversionResult?.success) return;
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

  const isPolygon = conversionResult.outputType === "polygon";

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center">
            <i className="fas fa-map-marked-alt mr-2 text-blue-500"></i>
            Decoded Polyline
            {conversionResult.segmentInfo &&
              conversionResult.segmentInfo.type !== "overall" && (
                <span className="ml-2 text-sm font-normal text-gray-600">
                  {conversionResult.segmentInfo.type === "leg"
                    ? `(Leg ${conversionResult.segmentInfo.legIndex + 1})`
                    : `(Step ${
                        conversionResult.segmentInfo.stepIndex + 1
                      } of Leg ${conversionResult.segmentInfo.legIndex + 1})`}
                </span>
              )}
          </h3>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCoordinatesVisible((v) => !v)}
              className="btn btn-outline py-1 px-3 text-sm"
            >
              <i className="fas fa-list mr-1"></i>
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
              {isPolygon ? "Polygon" : "LineString"})
            </span>
          </div>
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
      )}

      <div className="h-[calc(100vh-300px)] relative">
        <MaplibreMap
          ref={mapRef}
          initialViewState={{ longitude: 0, latitude: 0, zoom: 2 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={MAP_STYLES[styleKey]}
          attributionControl={false}
          onLoad={handleLoad}
        >
          <NavigationControl position="bottom-right" />
          <AttributionControl compact position="bottom-left" />
          <Source id="polyline" type="geojson" data={conversionResult.geojson}>
            {isPolygon && (
              <Layer
                id="polyline-fill"
                type="fill"
                paint={{ "fill-color": "#3388ff", "fill-opacity": 0.2 }}
              />
            )}
            <Layer
              id="polyline-line"
              type="line"
              paint={{
                "line-color": "#1d4ed8",
                "line-width": 4,
                "line-opacity": 0.85,
              }}
            />
          </Source>
        </MaplibreMap>

        <div className="absolute top-3 right-3 bg-white/95 rounded-lg shadow-md p-2 text-xs z-10">
          <select
            value={styleKey}
            onChange={(e) => setStyleKey(e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 bg-white"
            aria-label="Base layer"
          >
            {Object.keys(MAP_STYLES).map((k) => (
              <option key={k} value={k}>
                {MAP_STYLE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
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

              {conversionResult.metadata?.distance && (
                <div className="p-2 bg-white border border-gray-300 rounded-lg">
                  <div className="text-xs text-gray-500">Distance</div>
                  <div className="font-medium">
                    {(conversionResult.metadata.distance / 1000).toFixed(1)} km
                  </div>
                </div>
              )}

              {conversionResult.metadata?.duration && (
                <div className="p-2 bg-white border border-gray-300 rounded-lg">
                  <div className="text-xs text-gray-500">Duration</div>
                  <div className="font-medium">
                    {Math.floor(conversionResult.metadata.duration / 60)} min
                  </div>
                </div>
              )}

              {conversionResult.metadata?.segment && (
                <div className="col-span-2 p-2 bg-white border border-gray-300 rounded-lg">
                  <div className="text-xs text-gray-500">Segment</div>
                  <div className="font-medium text-sm">
                    {conversionResult.metadata.segment}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
