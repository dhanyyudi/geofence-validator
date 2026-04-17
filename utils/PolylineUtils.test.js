import { describe, expect, it } from "vitest";
import {
  coordinatesToGeoJSON,
  decodePolyline,
  validateCoordinates,
} from "./PolylineUtils";
import {
  inferPrecisionFromGeometry,
  normalizePolylineInput,
} from "./OSRMUtils";

describe("normalizePolylineInput", () => {
  it("treats a raw polyline as direct input", () => {
    const result = normalizePolylineInput("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(result).toEqual({
      type: "polyline",
      value: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      inferredPrecision: null,
    });
  });

  it("extracts a polyline from a query string suffix", () => {
    const result = normalizePolylineInput(
      "_p~iF~ps|U_ulLnnqC_mqNvxq`@&geometries=polyline"
    );
    expect(result).toEqual({
      type: "embedded-polyline",
      value: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      inferredPrecision: 5,
    });
  });

  it("detects URL input and infers polyline6 precision", () => {
    const result = normalizePolylineInput(
      "https://example.com/route/v1/car/a;b?geometries=polyline6&steps=true"
    );
    expect(result).toEqual({
      type: "url",
      value:
        "https://example.com/route/v1/car/a;b?geometries=polyline6&steps=true",
      inferredPrecision: 6,
    });
  });
});

describe("inferPrecisionFromGeometry", () => {
  it("maps OSRM geometry values to polyline precision", () => {
    expect(inferPrecisionFromGeometry("polyline")).toBe(5);
    expect(inferPrecisionFromGeometry("polyline6")).toBe(6);
    expect(inferPrecisionFromGeometry("geojson")).toBeNull();
  });
});

describe("validateCoordinates", () => {
  it("accepts decoded coordinates for a valid polyline", () => {
    const coordinates = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@", 5);
    expect(validateCoordinates(coordinates)).toEqual(coordinates);
  });

  it("rejects garbage coordinates produced by decoding a URL", () => {
    const coordinates = decodePolyline(
      "https://mapbox-osrm-proxy.example.com/tdroute/v1/car/13.58,35.74;137.39,35.81?overview=full&steps=true&geometries=polyline6",
      6
    );
    expect(() => validateCoordinates(coordinates)).toThrow(
      /invalid near point 1/i
    );
  });

  it("builds GeoJSON directly from validated coordinates", () => {
    const coordinates = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@", 5);
    expect(coordinatesToGeoJSON(validateCoordinates(coordinates))).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates,
          },
        },
      ],
    });
  });
});
