import * as turf from "@turf/turf";

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI_ATTRIBUTION = "Tiles © Esri — World Imagery";

export const MAP_STYLES = {
  osm: {
    version: 8,
    sources: {
      "osm-tiles": {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: OSM_ATTRIBUTION,
        maxzoom: 19,
      },
    },
    layers: [
      { id: "osm", type: "raster", source: "osm-tiles" },
    ],
  },
  satellite: {
    version: 8,
    sources: {
      "esri-imagery": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: ESRI_ATTRIBUTION,
        maxzoom: 19,
      },
    },
    layers: [
      { id: "esri-imagery", type: "raster", source: "esri-imagery" },
    ],
  },
  terrain: {
    version: 8,
    sources: {
      "opentopo-tiles": {
        type: "raster",
        tiles: [
          "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
          "https://b.tile.opentopomap.org/{z}/{x}/{y}.png",
          "https://c.tile.opentopomap.org/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: `${OSM_ATTRIBUTION} · SRTM · © OpenTopoMap`,
        maxzoom: 17,
      },
    },
    layers: [
      { id: "opentopo", type: "raster", source: "opentopo-tiles" },
    ],
  },
};

export const MAP_STYLE_LABELS = {
  osm: "OpenStreetMap",
  satellite: "Satellite",
  terrain: "Terrain",
};

export function getGeojsonBounds(geojson) {
  if (!geojson) return null;
  try {
    const bbox = turf.bbox(geojson);
    if (
      !bbox ||
      bbox.some((v) => v === Infinity || v === -Infinity || Number.isNaN(v))
    ) {
      return null;
    }
    return [
      [bbox[0], bbox[1]],
      [bbox[2], bbox[3]],
    ];
  } catch {
    return null;
  }
}

function collectRenderableGeometries(geojson, out) {
  if (!geojson || typeof geojson !== "object") return;
  if (geojson.type === "FeatureCollection") {
    (geojson.features || []).forEach((f) => collectRenderableGeometries(f, out));
    return;
  }
  if (geojson.type === "Feature") {
    if (geojson.geometry) collectRenderableGeometries(geojson.geometry, out);
    return;
  }
  if (geojson.type === "GeometryCollection") {
    (geojson.geometries || []).forEach((g) => collectRenderableGeometries(g, out));
    return;
  }
  if (["Polygon", "MultiPolygon", "LineString", "MultiLineString", "Point", "MultiPoint"].includes(geojson.type)) {
    out.push(geojson);
  }
}

export const POLYGON_PALETTE = [
  "#3388ff",
  "#ff7f00",
  "#33a02c",
  "#e31a1c",
  "#6a3d9a",
  "#b15928",
  "#17becf",
  "#bcbd22",
  "#e377c2",
  "#8c564b",
];

export function flattenForRender(geojson) {
  if (!geojson) return { type: "FeatureCollection", features: [] };
  const geometries = [];
  collectRenderableGeometries(geojson, geometries);
  return {
    type: "FeatureCollection",
    features: geometries.map((geometry, i) => ({
      type: "Feature",
      properties: { polygonIndex: i, area: safePolygonArea(geometry) },
      geometry,
    })),
  };
}

function safePolygonArea(geometry) {
  try {
    if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
      return turf.area(geometry);
    }
  } catch {}
  return 0;
}

export function buildColorExpression(featureCount) {
  if (featureCount <= 1) return POLYGON_PALETTE[0];
  const expr = ["match", ["get", "polygonIndex"]];
  for (let i = 0; i < featureCount; i++) {
    expr.push(i, POLYGON_PALETTE[i % POLYGON_PALETTE.length]);
  }
  expr.push("#9ca3af");
  return expr;
}
