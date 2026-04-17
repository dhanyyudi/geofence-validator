"use client";

import { useMemo, useRef, useState } from "react";
import {
  Map as MaplibreMap,
  Source,
  Layer,
  Marker,
  NavigationControl,
  AttributionControl,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import {
  MAP_STYLES,
  MAP_STYLE_LABELS,
  POLYGON_PALETTE,
  buildColorExpression,
  getGeojsonBounds,
  flattenForRender,
} from "../utils/mapStyles";
import { useMapFit } from "../utils/useMapFit";

function safeCentroid(geometry) {
  try {
    const c = turf.centroid({ type: "Feature", properties: {}, geometry });
    return c?.geometry?.coordinates || null;
  } catch {
    return null;
  }
}

export default function GeofenceMapView({
  geojson,
  height = "24rem",
  showStyleSwitcher = true,
}) {
  const mapRef = useRef(null);
  const [styleKey, setStyleKey] = useState("osm");

  const baseRenderData = useMemo(() => flattenForRender(geojson), [geojson]);
  const bounds = useMemo(() => getGeojsonBounds(baseRenderData), [baseRenderData]);

  const polygonFeatures = useMemo(
    () =>
      baseRenderData.features.filter(
        (f) =>
          f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"
      ),
    [baseRenderData]
  );
  const multiPolygonMode = polygonFeatures.length > 1;

  const largestIndex = useMemo(() => {
    if (polygonFeatures.length === 0) return -1;
    let winner = polygonFeatures[0];
    for (const f of polygonFeatures) {
      if ((f.properties.area || 0) > (winner.properties.area || 0)) winner = f;
    }
    return winner.properties.polygonIndex;
  }, [polygonFeatures]);

  const renderData = useMemo(() => {
    if (!multiPolygonMode) return baseRenderData;
    const sorted = [...baseRenderData.features].sort(
      (a, b) => (b.properties.area || 0) - (a.properties.area || 0)
    );
    return { type: "FeatureCollection", features: sorted };
  }, [baseRenderData, multiPolygonMode]);

  const smallPolygons = useMemo(() => {
    if (!multiPolygonMode) return [];
    return polygonFeatures
      .filter((f) => f.properties.polygonIndex !== largestIndex)
      .map((f) => ({
        polygonIndex: f.properties.polygonIndex,
        area: f.properties.area,
        centroid: safeCentroid(f.geometry),
      }))
      .filter((m) => m.centroid);
  }, [polygonFeatures, multiPolygonMode, largestIndex]);

  const fillPaint = useMemo(
    () => ({
      "fill-color": buildColorExpression(polygonFeatures.length),
      "fill-opacity": multiPolygonMode ? 0.55 : 0.4,
    }),
    [polygonFeatures.length, multiPolygonMode]
  );

  const linePaint = useMemo(() => {
    if (!multiPolygonMode) {
      return { "line-color": "#1d4ed8", "line-width": 2.5 };
    }
    return {
      "line-color": buildColorExpression(polygonFeatures.length),
      "line-width": [
        "case",
        ["==", ["get", "polygonIndex"], largestIndex],
        3,
        4,
      ],
      "line-opacity": 1,
    };
  }, [multiPolygonMode, polygonFeatures.length, largestIndex]);

  const { handleLoad } = useMapFit(mapRef, bounds);

  if (!geojson) {
    return (
      <div
        className="bg-white rounded-lg shadow-md overflow-hidden flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center p-8">
          <i className="fas fa-map-marked-alt text-gray-300 text-5xl mb-4"></i>
          <p className="text-gray-500">No GeoJSON data available</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative bg-white rounded-lg shadow-md overflow-hidden"
      style={{ height }}
    >
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
        <Source id="geofence" type="geojson" data={renderData}>
          <Layer
            id="geofence-fill"
            type="fill"
            filter={[
              "any",
              ["==", ["geometry-type"], "Polygon"],
              ["==", ["geometry-type"], "MultiPolygon"],
            ]}
            paint={fillPaint}
          />
          <Layer id="geofence-line" type="line" paint={linePaint} />
        </Source>

        {smallPolygons.map((m) => (
          <Marker
            key={`pulse-${m.polygonIndex}`}
            longitude={m.centroid[0]}
            latitude={m.centroid[1]}
            anchor="center"
          >
            <div
              className="pulse-marker-wrapper"
              style={{
                color:
                  POLYGON_PALETTE[m.polygonIndex % POLYGON_PALETTE.length],
              }}
              aria-label={`Small polygon #${m.polygonIndex + 1}`}
            >
              <span className="pulse-marker-ring" />
              <span className="pulse-marker-ring delay" />
              <span className="pulse-marker-dot" />
            </div>
          </Marker>
        ))}
      </MaplibreMap>

      {showStyleSwitcher && (
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
      )}

      {multiPolygonMode && (
        <div className="absolute top-3 left-3 bg-white/95 rounded-lg shadow-md p-3 text-xs z-10 max-w-[240px]">
          <h4 className="font-semibold mb-2 text-gray-700">
            Polygons ({polygonFeatures.length})
          </h4>
          <ul className="space-y-1">
            {polygonFeatures.map((f) => {
              const idx = f.properties.polygonIndex;
              const isLargest = idx === largestIndex;
              return (
                <li key={idx} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded"
                    style={{
                      backgroundColor:
                        POLYGON_PALETTE[idx % POLYGON_PALETTE.length],
                    }}
                  />
                  <span className={isLargest ? "font-semibold" : ""}>
                    #{idx + 1}
                    {isLargest && " ★"} — {(f.properties.area / 1_000_000).toFixed(2)} km²
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 text-[10px] text-gray-500">
            ★ largest (kept by fix) · pulse = small polygon
          </div>
        </div>
      )}
    </div>
  );
}
