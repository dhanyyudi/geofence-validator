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
import * as turf from "@turf/turf";
import {
  MAP_STYLES,
  MAP_STYLE_LABELS,
} from "../utils/mapStyles";
import { useMapFit } from "../utils/useMapFit";

function combinedBounds(a, b) {
  try {
    const bbox1 = turf.bbox(a);
    const bbox2 = turf.bbox(b);
    return [
      [Math.min(bbox1[0], bbox2[0]), Math.min(bbox1[1], bbox2[1])],
      [Math.max(bbox1[2], bbox2[2]), Math.max(bbox1[3], bbox2[3])],
    ];
  } catch {
    return null;
  }
}

function extractPolygonFeature(geojson) {
  if (!geojson) return null;
  try {
    if (geojson.type === "FeatureCollection" && geojson.features?.length) {
      return extractPolygonFeature(geojson.features[0]);
    }
    if (geojson.type === "Feature") {
      const g = geojson.geometry;
      if (!g) return null;
      if (g.type === "Polygon") return turf.feature(g);
      if (g.type === "MultiPolygon" && g.coordinates?.length) {
        return turf.feature({ type: "Polygon", coordinates: g.coordinates[0] });
      }
    }
    if (geojson.type === "Polygon") return turf.feature(geojson);
    if (geojson.type === "MultiPolygon" && geojson.coordinates?.length) {
      return turf.feature({ type: "Polygon", coordinates: geojson.coordinates[0] });
    }
  } catch {
    return null;
  }
  return null;
}

function computeIntersection(a, b) {
  try {
    const result = turf.intersect(a, b);
    if (result) return result;
  } catch {}
  try {
    if (turf.booleanContains(a, b)) return b;
    if (turf.booleanContains(b, a)) return a;
  } catch {}
  return null;
}

const STYLES = {
  a: {
    fill: "#3388ff",
    outline: "#1d4ed8",
  },
  b: {
    fill: "#ff7800",
    outline: "#c2410c",
  },
  intersection: {
    fill: "#8e44ad",
    outline: "#581c87",
  },
};

export default function GeofenceComparisonMap({ comparisonData }) {
  const mapRef = useRef(null);
  const [styleKey, setStyleKey] = useState("osm");
  const [visibleLayers, setVisibleLayers] = useState({
    a: true,
    b: true,
    intersection: true,
  });

  const { polyA, polyB, intersection, areaA, areaB, areaI } = useMemo(() => {
    if (!comparisonData?.geojson1 || !comparisonData?.geojson2) {
      return { polyA: null, polyB: null, intersection: null, areaA: 0, areaB: 0, areaI: 0 };
    }
    const a = extractPolygonFeature(comparisonData.geojson1);
    const b = extractPolygonFeature(comparisonData.geojson2);
    if (!a || !b) return { polyA: null, polyB: null, intersection: null, areaA: 0, areaB: 0, areaI: 0 };
    const i = computeIntersection(a, b);
    return {
      polyA: a,
      polyB: b,
      intersection: i,
      areaA: turf.area(a),
      areaB: turf.area(b),
      areaI: i ? turf.area(i) : 0,
    };
  }, [comparisonData]);

  const bounds = useMemo(() => {
    if (!comparisonData?.geojson1 || !comparisonData?.geojson2) return null;
    return combinedBounds(comparisonData.geojson1, comparisonData.geojson2);
  }, [comparisonData]);

  const { handleLoad } = useMapFit(mapRef, bounds);

  const handleDownload = async () => {
    if (!mapRef.current) return;
    try {
      const map = mapRef.current.getMap?.();
      if (!map) return;
      map.once("render", () => {});
      map.triggerRepaint();
      await new Promise((r) => setTimeout(r, 120));
      const canvas = map.getCanvas();
      const imgData = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = imgData;
      a.download = "geofence-comparison.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error capturing map:", err);
      alert("Failed to download map. Please try again.");
    }
  };

  if (!comparisonData || !comparisonData.geojson1 || !comparisonData.geojson2) {
    return (
      <div className="h-[calc(100vh-128px)] bg-gray-100 flex items-center justify-center rounded-lg">
        <div className="text-center p-8">
          <i className="fas fa-map-marked-alt text-gray-400 text-4xl mb-3"></i>
          <p className="text-gray-600">
            Upload two geofence files to see comparison
          </p>
        </div>
      </div>
    );
  }

  const toggle = (key) =>
    setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="card-title flex items-center m-0">
          <i className="fas fa-map-marked-alt text-blue-500 mr-2"></i>
          Geofence Comparison
        </h2>

        <button
          onClick={handleDownload}
          className="btn btn-secondary flex items-center"
        >
          <i className="fas fa-download mr-2"></i>
          Download Map
        </button>
      </div>

      <div className="bg-white rounded-lg overflow-hidden shadow-md relative h-[calc(100vh-200px)]">
        <MaplibreMap
          ref={mapRef}
          initialViewState={{ longitude: 0, latitude: 0, zoom: 2 }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={MAP_STYLES[styleKey]}
          attributionControl={false}
          preserveDrawingBuffer
          onLoad={handleLoad}
        >
          <NavigationControl position="bottom-right" />
          <AttributionControl compact position="bottom-left" />

          {visibleLayers.a && polyA && (
            <Source id="src-a" type="geojson" data={polyA}>
              <Layer
                id="a-fill"
                type="fill"
                paint={{ "fill-color": STYLES.a.fill, "fill-opacity": 0.3 }}
              />
              <Layer
                id="a-line"
                type="line"
                paint={{ "line-color": STYLES.a.outline, "line-width": 3 }}
              />
            </Source>
          )}

          {visibleLayers.b && polyB && (
            <Source id="src-b" type="geojson" data={polyB}>
              <Layer
                id="b-fill"
                type="fill"
                paint={{ "fill-color": STYLES.b.fill, "fill-opacity": 0.3 }}
              />
              <Layer
                id="b-line"
                type="line"
                paint={{ "line-color": STYLES.b.outline, "line-width": 3 }}
              />
            </Source>
          )}

          {visibleLayers.intersection && intersection && (
            <Source id="src-int" type="geojson" data={intersection}>
              <Layer
                id="int-fill"
                type="fill"
                paint={{
                  "fill-color": STYLES.intersection.fill,
                  "fill-opacity": 0.5,
                }}
              />
              <Layer
                id="int-line"
                type="line"
                paint={{
                  "line-color": STYLES.intersection.outline,
                  "line-width": 2,
                }}
              />
            </Source>
          )}
        </MaplibreMap>

        <div className="absolute top-3 left-3 bg-white p-3 rounded-lg shadow-md z-10 min-w-[200px]">
          <h4 className="font-medium text-sm mb-2">Layers</h4>
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={visibleLayers.a}
                onChange={() => toggle("a")}
                className="mr-2"
              />
              <span className="text-sm flex items-center">
                <span
                  className="w-3 h-3 mr-2 rounded-full"
                  style={{ backgroundColor: STYLES.a.fill }}
                />
                {comparisonData.file1Name}
              </span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={visibleLayers.b}
                onChange={() => toggle("b")}
                className="mr-2"
              />
              <span className="text-sm flex items-center">
                <span
                  className="w-3 h-3 mr-2 rounded-full"
                  style={{ backgroundColor: STYLES.b.fill }}
                />
                {comparisonData.file2Name}
              </span>
            </label>
            {intersection && (
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleLayers.intersection}
                  onChange={() => toggle("intersection")}
                  className="mr-2"
                />
                <span className="text-sm flex items-center">
                  <span
                    className="w-3 h-3 mr-2 rounded-full"
                    style={{ backgroundColor: STYLES.intersection.fill }}
                  />
                  Intersection
                </span>
              </label>
            )}
          </div>
        </div>

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

        <div className="absolute bottom-8 right-4 bg-white p-3 rounded-lg shadow-md z-10 min-w-[200px]">
          <h4 className="font-medium text-sm mb-2">Legend</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center">
              <span
                className="w-4 h-4 mr-2 rounded"
                style={{ backgroundColor: STYLES.a.fill }}
              />
              {comparisonData.file1Name} — {(areaA / 1_000_000).toFixed(2)} km²
            </div>
            <div className="flex items-center">
              <span
                className="w-4 h-4 mr-2 rounded"
                style={{ backgroundColor: STYLES.b.fill }}
              />
              {comparisonData.file2Name} — {(areaB / 1_000_000).toFixed(2)} km²
            </div>
            <div className="flex items-center">
              <span
                className="w-4 h-4 mr-2 rounded"
                style={{ backgroundColor: STYLES.intersection.fill }}
              />
              Intersection — {(areaI / 1_000_000).toFixed(2)} km²
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="font-medium text-gray-700 mb-2">Comparison Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-500">First Geofence Area</div>
            <div className="text-lg font-semibold flex items-center">
              <span
                className="w-3 h-3 mr-2 rounded-full"
                style={{ backgroundColor: STYLES.a.fill }}
              />
              {(areaA / 1_000_000).toFixed(2)} km²
            </div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-500">Second Geofence Area</div>
            <div className="text-lg font-semibold flex items-center">
              <span
                className="w-3 h-3 mr-2 rounded-full"
                style={{ backgroundColor: STYLES.b.fill }}
              />
              {(areaB / 1_000_000).toFixed(2)} km²
            </div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-500">Intersection Area</div>
            <div className="text-lg font-semibold flex items-center">
              <span
                className="w-3 h-3 mr-2 rounded-full"
                style={{ backgroundColor: STYLES.intersection.fill }}
              />
              {(areaI / 1_000_000).toFixed(2)} km²
              {areaI === 0 && (
                <span className="ml-2 text-xs text-red-500">
                  (No overlap detected)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
