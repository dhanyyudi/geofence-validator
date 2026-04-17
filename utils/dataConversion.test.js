import { beforeAll, describe, expect, it } from "vitest";
import JSZip from "jszip";
import shpwrite from "shp-write";
import { DOMParser as XMLDOMParser } from "@xmldom/xmldom";
import {
  convertParsedGeojson,
  convertSpatialFile,
} from "./dataConversion";

function toArrayBuffer(data) {
  const view = data instanceof Uint8Array ? data : new Uint8Array(data);
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

function textFile(name, text) {
  return {
    name,
    size: text.length,
    async text() {
      return text;
    },
    async arrayBuffer() {
      return new TextEncoder().encode(text).buffer;
    },
  };
}

function binaryFile(name, data) {
  const arrayBuffer = toArrayBuffer(data);
  return {
    name,
    size: arrayBuffer.byteLength,
    async text() {
      return new TextDecoder().decode(arrayBuffer);
    },
    async arrayBuffer() {
      return arrayBuffer;
    },
  };
}

function makePolygon(coords, properties = {}) {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Polygon",
      coordinates: [coords],
    },
  };
}

beforeAll(() => {
  globalThis.DOMParser = XMLDOMParser;
});

describe("convertSpatialFile", () => {
  it("converts a KML polygon to clean GeoJSON", async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <Placemark>
            <name>Boundary</name>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>
                    103.8000,1.3000,0 103.8100,1.3000,0 103.8100,1.3100,0 103.8000,1.3100,0 103.8000,1.3000,0
                  </coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </Document>
      </kml>`;

    const result = await convertSpatialFile(textFile("boundary.kml", kml));

    expect(result.sourceFormat).toBe("KML");
    expect(result.cleanedGeojson.features).toHaveLength(1);
    expect(result.cleanedGeojson.features[0].geometry.type).toBe("Polygon");
    expect(result.validationResult.isValid).toBe(true);
    expect(result.validationResult.issues).toHaveLength(0);
  });

  it("converts a KMZ archive with one KML file", async () => {
    const zip = new JSZip();
    zip.file(
      "doc.kml",
      `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Placemark>
            <Polygon>
              <outerBoundaryIs>
                <LinearRing>
                  <coordinates>
                    103.7000,1.2000 103.7100,1.2000 103.7100,1.2100 103.7000,1.2100 103.7000,1.2000
                  </coordinates>
                </LinearRing>
              </outerBoundaryIs>
            </Polygon>
          </Placemark>
        </kml>`
    );

    const kmz = await zip.generateAsync({ type: "uint8array" });
    const result = await convertSpatialFile(binaryFile("boundary.kmz", kmz));

    expect(result.sourceFormat).toBe("KMZ");
    expect(result.cleanedGeojson.features[0].geometry.type).toBe("Polygon");
  });

  it("converts a zipped shapefile polygon", async () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        makePolygon(
          [
            [103.9, 1.35],
            [103.91, 1.35],
            [103.91, 1.36],
            [103.9, 1.36],
            [103.9, 1.35],
          ],
          { name: "shp-area" }
        ),
      ],
    };

    const zip = shpwrite.zip(geojson);
    const result = await convertSpatialFile(binaryFile("boundary.zip", zip));

    expect(result.sourceFormat).toBe("SHP ZIP");
    expect(result.cleanedGeojson.features[0].properties.name).toBe("shp-area");
    expect(result.cleanedGeojson.features[0].geometry.type).toBe("Polygon");
  });
});

describe("convertParsedGeojson", () => {
  it("keeps the largest polygon and preserves its properties", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        makePolygon(
          [
            [0, 0],
            [0.01, 0],
            [0.01, 0.01],
            [0, 0.01],
            [0, 0],
          ],
          { name: "small" }
        ),
        makePolygon(
          [
            [10, 10],
            [10.5, 10],
            [10.5, 10.5],
            [10, 10.5],
            [10, 10],
          ],
          { name: "large" }
        ),
      ],
    };

    const result = convertParsedGeojson(geojson, "GeoJSON");

    expect(result.cleanedGeojson.features).toHaveLength(1);
    expect(result.cleanedGeojson.features[0].properties.name).toBe("large");
    expect(result.notes.some((note) => note.includes("largest polygon"))).toBe(true);
  });

  it("removes polygon holes", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "with-hole" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [3, 0],
                [3, 3],
                [0, 3],
                [0, 0],
              ],
              [
                [1, 1],
                [2, 1],
                [2, 2],
                [1, 2],
                [1, 1],
              ],
            ],
          },
        },
      ],
    };

    const result = convertParsedGeojson(geojson, "GeoJSON");

    expect(result.cleanedGeojson.features[0].geometry.coordinates).toHaveLength(1);
    expect(result.notes.some((note) => note.includes("Interior holes"))).toBe(true);
  });

  it("strips Z coordinates", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "z" },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [0, 0, 10],
              [1, 0, 10],
              [1, 1, 10],
              [0, 1, 10],
              [0, 0, 10],
            ]],
          },
        },
      ],
    };

    const result = convertParsedGeojson(geojson, "GeoJSON");

    expect(
      result.cleanedGeojson.features[0].geometry.coordinates[0].every(
        (point) => point.length === 2
      )
    ).toBe(true);
    expect(result.notes.some((note) => note.includes("Z coordinates"))).toBe(true);
  });

  it("polygonizes a closed line", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "closed-line" },
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [2, 0],
              [2, 2],
              [0, 2],
              [0, 0],
            ],
          },
        },
      ],
    };

    const result = convertParsedGeojson(geojson, "GeoJSON");

    expect(result.cleanedGeojson.features[0].geometry.type).toBe("Polygon");
    expect(result.notes.some((note) => note.includes("polygonized"))).toBe(true);
  });

  it("rejects open linework", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [0, 0],
              [1, 0],
              [1, 1],
            ],
          },
        },
      ],
    };

    expect(() => convertParsedGeojson(geojson, "GeoJSON")).toThrow(
      /polygonized/i
    );
  });

  it("rejects point-only input", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [103.8, 1.3],
          },
        },
      ],
    };

    expect(() => convertParsedGeojson(geojson, "GeoJSON")).toThrow(
      /polygon data or closed linework/i
    );
  });

  it("fails when final coordinates are outside valid CRS range", () => {
    const geojson = {
      type: "FeatureCollection",
      features: [
        makePolygon(
          [
            [5000, 6000],
            [5001, 6000],
            [5001, 6001],
            [5000, 6001],
            [5000, 6000],
          ],
          { name: "bad-crs" }
        ),
      ],
    };

    expect(() => convertParsedGeojson(geojson, "GeoJSON")).toThrow(
      /outside lat\/lon range/i
    );
  });
});
