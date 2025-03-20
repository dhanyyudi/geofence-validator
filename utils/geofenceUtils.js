import * as turf from "@turf/turf";

// Fungsi validasi GeoJSON dasar
function isValidGeoJSON(geojson) {
  // Cek apakah geojson adalah objek
  if (!geojson || typeof geojson !== "object") {
    return { valid: false, error: "GeoJSON harus berupa objek." };
  }

  // Cek tipe GeoJSON
  const validTypes = [
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

  if (geojson.type === "FeatureCollection") {
    if (!Array.isArray(geojson.features)) {
      return {
        valid: false,
        error: 'FeatureCollection harus memiliki array "features".',
      };
    }
  } else if (geojson.type === "Feature") {
    if (!geojson.geometry) {
      return {
        valid: false,
        error: 'Feature harus memiliki property "geometry".',
      };
    }
  } else if (!validTypes.includes(geojson.type)) {
    return {
      valid: false,
      error: `Tipe GeoJSON "${geojson.type}" tidak valid.`,
    };
  }

  return { valid: true };
}

export function validateGeofence(geojson) {
  // Tambahkan console log untuk debug
  console.log("Starting validation for:", geojson.name || "GeoJSON file");

  const result = {
    isValid: true,
    originalGeojson: geojson,
    modifiedGeojson: null,
    errors: [],
    warnings: [],
    fixes: {},
  };

  // Basic validation first
  if (!geojson || typeof geojson !== "object") {
    result.isValid = false;
    result.errors.push(
      "GeoJSON tidak valid: Data tidak lengkap atau bukan objek valid"
    );
    return result;
  }

  // Validasi format GeoJSON dasar
  const basicValidation = isValidGeoJSON(geojson);
  if (!basicValidation.valid) {
    result.isValid = false;
    result.errors.push("GeoJSON tidak valid: " + basicValidation.error);
    return result;
  }

  try {
    // 2. Check coordinate system (must be lat/lon)
    // In GeoJSON, coordinates are always in [longitude, latitude] format
    const hasInvalidCoords = checkCoordinateSystem(geojson);
    if (hasInvalidCoords) {
      result.isValid = false;
      result.errors.push(
        "Invalid CRS: Please change your coordinate system using QGIS or other GIS applications"
      );
    }

    // 3. Check z-coordinates
    const hasZCoordinates = checkZCoordinates(geojson);
    if (hasZCoordinates) {
      result.warnings.push(
        "Geofence has z-coordinates. This can cause compatibility issues."
      );
      result.fixes.removeZCoordinates = {
        description: "Hapus z-coordinates",
        apply: () => removeZCoordinates(geojson),
      };
    }

    // 4. Check type MultiPolygon dan multiple polygons dan rings
    const geometryInfo = checkGeometryType(geojson);

    if (geometryInfo.isMultiPolygon) {
      result.warnings.push(
        "Geofence has MultiPolygon type. It is recommended to use a single Polygon type."
      );

      // Tambahkan informasi tentang jumlah rings jika ada
      if (geometryInfo.rings && geometryInfo.rings.length > 0) {
        // Hitung jumlah exterior dan interior rings
        const exteriorCount =
          geometryInfo.rings.filter((r) => r && r.isExterior).length || 0;
        const interiorCount =
          geometryInfo.rings.filter((r) => r && r.isInterior).length || 0;

        result.warnings.push(
          `Found ${geometryInfo.rings.length} rings (${exteriorCount} exterior, ${interiorCount} interior/holes).`
        );

        // Tampilkan debugging untuk rings
        console.log("Rings extracted:", geometryInfo.rings.length);
        geometryInfo.rings.forEach((r, i) => {
          if (r) {
            console.log(
              `Ring ${i}: ${r.isExterior ? "Exterior" : "Interior"}, ${
                r.coordinates ? r.coordinates.length : 0
              } points`
            );
          }
        });

        // Tambahkan opsi perbaikan untuk konversi ke ring tunggal
        result.fixes.convertToSingleRing = {
          description: "Konversi ke Polygon dengan ring tunggal",
          rings: geometryInfo.rings,
          apply: (selectedRingIndex) =>
            convertToSingleRing(geojson, selectedRingIndex),
        };
      }
    } else if (geometryInfo.polygons && geometryInfo.polygons.length > 1) {
      result.warnings.push(
        `Geofence has ${geometryInfo.polygons.length} polygons. It is recommended to use only one polygon.`
      );
      result.fixes.selectPolygon = {
        description: "Pilih satu polygon",
        polygons: geometryInfo.polygons,
        apply: (selectedIndex) => selectSinglePolygon(geojson, selectedIndex),
      };
    } else if (geometryInfo.rings && geometryInfo.rings.length > 1) {
      // Jika tipe sudah Polygon tapi masih memiliki multiple rings
      const exteriorCount =
        geometryInfo.rings.filter((r) => r && r.isExterior).length || 0;
      const interiorCount =
        geometryInfo.rings.filter((r) => r && r.isInterior).length || 0;

      result.warnings.push(
        `Geofence has ${geometryInfo.rings.length} rings (${exteriorCount} exterior, ${interiorCount} interior/holes).`
      );

      result.fixes.convertToSingleRing = {
        description: "Konversi ke Polygon dengan ring tunggal",
        rings: geometryInfo.rings,
        apply: (selectedRingIndex) =>
          convertToSingleRing(geojson, selectedRingIndex),
      };
    }

    // Ekstraksi manual untuk multipolygon jika deteksi normal gagal
    if (!result.fixes.convertToSingleRing) {
      // Periksa jika ada fitur dengan tipe MultiPolygon
      const feature = geojson.features && geojson.features[0];
      if (
        feature &&
        feature.geometry &&
        feature.geometry.type === "MultiPolygon"
      ) {
        const coordinates = feature.geometry.coordinates;
        if (coordinates && coordinates.length > 0) {
          // Ekstrak rings dari polygon pertama jika belum ada
          const firstPolygon = coordinates[0];
          if (Array.isArray(firstPolygon) && firstPolygon.length > 0) {
            console.log(
              "Manual extraction: found polygon with",
              firstPolygon.length,
              "rings"
            );

            const manualRings = firstPolygon.map((ring, ringIndex) => ({
              polygonIndex: 0,
              ringIndex,
              coordinates: ring,
              numPoints: ring.length,
              isExterior: ringIndex === 0,
              isInterior: ringIndex > 0,
            }));

            // Debug untuk melihat rings yang diekstrak
            manualRings.forEach((r, i) => {
              console.log(
                `Manual Ring ${i}: ${r.isExterior ? "Exterior" : "Interior"}, ${
                  r.coordinates.length
                } points`
              );
            });

            if (manualRings.length > 0) {
              result.warnings.push(
                `Geofence has MultiPolygon type with ${manualRings.length} rings. It is recommended to convert to a single Polygon.`
              );

              result.fixes.convertToSingleRing = {
                description: "Konversi ke Polygon dengan ring tunggal",
                rings: manualRings,
                apply: (selectedRingIndex) =>
                  convertToSingleRing(geojson, selectedRingIndex),
              };
            }
          }
        }
      }
    }
  } catch (error) {
    // Tangkap error yang tidak terduga selama validasi
    console.error("Error during validation:", error);
    result.isValid = false;
    result.errors.push(`Error during validation: ${error.message}`);
  }

  console.log(
    "Validation result:",
    result.warnings.length,
    "warnings,",
    result.errors.length,
    "errors,",
    Object.keys(result.fixes).length,
    "fixes available"
  );

  return result;
}

function checkCoordinateSystem(geojson) {
  // Memeriksa apakah koordinat berada dalam kisaran latitude/longitude
  let hasInvalidCoords = false;

  const checkCoords = (coords) => {
    for (const coord of coords) {
      if (Array.isArray(coord[0])) {
        // Nested arrays (polygons, etc)
        checkCoords(coord);
      } else {
        // Individual coordinate
        const lon = coord[0];
        const lat = coord[1];

        // Longitude harus dalam range -180 sampai 180
        // Latitude harus dalam range -90 sampai 90
        if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
          hasInvalidCoords = true;
          return;
        }
      }
    }
  };

  // Periksa untuk semua fitur jika ini FeatureCollection
  if (geojson.type === "FeatureCollection") {
    for (const feature of geojson.features) {
      if (feature.geometry && feature.geometry.coordinates) {
        checkCoords(feature.geometry.coordinates);
      }
    }
  }
  // Periksa fitur tunggal
  else if (geojson.type === "Feature") {
    if (geojson.geometry && geojson.geometry.coordinates) {
      checkCoords(geojson.geometry.coordinates);
    }
  }
  // Periksa geometry secara langsung
  else if (geojson.coordinates) {
    checkCoords(geojson.coordinates);
  }

  return hasInvalidCoords;
}

function checkZCoordinates(geojson) {
  let hasZCoords = false;

  const checkCoords = (coords) => {
    for (const coord of coords) {
      if (Array.isArray(coord[0])) {
        // Nested arrays (polygons, etc)
        checkCoords(coord);
      } else {
        // Individual coordinate
        if (coord.length > 2) {
          hasZCoords = true;
          return;
        }
      }
    }
  };

  // Check all features if it's a FeatureCollection
  if (geojson.type === "FeatureCollection") {
    for (const feature of geojson.features) {
      if (feature.geometry && feature.geometry.coordinates) {
        checkCoords(feature.geometry.coordinates);
      }
    }
  }
  // Check single feature
  else if (geojson.type === "Feature") {
    if (geojson.geometry && geojson.geometry.coordinates) {
      checkCoords(geojson.geometry.coordinates);
    }
  }
  // Check geometry directly
  else if (geojson.coordinates) {
    checkCoords(geojson.coordinates);
  }

  return hasZCoords;
}

function removeZCoordinates(geojson) {
  const newGeojson = JSON.parse(JSON.stringify(geojson)); // Deep clone

  const processCoords = (coords) => {
    for (let i = 0; i < coords.length; i++) {
      if (Array.isArray(coords[i][0])) {
        // Nested arrays (polygons, etc)
        processCoords(coords[i]);
      } else {
        // Individual coordinate
        if (coords[i].length > 2) {
          coords[i] = [coords[i][0], coords[i][1]]; // Keep only lon/lat
        }
      }
    }
  };

  // Process all features if it's a FeatureCollection
  if (newGeojson.type === "FeatureCollection") {
    for (const feature of newGeojson.features) {
      if (feature.geometry && feature.geometry.coordinates) {
        processCoords(feature.geometry.coordinates);
      }
    }
  }
  // Process single feature
  else if (newGeojson.type === "Feature") {
    if (newGeojson.geometry && newGeojson.geometry.coordinates) {
      processCoords(newGeojson.geometry.coordinates);
    }
  }
  // Process geometry directly
  else if (newGeojson.coordinates) {
    processCoords(newGeojson.coordinates);
  }

  // Ensure standard format
  return ensureStandardFormat(newGeojson);
}

function checkGeometryType(geojson) {
  const result = {
    isMultiPolygon: false,
    polygons: [],
    rings: [],
  };

  // Function to extract polygons
  const extractPolygons = (geometry) => {
    if (!geometry || !geometry.type) return;

    if (geometry.type === "MultiPolygon") {
      result.isMultiPolygon = true;
      // Each element in a MultiPolygon is a Polygon
      geometry.coordinates.forEach((polygonCoords, index) => {
        result.polygons.push({
          index,
          coordinates: polygonCoords,
          area: calculateArea(polygonCoords),
        });

        // Extract rings from this polygon
        if (Array.isArray(polygonCoords) && polygonCoords.length > 0) {
          polygonCoords.forEach((ring, ringIndex) => {
            result.rings.push({
              polygonIndex: index,
              ringIndex: result.rings.length,
              coordinates: ring,
              isExterior: ringIndex === 0,
              isInterior: ringIndex > 0,
            });
          });
        }
      });
    } else if (geometry.type === "Polygon") {
      // A Polygon might have multiple rings (first is outer, rest are holes)
      // We treat the whole polygon as one entity
      result.polygons.push({
        index: 0,
        coordinates: geometry.coordinates,
        area: calculateArea(geometry.coordinates),
      });

      // Extract rings from this polygon
      if (
        Array.isArray(geometry.coordinates) &&
        geometry.coordinates.length > 0
      ) {
        geometry.coordinates.forEach((ring, ringIndex) => {
          result.rings.push({
            polygonIndex: 0,
            ringIndex: result.rings.length,
            coordinates: ring,
            isExterior: ringIndex === 0,
            isInterior: ringIndex > 0,
          });
        });
      }
    } else if (geometry.type === "GeometryCollection") {
      geometry.geometries.forEach((g) => extractPolygons(g));
    }
  };

  // Check features in a collection
  if (geojson.type === "FeatureCollection") {
    geojson.features.forEach((feature) => {
      if (feature.geometry) {
        extractPolygons(feature.geometry);
      }
    });
  }
  // Check single feature
  else if (geojson.type === "Feature") {
    if (geojson.geometry) {
      extractPolygons(geojson.geometry);
    }
  }
  // Check geometry directly
  else if (geojson.type) {
    extractPolygons(geojson);
  }

  return result;
}

function calculateArea(polygonCoords) {
  try {
    // Create a GeoJSON polygon
    const polygon = {
      type: "Polygon",
      coordinates: polygonCoords,
    };

    // Calculate area using turf.js
    const area = turf.area(polygon);
    return area;
  } catch (error) {
    console.error("Error calculating area:", error);
    return 0;
  }
}

// Fungsi untuk memastikan format standar GeoJSON
function ensureStandardFormat(geojson) {
  // Format standar yang diinginkan:
  // {
  //   "type": "FeatureCollection",
  //   "features": [{
  //     "type": "Feature",
  //     "properties": {},
  //     "geometry": {
  //       "type": "Polygon",
  //       "coordinates": [[[lon,lat]]]
  //     }
  //   }]
  // }

  // Copy properties jika ada
  let properties = {};

  // Extract properties from existing GeoJSON
  if (
    geojson.type === "FeatureCollection" &&
    geojson.features &&
    geojson.features.length > 0
  ) {
    properties = geojson.features[0].properties || {};
  } else if (geojson.type === "Feature") {
    properties = geojson.properties || {};
  }

  // Cari koordinat polygon
  let polygonCoordinates = null;

  // Extract coordinates from the first polygon we can find
  if (
    geojson.type === "FeatureCollection" &&
    geojson.features &&
    geojson.features.length > 0
  ) {
    const feature = geojson.features[0];
    if (feature.geometry) {
      if (feature.geometry.type === "Polygon") {
        polygonCoordinates = feature.geometry.coordinates;
      } else if (
        feature.geometry.type === "MultiPolygon" &&
        feature.geometry.coordinates.length > 0
      ) {
        polygonCoordinates = feature.geometry.coordinates[0]; // Use first polygon
      }
    }
  } else if (geojson.type === "Feature" && geojson.geometry) {
    if (geojson.geometry.type === "Polygon") {
      polygonCoordinates = geojson.geometry.coordinates;
    } else if (
      geojson.geometry.type === "MultiPolygon" &&
      geojson.geometry.coordinates.length > 0
    ) {
      polygonCoordinates = geojson.geometry.coordinates[0];
    }
  } else if (geojson.type === "Polygon") {
    polygonCoordinates = geojson.coordinates;
  } else if (
    geojson.type === "MultiPolygon" &&
    geojson.coordinates &&
    geojson.coordinates.length > 0
  ) {
    polygonCoordinates = geojson.coordinates[0];
  }

  // If no valid coordinates found, return empty polygon
  if (
    !polygonCoordinates ||
    !Array.isArray(polygonCoordinates) ||
    polygonCoordinates.length === 0
  ) {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: properties,
          geometry: {
            type: "Polygon",
            coordinates: [[]],
          },
        },
      ],
    };
  }

  // Return standardized GeoJSON
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: properties,
        geometry: {
          type: "Polygon",
          coordinates: polygonCoordinates,
        },
      },
    ],
  };
}

// Fungsi untuk mengkonversi ke format yang diinginkan dengan hanya 1 ring (exterior)
function convertToSingleRing(geojson, selectedRingIndex) {
  console.log("convertToSingleRing called with ring index:", selectedRingIndex);

  // Deep clone untuk menghindari modifikasi objek asli
  const newGeojson = JSON.parse(JSON.stringify(geojson));

  // Simpan properties jika ada
  let properties = {};
  if (
    newGeojson.type === "FeatureCollection" &&
    newGeojson.features &&
    newGeojson.features.length > 0
  ) {
    properties = newGeojson.features[0].properties || {};
  } else if (newGeojson.type === "Feature") {
    properties = newGeojson.properties || {};
  }

  // Get geometry info to extract rings
  const geometryInfo = checkGeometryType(geojson);
  console.log("Geometry info:", {
    isMultiPolygon: geometryInfo.isMultiPolygon,
    polygonCount: geometryInfo.polygons.length,
    ringCount: geometryInfo.rings.length,
  });

  let selectedRing = null;

  // Try to find the selected ring
  if (geometryInfo.rings && geometryInfo.rings.length > 0) {
    // Use the specified ring index or default to the first exterior ring
    if (
      selectedRingIndex !== undefined &&
      selectedRingIndex >= 0 &&
      selectedRingIndex < geometryInfo.rings.length
    ) {
      selectedRing = geometryInfo.rings[selectedRingIndex].coordinates;
      console.log(
        `Using selected ring ${selectedRingIndex} with ${selectedRing.length} points`
      );
    } else {
      // Default to first exterior ring if available
      const exteriorRing = geometryInfo.rings.find((ring) => ring.isExterior);
      if (exteriorRing) {
        selectedRing = exteriorRing.coordinates;
        console.log(
          `Using first exterior ring with ${selectedRing.length} points`
        );
      } else {
        // Fallback to first ring
        selectedRing = geometryInfo.rings[0].coordinates;
        console.log(
          `Using first available ring with ${selectedRing.length} points`
        );
      }
    }
  } else {
    console.warn(
      "No rings found in geometry info, attempting manual extraction"
    );

    // Manual extraction for MultiPolygon
    const feature = newGeojson.features && newGeojson.features[0];
    if (
      feature &&
      feature.geometry &&
      feature.geometry.type === "MultiPolygon"
    ) {
      const coordinates = feature.geometry.coordinates;
      if (
        coordinates &&
        coordinates.length > 0 &&
        coordinates[0] &&
        coordinates[0].length > 0
      ) {
        selectedRing = coordinates[0][0]; // First ring of first polygon
        console.log(
          `Manually extracted ring with ${selectedRing.length} points`
        );
      }
    } else if (
      feature &&
      feature.geometry &&
      feature.geometry.type === "Polygon"
    ) {
      const coordinates = feature.geometry.coordinates;
      if (coordinates && coordinates.length > 0) {
        selectedRing = coordinates[0]; // First ring
        console.log(
          `Manually extracted ring from Polygon with ${selectedRing.length} points`
        );
      }
    }
  }

  // If no valid ring found, create an empty one
  if (!selectedRing || !Array.isArray(selectedRing)) {
    console.warn("No valid ring found, using empty ring");
    selectedRing = [];
  }

  // Create standard format output
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: properties,
        geometry: {
          type: "Polygon",
          coordinates: [selectedRing], // Ensure proper nesting for Polygon
        },
      },
    ],
  };
}

function selectSinglePolygon(geojson, selectedIndex) {
  console.log("selectSinglePolygon called with index:", selectedIndex);

  // Get original properties
  let properties = {};
  if (
    geojson.type === "FeatureCollection" &&
    geojson.features &&
    geojson.features.length > 0
  ) {
    properties = geojson.features[0].properties || {};
  } else if (geojson.type === "Feature") {
    properties = geojson.properties || {};
  }

  // Get polygon info
  const geometryInfo = checkGeometryType(geojson);
  let selectedPolygonCoords = null;

  // Find the selected polygon
  if (geometryInfo.polygons && geometryInfo.polygons.length > 0) {
    // Use specified index or default to first
    const polygonIndex =
      selectedIndex !== undefined &&
      selectedIndex >= 0 &&
      selectedIndex < geometryInfo.polygons.length
        ? selectedIndex
        : 0;

    selectedPolygonCoords = geometryInfo.polygons[polygonIndex].coordinates;
    console.log(
      `Using polygon ${polygonIndex} with ${selectedPolygonCoords.length} rings`
    );
  }

  // If no valid polygon found, create empty one
  if (!selectedPolygonCoords) {
    console.warn("No valid polygon found, using empty polygon");
    selectedPolygonCoords = [[]];
  }

  // Return standard format
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: properties,
        geometry: {
          type: "Polygon",
          coordinates: selectedPolygonCoords,
        },
      },
    ],
  };
}

// Fungsi untuk memilih beberapa polygon berdasarkan layer yang terlihat
export function selectVisiblePolygons(geojson, visibleLayers) {
  // Ensure standard format output with the first visible polygon
  return selectSinglePolygon(
    geojson,
    Object.keys(visibleLayers).find((key) => visibleLayers[key])
  );
}
