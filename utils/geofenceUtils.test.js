import { describe, it, expect } from "vitest";
import {
  validateGeofence,
  applyFixes,
  ensureStandardFormat,
  FIX_IDS,
  ISSUE_TYPES,
} from "./geofenceUtils";

const square = (cx, cy, size = 0.01) => [
  [cx, cy],
  [cx + size, cy],
  [cx + size, cy + size],
  [cx, cy + size],
  [cx, cy],
];

const withZ = (ring) => ring.map((p) => [p[0], p[1], 0]);

const featurePolygon = (coords) => ({
  type: "Feature",
  properties: {},
  geometry: { type: "Polygon", coordinates: [coords] },
});

const featureCollection = (...features) => ({
  type: "FeatureCollection",
  features,
});

describe("validateGeofence", () => {
  it("accepts a clean single Polygon FeatureCollection", () => {
    const gj = featureCollection(featurePolygon(square(0, 0)));
    const r = validateGeofence(gj);
    expect(r.isValid).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.issues).toHaveLength(0);
  });

  it("flags z-coordinates as a fixable issue", () => {
    const gj = featureCollection(featurePolygon(withZ(square(0, 0))));
    const r = validateGeofence(gj);
    expect(r.isValid).toBe(true);
    const z = r.issues.find((i) => i.id === ISSUE_TYPES.Z_COORDINATES);
    expect(z).toBeDefined();
    expect(z.fixId).toBe(FIX_IDS.REMOVE_Z);
  });

  it("flags multiple polygons inside GeometryCollection", () => {
    const gj = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "GeometryCollection",
            geometries: [
              { type: "Polygon", coordinates: [square(0, 0, 0.01)] },
              { type: "Polygon", coordinates: [square(10, 10, 0.5)] },
            ],
          },
        },
      ],
    };
    const r = validateGeofence(gj);
    const multi = r.issues.find((i) => i.id === ISSUE_TYPES.MULTIPLE_POLYGONS);
    expect(multi).toBeDefined();
    expect(r.stats.polygonCount).toBe(2);
    expect(multi.metadata.largestIndex).toBe(1);
  });

  it("detects BOTH z-coords AND multiple polygons simultaneously", () => {
    const gj = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "GeometryCollection",
            geometries: [
              { type: "Polygon", coordinates: [withZ(square(0, 0, 0.01))] },
              { type: "Polygon", coordinates: [withZ(square(10, 10, 0.5))] },
            ],
          },
        },
      ],
    };
    const r = validateGeofence(gj);
    const ids = r.issues.map((i) => i.id);
    expect(ids).toContain(ISSUE_TYPES.Z_COORDINATES);
    expect(ids).toContain(ISSUE_TYPES.MULTIPLE_POLYGONS);
  });

  it("rejects invalid CRS coordinates", () => {
    const gj = featureCollection(
      featurePolygon([
        [5000, 6000],
        [5001, 6000],
        [5001, 6001],
        [5000, 6001],
        [5000, 6000],
      ])
    );
    const r = validateGeofence(gj);
    expect(r.isValid).toBe(false);
    expect(r.errors.some((e) => e.includes("CRS"))).toBe(true);
  });
});

describe("applyFixes", () => {
  it("removes z-coordinates", () => {
    const gj = featureCollection(featurePolygon(withZ(square(0, 0))));
    const out = applyFixes(gj, [FIX_IDS.REMOVE_Z]);
    const coords = out.features[0].geometry.coordinates[0];
    expect(coords.every((p) => p.length === 2)).toBe(true);
  });

  it("picks the largest polygon from a GeometryCollection", () => {
    const small = square(0, 0, 0.01);
    const big = square(10, 10, 0.5);
    const gj = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "GeometryCollection",
            geometries: [
              { type: "Polygon", coordinates: [small] },
              { type: "Polygon", coordinates: [big] },
            ],
          },
        },
      ],
    };
    const out = applyFixes(gj, [FIX_IDS.PICK_LARGEST]);
    expect(out.type).toBe("FeatureCollection");
    expect(out.features[0].geometry.type).toBe("Polygon");
    expect(out.features[0].geometry.coordinates[0]).toEqual(big);
  });

  it("chains removeZ + pickLargestPolygon in one pipeline", () => {
    const gj = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "test" },
          geometry: {
            type: "GeometryCollection",
            geometries: [
              { type: "Polygon", coordinates: [withZ(square(0, 0, 0.01))] },
              { type: "Polygon", coordinates: [withZ(square(10, 10, 0.5))] },
              { type: "Polygon", coordinates: [withZ(square(20, 20, 0.2))] },
            ],
          },
        },
      ],
    };
    const out = applyFixes(gj, [FIX_IDS.REMOVE_Z, FIX_IDS.PICK_LARGEST]);
    expect(out.type).toBe("FeatureCollection");
    expect(out.features).toHaveLength(1);
    expect(out.features[0].geometry.type).toBe("Polygon");
    const coords = out.features[0].geometry.coordinates;
    expect(coords.length).toBe(1);
    expect(coords[0].every((p) => p.length === 2)).toBe(true);
    expect(out.features[0].properties.name).toBe("test");
  });

  it("handles MultiPolygon input with pickLargest", () => {
    const gj = featureCollection({
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [[square(0, 0, 0.01)], [square(5, 5, 0.5)]],
      },
    });
    const out = applyFixes(gj, [FIX_IDS.PICK_LARGEST]);
    expect(out.features[0].geometry.type).toBe("Polygon");
    expect(out.features[0].geometry.coordinates[0]).toEqual(square(5, 5, 0.5));
  });

  it("normalizes MultiPolygon on Z-only fix via ensureStandardFormat", () => {
    const gj = featureCollection({
      type: "Feature",
      properties: {},
      geometry: {
        type: "MultiPolygon",
        coordinates: [[withZ(square(0, 0, 0.01))], [withZ(square(5, 5, 0.5))]],
      },
    });
    const out = applyFixes(gj, [FIX_IDS.REMOVE_Z]);
    expect(out.features[0].geometry.type).toBe("Polygon");
    const coords = out.features[0].geometry.coordinates[0];
    expect(coords.every((p) => p.length === 2)).toBe(true);
  });

  it("returns input unchanged when no fix ids given", () => {
    const gj = featureCollection(featurePolygon(square(0, 0)));
    expect(applyFixes(gj, [])).toBe(gj);
  });
});

describe("ensureStandardFormat", () => {
  it("keeps a single-Polygon FeatureCollection as-is", () => {
    const gj = featureCollection(featurePolygon(square(0, 0)));
    expect(ensureStandardFormat(gj)).toBe(gj);
  });

  it("picks largest when multiple polygons present", () => {
    const gj = featureCollection(
      featurePolygon(square(0, 0, 0.01)),
      featurePolygon(square(10, 10, 0.5))
    );
    const out = ensureStandardFormat(gj);
    expect(out.features).toHaveLength(1);
    expect(out.features[0].geometry.coordinates[0]).toEqual(square(10, 10, 0.5));
  });
});

describe("regression: user-provided Nagoya geofence", () => {
  const nagoya = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "GeometryCollection",
          geometries: [
            {
              type: "Polygon",
              coordinates: [
                [
                  [136.8355679, 34.8911405, 0],
                  [136.8350176, 34.8909325, 0],
                  [136.8356802, 34.8896981, 0],
                  [136.8364259, 34.8897813, 0],
                  [136.8355679, 34.8911405, 0],
                ],
              ],
            },
            {
              type: "Polygon",
              coordinates: [
                [
                  [136.8275174, 34.9351561, 0],
                  [136.8277776, 34.9357916, 0],
                  [136.8274235, 34.9358488, 0],
                  [136.8270667, 34.9352374, 0],
                  [136.8275174, 34.9351561, 0],
                ],
              ],
            },
            {
              type: "Polygon",
              coordinates: [
                [
                  [136.8321779, 34.8948669, 0],
                  [136.8361534, 34.8965468, 0],
                  [136.8382484, 34.8974087, 0],
                  [136.8403865, 34.8980066, 0],
                  [136.8473723, 34.8986468, 0],
                  [136.8537948, 34.8997409, 0],
                  [136.8535749, 34.9017437, 0],
                  [136.8506941, 34.9022683, 0],
                  [136.8321779, 34.8948669, 0],
                ],
              ],
            },
          ],
        },
        properties: { name: "鬼崎エリア" },
      },
    ],
  };

  it("detects both z-coordinates and multiple polygons", () => {
    const r = validateGeofence(nagoya);
    const ids = r.issues.map((i) => i.id);
    expect(ids).toContain(ISSUE_TYPES.Z_COORDINATES);
    expect(ids).toContain(ISSUE_TYPES.MULTIPLE_POLYGONS);
    expect(r.stats.polygonCount).toBe(3);
  });

  it("applying both fixes yields clean single Polygon (largest kept)", () => {
    const out = applyFixes(nagoya, [FIX_IDS.REMOVE_Z, FIX_IDS.PICK_LARGEST]);
    expect(out.type).toBe("FeatureCollection");
    expect(out.features).toHaveLength(1);
    expect(out.features[0].geometry.type).toBe("Polygon");
    const ring = out.features[0].geometry.coordinates[0];
    expect(ring.every((p) => p.length === 2)).toBe(true);
    expect(ring[0]).toEqual([136.8321779, 34.8948669]);
    expect(out.features[0].properties.name).toBe("鬼崎エリア");
  });
});
