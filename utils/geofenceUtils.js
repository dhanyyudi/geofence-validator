import * as turf from "@turf/turf";

const ISSUE = {
  INVALID_GEOJSON: "invalid-geojson",
  INVALID_CRS: "invalid-crs",
  Z_COORDINATES: "z-coordinates",
  MULTIPLE_POLYGONS: "multiple-polygons",
  POLYGON_HOLES: "polygon-holes",
};

const FIX = {
  REMOVE_Z: "removeZ",
  PICK_LARGEST: "pickLargestPolygon",
  REMOVE_HOLES: "removeHoles",
};

const FIX_ORDER = [FIX.REMOVE_Z, FIX.PICK_LARGEST, FIX.REMOVE_HOLES];

export const ISSUE_TYPES = ISSUE;
export const FIX_IDS = FIX;

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function basicValidate(geojson) {
  if (!isPlainObject(geojson)) {
    return "GeoJSON must be an object.";
  }
  const valid = [
    "FeatureCollection",
    "Feature",
    "Point",
    "LineString",
    "Polygon",
    "MultiPoint",
    "MultiLineString",
    "MultiPolygon",
    "GeometryCollection",
  ];
  if (!valid.includes(geojson.type)) {
    return `GeoJSON type "${geojson.type}" is not valid.`;
  }
  if (geojson.type === "FeatureCollection" && !Array.isArray(geojson.features)) {
    return 'FeatureCollection must have a "features" array.';
  }
  if (geojson.type === "Feature" && !geojson.geometry) {
    return 'Feature must have a "geometry" property.';
  }
  return null;
}

function walkCoordinates(coords, visit) {
  if (!Array.isArray(coords) || coords.length === 0) return;
  if (typeof coords[0] === "number") {
    visit(coords);
    return;
  }
  for (const c of coords) walkCoordinates(c, visit);
}

function forEachGeometry(geojson, visit) {
  if (!geojson || typeof geojson !== "object") return;
  if (geojson.type === "FeatureCollection") {
    (geojson.features || []).forEach((f) => forEachGeometry(f, visit));
  } else if (geojson.type === "Feature") {
    if (geojson.geometry) forEachGeometry(geojson.geometry, visit);
  } else if (geojson.type === "GeometryCollection") {
    (geojson.geometries || []).forEach((g) => forEachGeometry(g, visit));
  } else if (geojson.type) {
    visit(geojson);
  }
}

function collectPolygons(geojson) {
  const polygons = [];
  forEachGeometry(geojson, (geom) => {
    if (geom.type === "Polygon") {
      polygons.push({ coordinates: geom.coordinates });
    } else if (geom.type === "MultiPolygon") {
      for (const polyCoords of geom.coordinates || []) {
        polygons.push({ coordinates: polyCoords });
      }
    }
  });
  return polygons;
}

function safeArea(coords) {
  try {
    return turf.area({ type: "Polygon", coordinates: coords });
  } catch {
    return 0;
  }
}

function stripZ(coords) {
  const out = [];
  walkCoordinates(coords, (point) => {
    if (point.length > 2) point.length = 2;
  });
  return coords;
}

function hasZ(coords) {
  let found = false;
  walkCoordinates(coords, (point) => {
    if (point.length > 2) found = true;
  });
  return found;
}

function hasOutOfRange(coords) {
  let bad = false;
  walkCoordinates(coords, (point) => {
    const [lon, lat] = point;
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) bad = true;
  });
  return bad;
}

function collectAllCoords(geojson) {
  const all = [];
  forEachGeometry(geojson, (geom) => {
    if (geom.coordinates) {
      walkCoordinates(geom.coordinates, (p) => all.push(p));
    }
  });
  return all;
}

function getSourceProperties(geojson) {
  if (
    geojson.type === "FeatureCollection" &&
    Array.isArray(geojson.features) &&
    geojson.features.length > 0
  ) {
    return geojson.features[0].properties || {};
  }
  if (geojson.type === "Feature") {
    return geojson.properties || {};
  }
  return {};
}

export function validateGeofence(geojson) {
  const result = {
    isValid: true,
    originalGeojson: geojson,
    errors: [],
    issues: [],
    stats: { polygonCount: 0, polygons: [] },
  };

  const invalid = basicValidate(geojson);
  if (invalid) {
    result.isValid = false;
    result.errors.push(`Invalid GeoJSON: ${invalid}`);
    return result;
  }

  const allCoords = collectAllCoords(geojson);
  if (allCoords.length === 0) {
    result.isValid = false;
    result.errors.push("No coordinates found in GeoJSON.");
    return result;
  }

  if (hasOutOfRange(allCoords)) {
    result.isValid = false;
    result.errors.push(
      "Invalid CRS: coordinates are outside lat/lon range. Reproject using QGIS or similar tools."
    );
  }

  if (allCoords.some((p) => p.length > 2)) {
    result.issues.push({
      id: ISSUE.Z_COORDINATES,
      severity: "warning",
      title: "Z-coordinates detected",
      description:
        "Geofence contains z (altitude) values which can cause compatibility issues.",
      fixId: FIX.REMOVE_Z,
    });
  }

  const polygons = collectPolygons(geojson);
  result.stats.polygonCount = polygons.length;
  result.stats.polygons = polygons.map((p, idx) => ({
    index: idx,
    area: safeArea(p.coordinates),
    ringCount: p.coordinates.length,
    pointCount: (p.coordinates[0] || []).length,
  }));

  if (polygons.length > 1) {
    const largest = result.stats.polygons.reduce((acc, p) =>
      p.area > acc.area ? p : acc
    );
    result.issues.push({
      id: ISSUE.MULTIPLE_POLYGONS,
      severity: "warning",
      title: `${polygons.length} polygons detected`,
      description: `Only one Polygon is allowed. Largest polygon is #${
        largest.index + 1
      } (${(largest.area / 1_000_000).toFixed(2)} km²). Apply fix to keep only the largest.`,
      fixId: FIX.PICK_LARGEST,
      metadata: { largestIndex: largest.index },
    });
  }

  const polygonWithHoles = polygons.find(
    (p) => Array.isArray(p.coordinates) && p.coordinates.length > 1
  );
  if (polygons.length === 1 && polygonWithHoles) {
    result.issues.push({
      id: ISSUE.POLYGON_HOLES,
      severity: "info",
      title: "Polygon has holes",
      description: `Polygon has ${polygonWithHoles.coordinates.length - 1} interior ring(s). Apply fix to remove holes and keep only the exterior ring.`,
      fixId: FIX.REMOVE_HOLES,
    });
  }

  return result;
}

function fixRemoveZ(geojson) {
  const clone = JSON.parse(JSON.stringify(geojson));
  forEachGeometry(clone, (geom) => {
    if (geom.coordinates) stripZ(geom.coordinates);
  });
  return clone;
}

function fixPickLargestPolygon(geojson) {
  const polygons = collectPolygons(geojson);
  if (polygons.length === 0) return geojson;

  let largest = polygons[0];
  let largestArea = safeArea(largest.coordinates);
  for (let i = 1; i < polygons.length; i++) {
    const a = safeArea(polygons[i].coordinates);
    if (a > largestArea) {
      largest = polygons[i];
      largestArea = a;
    }
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: getSourceProperties(geojson),
        geometry: {
          type: "Polygon",
          coordinates: largest.coordinates,
        },
      },
    ],
  };
}

function fixRemoveHoles(geojson) {
  const clone = JSON.parse(JSON.stringify(geojson));
  forEachGeometry(clone, (geom) => {
    if (geom.type === "Polygon" && Array.isArray(geom.coordinates)) {
      geom.coordinates = [geom.coordinates[0]];
    } else if (geom.type === "MultiPolygon" && Array.isArray(geom.coordinates)) {
      geom.coordinates = geom.coordinates.map((poly) => [poly[0]]);
    }
  });
  return clone;
}

const FIX_REGISTRY = {
  [FIX.REMOVE_Z]: fixRemoveZ,
  [FIX.PICK_LARGEST]: fixPickLargestPolygon,
  [FIX.REMOVE_HOLES]: fixRemoveHoles,
};

export function applyFixes(geojson, fixIds) {
  if (!Array.isArray(fixIds) || fixIds.length === 0) return geojson;
  const ordered = FIX_ORDER.filter((id) => fixIds.includes(id));
  let current = geojson;
  for (const id of ordered) {
    const fn = FIX_REGISTRY[id];
    if (fn) current = fn(current);
  }
  return ensureStandardFormat(current);
}

export function ensureStandardFormat(geojson) {
  if (!geojson || typeof geojson !== "object") return geojson;

  if (
    geojson.type === "FeatureCollection" &&
    Array.isArray(geojson.features) &&
    geojson.features.length === 1 &&
    geojson.features[0].geometry?.type === "Polygon"
  ) {
    return geojson;
  }

  const polygons = collectPolygons(geojson);
  if (polygons.length === 0) return geojson;

  const target =
    polygons.length === 1
      ? polygons[0]
      : polygons.reduce((a, b) =>
          safeArea(b.coordinates) > safeArea(a.coordinates) ? b : a
        );

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: getSourceProperties(geojson),
        geometry: {
          type: "Polygon",
          coordinates: target.coordinates,
        },
      },
    ],
  };
}

export function selectVisiblePolygons(geojson, visibleLayers) {
  const polygons = collectPolygons(geojson);
  const keys = Object.keys(visibleLayers || {}).filter((k) => visibleLayers[k]);
  if (keys.length === 0 || polygons.length === 0) {
    return ensureStandardFormat(geojson);
  }
  const idx = Math.min(Number(keys[0]) || 0, polygons.length - 1);
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: getSourceProperties(geojson),
        geometry: {
          type: "Polygon",
          coordinates: polygons[idx].coordinates,
        },
      },
    ],
  };
}
