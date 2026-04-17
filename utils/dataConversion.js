import * as turf from "@turf/turf";
import JSZip from "jszip";
import shp from "shpjs";
import { kml as kmlToGeoJSON } from "@tmcw/togeojson";
import {
  applyFixes,
  FIX_IDS,
  ISSUE_TYPES,
  validateGeofence,
} from "./geofenceUtils";

export const CONVERSION_FORMATS = {
  KML: "kml",
  KMZ: "kmz",
  SHP_ZIP: "shp-zip",
};

export const CONVERSION_FORMAT_LABELS = {
  [CONVERSION_FORMATS.KML]: "KML",
  [CONVERSION_FORMATS.KMZ]: "KMZ",
  [CONVERSION_FORMATS.SHP_ZIP]: "SHP ZIP",
};

const POLYGON_TYPES = new Set(["Polygon", "MultiPolygon"]);
const LINE_TYPES = new Set(["LineString", "MultiLineString"]);
const FIX_IDS_FOR_CONVERSION = [
  FIX_IDS.REMOVE_Z,
  FIX_IDS.PICK_LARGEST,
  FIX_IDS.REMOVE_HOLES,
];

export function detectConversionFormat(filename = "") {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".kml")) return CONVERSION_FORMATS.KML;
  if (lower.endsWith(".kmz")) return CONVERSION_FORMATS.KMZ;
  if (lower.endsWith(".zip")) return CONVERSION_FORMATS.SHP_ZIP;
  return null;
}

function createFeatureCollection(features) {
  return {
    type: "FeatureCollection",
    features: features || [],
  };
}

function ensureFeatureCollection(geojson) {
  if (!geojson) {
    throw new Error("Converted data did not produce GeoJSON.");
  }

  if (geojson.type === "FeatureCollection") {
    return createFeatureCollection(geojson.features || []);
  }

  if (geojson.type === "Feature") {
    return createFeatureCollection([geojson]);
  }

  if (geojson.type) {
    return createFeatureCollection([
      {
        type: "Feature",
        properties: {},
        geometry: geojson,
      },
    ]);
  }

  throw new Error("Converted data did not produce valid GeoJSON.");
}

function mergeFeatureCollections(collections) {
  return createFeatureCollection(
    collections.flatMap((collection) => collection.features || [])
  );
}

function parseKmlDocument(text) {
  if (typeof DOMParser === "undefined") {
    throw new Error("DOMParser is unavailable in this environment.");
  }

  const xml = new DOMParser().parseFromString(text, "text/xml");
  const parseErrors = xml.getElementsByTagName("parsererror");
  if (
    xml.documentElement?.nodeName === "parsererror" ||
    (parseErrors && parseErrors.length > 0)
  ) {
    throw new Error("Invalid KML XML.");
  }

  return xml;
}

export function parseKmlText(text) {
  const xml = parseKmlDocument(text);
  return ensureFeatureCollection(kmlToGeoJSON(xml));
}

export async function parseKmzBuffer(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const kmlFiles = Object.values(zip.files)
    .filter((entry) => !entry.dir && /\.kml$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (kmlFiles.length === 0) {
    throw new Error("KMZ archive does not contain a .kml file.");
  }

  const primary =
    kmlFiles.find((entry) => /(^|\/)doc\.kml$/i.test(entry.name)) || kmlFiles[0];
  const notes = [];

  if (kmlFiles.length > 1) {
    notes.push(
      `KMZ contained ${kmlFiles.length} KML files. Using ${primary.name}.`
    );
  }

  const text = await primary.async("string");
  return {
    geojson: parseKmlText(text),
    notes,
  };
}

export async function parseShapefileZip(buffer) {
  const parsed = await shp(buffer);
  const collections = Array.isArray(parsed)
    ? parsed.map((item) => ensureFeatureCollection(item))
    : [ensureFeatureCollection(parsed)];

  const notes = [];
  if (collections.length > 1) {
    notes.push(
      `ZIP contained ${collections.length} shapefiles. Features were merged before normalization.`
    );
  }

  return {
    geojson: mergeFeatureCollections(collections),
    notes,
  };
}

function summarizeGeojson(geojson) {
  const featureCollection = ensureFeatureCollection(geojson);
  const flattened = turf.flatten(featureCollection);
  const geometryTypes = Array.from(
    new Set(flattened.features.map((feature) => feature.geometry?.type).filter(Boolean))
  );

  return {
    featureCount: featureCollection.features.length,
    geometryTypes,
  };
}

function dropZCoordinates(value) {
  if (!Array.isArray(value)) return value;
  if (typeof value[0] === "number") {
    return value.slice(0, 2);
  }
  return value.map(dropZCoordinates);
}

function polygonizeLinework(featureCollection) {
  const flattened = turf.flatten(featureCollection);
  const lineFeatures = flattened.features
    .filter((feature) => LINE_TYPES.has(feature.geometry?.type))
    .map((feature) => ({
      type: "Feature",
      properties: feature.properties || {},
      geometry: {
        ...feature.geometry,
        coordinates: dropZCoordinates(feature.geometry.coordinates),
      },
    }));

  if (lineFeatures.length === 0) {
    throw new Error(
      "Only polygon data or closed linework can be converted into a clean geofence."
    );
  }

  const polygonized = turf.polygonize(createFeatureCollection(lineFeatures));
  if (!polygonized.features.length) {
    throw new Error(
      "Linework could not be polygonized. Provide polygon data or a clearly closed boundary."
    );
  }

  const baseProperties =
    lineFeatures.find((feature) => Object.keys(feature.properties || {}).length)
      ?.properties ||
    lineFeatures[0]?.properties ||
    {};

  return createFeatureCollection(
    polygonized.features.map((feature) => ({
      ...feature,
      properties: { ...baseProperties },
    }))
  );
}

export function normalizeConvertedGeojson(geojson) {
  const featureCollection = ensureFeatureCollection(geojson);
  const flattened = turf.flatten(featureCollection);
  const polygonFeatures = flattened.features.filter((feature) =>
    POLYGON_TYPES.has(feature.geometry?.type)
  );

  if (polygonFeatures.length > 0) {
    return {
      geojson: featureCollection,
      notes: [],
    };
  }

  return {
    geojson: polygonizeLinework(featureCollection),
    notes: ["Closed linework was polygonized into polygon features."],
  };
}

function buildNormalizationNotes(preValidation, baseNotes) {
  const notes = [...baseNotes];

  if (
    preValidation.issues.some(
      (issue) => issue.id === ISSUE_TYPES.Z_COORDINATES
    )
  ) {
    notes.push("Z coordinates were removed from the converted geometry.");
  }

  if (preValidation.stats?.polygonCount > 1) {
    notes.push("Only the largest polygon was kept to match validator requirements.");
  }

  if (
    preValidation.issues.some((issue) => issue.id === "polygon-holes")
  ) {
    notes.push("Interior holes were removed to keep only the exterior boundary.");
  }

  return notes;
}

function validateCleanGeojson(geojson) {
  const validationResult = validateGeofence(geojson);
  const remainingIssues = validationResult.issues || [];

  if (!validationResult.isValid) {
    throw new Error(validationResult.errors.join(" "));
  }

  if (remainingIssues.length > 0) {
    throw new Error(
      "Converted GeoJSON still does not satisfy validator requirements."
    );
  }

  return validationResult;
}

export function convertParsedGeojson(parsedGeojson, sourceFormat = "GeoJSON", extraNotes = []) {
  const summary = summarizeGeojson(parsedGeojson);
  if (summary.featureCount === 0) {
    throw new Error("No features were found in the uploaded file.");
  }

  const normalized = normalizeConvertedGeojson(parsedGeojson);
  const preValidation = validateGeofence(normalized.geojson);
  const cleanedGeojson = applyFixes(
    normalized.geojson,
    FIX_IDS_FOR_CONVERSION
  );
  const validationResult = validateCleanGeojson(cleanedGeojson);

  return {
    sourceFormat,
    sourceFormatKey: sourceFormat.toLowerCase(),
    originalGeojson: parsedGeojson,
    cleanedGeojson,
    notes: buildNormalizationNotes(preValidation, [
      ...extraNotes,
      ...normalized.notes,
    ]),
    validationResult,
    summary,
  };
}

export async function convertSpatialFile(file) {
  if (!file?.name) {
    throw new Error("A spatial file is required.");
  }

  const format = detectConversionFormat(file.name);
  if (!format) {
    throw new Error("Unsupported file type. Use .kml, .kmz, or .zip.");
  }

  let parsedGeojson;
  let parseNotes = [];

  if (format === CONVERSION_FORMATS.KML) {
    parsedGeojson = parseKmlText(await file.text());
  } else if (format === CONVERSION_FORMATS.KMZ) {
    const parsed = await parseKmzBuffer(await file.arrayBuffer());
    parsedGeojson = parsed.geojson;
    parseNotes = parsed.notes;
  } else {
    const parsed = await parseShapefileZip(await file.arrayBuffer());
    parsedGeojson = parsed.geojson;
    parseNotes = parsed.notes;
  }

  const converted = convertParsedGeojson(
    parsedGeojson,
    CONVERSION_FORMAT_LABELS[format],
    parseNotes
  );

  return {
    ...converted,
    sourceFormatKey: format,
  };
}
