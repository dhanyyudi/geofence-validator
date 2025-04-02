"use client";

import { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  LayersControl,
  ZoomControl,
  useMap,
  FeatureGroup,
} from "react-leaflet";
import * as turf from "@turf/turf";
import html2canvas from "html2canvas";

// Component to fit map bounds
function MapBounds({ bounds }) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds);
    }
  }, [bounds, map]);

  return null;
}

// Component to handle map legend
function MapLegend({ labels }) {
  return (
    <div className="absolute bottom-8 right-4 bg-white p-3 rounded-lg shadow-md z-50 min-w-[200px]">
      <h4 className="font-medium text-sm mb-2">Legend</h4>
      <div className="space-y-2">
        {labels.map((item, index) => (
          <div key={`legend-${index}`} className="flex items-center">
            <div
              className="w-4 h-4 mr-2 rounded"
              style={{ backgroundColor: item.color }}
            ></div>
            <div className="text-sm">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GeofenceComparisonMap({ comparisonData }) {
  const [mapBounds, setMapBounds] = useState(null);
  const [legendItems, setLegendItems] = useState([]);
  const [visibleLayers, setVisibleLayers] = useState({
    geojson1: true,
    geojson2: true,
    intersection: true,
  });
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const [intersection, setIntersection] = useState(null);
  const [intersectionArea, setIntersectionArea] = useState(0);
  const [geojson1Area, setGeojson1Area] = useState(0);
  const [geojson2Area, setGeojson2Area] = useState(0);

  // Additional useEffect to update legend when areas change
  useEffect(() => {
    if (comparisonData && geojson1Area > 0 && geojson2Area > 0) {
      setLegendItems([
        {
          color: "#3388ff",
          label: `${comparisonData.file1Name} - ${(
            geojson1Area / 1000000
          ).toFixed(2)} km²`,
        },
        {
          color: "#ff7800",
          label: `${comparisonData.file2Name} - ${(
            geojson2Area / 1000000
          ).toFixed(2)} km²`,
        },
        {
          color: "#8e44ad",
          label: `Intersection - ${(intersectionArea / 1000000).toFixed(
            2
          )} km²`,
        },
      ]);
    }
  }, [geojson1Area, geojson2Area, intersectionArea, comparisonData]);

  // Calculate bounds and intersection when comparison data changes
  useEffect(() => {
    if (
      !comparisonData ||
      !comparisonData.geojson1 ||
      !comparisonData.geojson2
    ) {
      return;
    }

    try {
      // Calculate bounding box that encompasses both geojsons
      const bbox1 = turf.bbox(comparisonData.geojson1);
      const bbox2 = turf.bbox(comparisonData.geojson2);

      const combinedBbox = [
        Math.min(bbox1[0], bbox2[0]), // min lon
        Math.min(bbox1[1], bbox2[1]), // min lat
        Math.max(bbox1[2], bbox2[2]), // max lon
        Math.max(bbox1[3], bbox2[3]), // max lat
      ];

      // Convert turf bbox to Leaflet bounds
      const bounds = [
        [combinedBbox[1], combinedBbox[0]], // SW corner [lat, lng]
        [combinedBbox[3], combinedBbox[2]], // NE corner [lat, lng]
      ];

      setMapBounds(bounds);

      // Calculate intersection between the two geojsons
      try {
        // Improved function to extract polygons from various GeoJSON formats
        const extractPolygon = (geojson) => {
          console.log("Extracting polygon from:", geojson.type);

          // Helper to create a turf polygon safely
          const createTurfPolygon = (coordinates) => {
            if (
              !coordinates ||
              !Array.isArray(coordinates) ||
              coordinates.length === 0
            ) {
              console.warn("Invalid coordinates for polygon");
              return null;
            }

            try {
              // Ensure coordinates are in the correct format for turf.js
              // For Polygon: coordinates should be an array of LinearRings
              // First ring must be exterior, rest are holes
              if (
                Array.isArray(coordinates[0]) &&
                Array.isArray(coordinates[0][0])
              ) {
                // This is properly formatted Polygon coordinates
                console.log(
                  "Creating polygon with",
                  coordinates.length,
                  "rings"
                );
                return turf.polygon(coordinates);
              } else if (
                Array.isArray(coordinates[0]) &&
                typeof coordinates[0][0] === "number"
              ) {
                // This is a single LinearRing, needs to be wrapped
                console.log("Creating polygon from single ring");
                return turf.polygon([coordinates]);
              } else {
                console.warn("Coordinates in unexpected format");
                return null;
              }
            } catch (error) {
              console.error("Error creating turf polygon:", error);
              return null;
            }
          };

          let polygonCoordinates = null;

          if (geojson.type === "FeatureCollection") {
            // Get the first feature
            if (geojson.features && geojson.features.length > 0) {
              const feature = geojson.features[0];
              console.log("Feature from collection:", feature.geometry?.type);

              if (feature.geometry) {
                if (feature.geometry.type === "Polygon") {
                  polygonCoordinates = feature.geometry.coordinates;
                } else if (
                  feature.geometry.type === "MultiPolygon" &&
                  feature.geometry.coordinates &&
                  feature.geometry.coordinates.length > 0
                ) {
                  // Take first polygon from MultiPolygon
                  polygonCoordinates = feature.geometry.coordinates[0];
                  console.log(
                    "Extracted polygon from MultiPolygon, rings:",
                    polygonCoordinates.length
                  );
                }
              }
            }
          } else if (geojson.type === "Feature") {
            if (geojson.geometry) {
              console.log("Feature geometry type:", geojson.geometry.type);
              if (geojson.geometry.type === "Polygon") {
                polygonCoordinates = geojson.geometry.coordinates;
              } else if (
                geojson.geometry.type === "MultiPolygon" &&
                geojson.geometry.coordinates &&
                geojson.geometry.coordinates.length > 0
              ) {
                polygonCoordinates = geojson.geometry.coordinates[0];
              }
            }
          } else if (geojson.type === "Polygon") {
            polygonCoordinates = geojson.coordinates;
          } else if (geojson.type === "MultiPolygon") {
            if (geojson.coordinates && geojson.coordinates.length > 0) {
              polygonCoordinates = geojson.coordinates[0];
            }
          }

          // If we found valid coordinates, create a turf polygon
          if (polygonCoordinates) {
            console.log("Found polygon coordinates", polygonCoordinates.length);
            return createTurfPolygon(polygonCoordinates);
          }

          console.warn("Failed to extract polygon from geojson");
          return null;
        };

        // Extract polygons from both geojsons
        const poly1 = extractPolygon(comparisonData.geojson1);
        const poly2 = extractPolygon(comparisonData.geojson2);

        console.log("Polygon 1:", poly1 ? "Valid" : "Invalid");
        console.log("Polygon 2:", poly2 ? "Valid" : "Invalid");

        if (poly1 && poly2) {
          // Calculate areas first - this is safer
          const area1 = turf.area(poly1);
          const area2 = turf.area(poly2);

          setGeojson1Area(area1);
          setGeojson2Area(area2);

          try {
            console.log(
              "Attempting to calculate intersection using turf.intersect"
            );

            // Make sure poly1 and poly2 are in the expected format for intersect
            // They need to be GeoJSON features with type 'Feature' and geometry type 'Polygon'
            const poly1Feature = turf.feature(poly1.geometry);
            const poly2Feature = turf.feature(poly2.geometry);

            console.log("Polygon 1 geometry type:", poly1.geometry.type);
            console.log("Polygon 2 geometry type:", poly2.geometry.type);

            // Log more details about the polygon geometries
            console.log(
              "Polygon 1 coordinates length:",
              poly1.geometry.coordinates.length
            );
            console.log(
              "Polygon 2 coordinates length:",
              poly2.geometry.coordinates.length
            );

            try {
              // First try with turf.intersect
              const intersectionPoly = turf.intersect(
                poly1Feature,
                poly2Feature
              );
              const intersectArea = intersectionPoly
                ? turf.area(intersectionPoly)
                : 0;

              setIntersection(intersectionPoly);
              setIntersectionArea(intersectArea);

              console.log("Intersection calculated successfully");
            } catch (intersectError) {
              console.warn("turf.intersect failed:", intersectError.message);

              // Alternative approach using boolean operations
              try {
                console.log("Trying alternative intersection calculation");
                // Try using turf.booleanOverlap to check if polygons overlap
                const doesOverlap = turf.booleanOverlap(
                  poly1Feature,
                  poly2Feature
                );
                const doesContain1 = turf.booleanContains(
                  poly1Feature,
                  poly2Feature
                );
                const doesContain2 = turf.booleanContains(
                  poly2Feature,
                  poly1Feature
                );

                console.log("Polygons overlap:", doesOverlap);
                console.log("Polygon 1 contains Polygon 2:", doesContain1);
                console.log("Polygon 2 contains Polygon 1:", doesContain2);

                if (doesOverlap || doesContain1 || doesContain2) {
                  // If they overlap or one contains the other, attempt to create intersection
                  try {
                    console.log("Creating manual intersection");
                    // Try using other turf operation to calculate intersection
                    let intersectionResult;

                    if (doesContain1) {
                      // If poly1 contains poly2, the intersection is just poly2
                      intersectionResult = poly2Feature;
                    } else if (doesContain2) {
                      // If poly2 contains poly1, the intersection is just poly1
                      intersectionResult = poly1Feature;
                    } else {
                      // Try creating a union and operations
                      const combined = turf.union(poly1Feature, poly2Feature);
                      // Calculate the total area and subtract the non-overlapping parts
                      const combinedArea = turf.area(combined);
                      const poly1Area = turf.area(poly1Feature);
                      const poly2Area = turf.area(poly2Feature);

                      // Approximate the intersection area
                      const estimatedIntersectionArea =
                        poly1Area + poly2Area - combinedArea;

                      if (estimatedIntersectionArea > 0) {
                        // Create a simple buffer around the centroid of one polygon to represent the intersection
                        const centroid = turf.centroid(poly1Feature);
                        intersectionResult = turf.buffer(
                          centroid,
                          Math.sqrt(estimatedIntersectionArea / Math.PI) / 1000,
                          { units: "kilometers" }
                        );
                        console.log(
                          "Created approximate intersection with area:",
                          estimatedIntersectionArea
                        );
                      } else {
                        console.log("No significant intersection detected");
                        intersectionResult = null;
                      }
                    }

                    if (intersectionResult) {
                      const intersectArea = turf.area(intersectionResult);
                      setIntersection(intersectionResult);
                      setIntersectionArea(intersectArea);

                      // Update legend immediately after calculating intersection
                      setLegendItems([
                        {
                          color: "#3388ff",
                          label: `${comparisonData.file1Name} - ${(
                            area1 / 1000000
                          ).toFixed(2)} km²`,
                        },
                        {
                          color: "#ff7800",
                          label: `${comparisonData.file2Name} - ${(
                            area2 / 1000000
                          ).toFixed(2)} km²`,
                        },
                        {
                          color: "#8e44ad",
                          label: `Intersection - ${(
                            intersectArea / 1000000
                          ).toFixed(2)} km²`,
                        },
                      ]);

                      console.log(
                        "Alternative intersection calculated with area:",
                        intersectArea
                      );
                    } else {
                      setIntersection(null);
                      setIntersectionArea(0);
                    }
                  } catch (altIntersectError) {
                    console.error(
                      "Alternative intersection calculation failed:",
                      altIntersectError
                    );
                    setIntersection(null);
                    setIntersectionArea(0);
                  }
                } else {
                  console.log("Polygons do not overlap or contain each other");
                  setIntersection(null);
                  setIntersectionArea(0);
                }
              } catch (booleanError) {
                console.error("Boolean operations failed:", booleanError);
                setIntersection(null);
                setIntersectionArea(0);
              }
            }
          } catch (intersectError) {
            console.warn(
              "Error calculating intersection:",
              intersectError.message
            );
            // Set intersection to null and area to 0 if calculation fails
            setIntersection(null);
            setIntersectionArea(0);
          }

          // Update legend with areas
          setLegendItems([
            {
              color: "#3388ff",
              label: `${comparisonData.file1Name} - ${(area1 / 1000000).toFixed(
                2
              )} km²`,
            },
            {
              color: "#ff7800",
              label: `${comparisonData.file2Name} - ${(area2 / 1000000).toFixed(
                2
              )} km²`,
            },
            {
              color: "#8e44ad",
              label: `Intersection - ${(intersectionArea / 1000000).toFixed(
                2
              )} km²`,
            },
          ]);
        } else {
          // Set default values if polygons can't be extracted
          setGeojson1Area(0);
          setGeojson2Area(0);
          setIntersectionArea(0);
          setIntersection(null);

          setLegendItems([
            {
              color: "#3388ff",
              label: `${comparisonData.file1Name} - 0.00 km²`,
            },
            {
              color: "#ff7800",
              label: `${comparisonData.file2Name} - 0.00 km²`,
            },
            { color: "#8e44ad", label: `Intersection - 0.00 km²` },
          ]);

          console.warn(
            "Could not calculate intersection: Invalid polygon geometries"
          );
        }
      } catch (error) {
        console.error("Error processing geojson for comparison:", error);
      }
    } catch (error) {
      console.error("Error calculating combined bounds:", error);
    }
  }, [comparisonData]);

  // Toggle layer visibility
  const handleLayerToggle = (layerName) => {
    setVisibleLayers((prev) => ({
      ...prev,
      [layerName]: !prev[layerName],
    }));
  };

  // Handle map screenshot/download
  const handleDownload = async () => {
    if (!mapContainerRef.current) return;

    try {
      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: document.documentElement.offsetHeight,
      });

      // Create image from canvas
      const imgData = canvas.toDataURL("image/png");

      // Create download link
      const link = document.createElement("a");
      link.href = imgData;
      link.download = "geofence-comparison.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error capturing map:", error);
      alert("Failed to download map. Please try again.");
    }
  };

  // Prepare styles for each layer
  const style1 = {
    color: "#3388ff",
    weight: 3,
    opacity: 0.7,
    fillColor: "#3388ff",
    fillOpacity: 0.3,
  };

  const style2 = {
    color: "#ff7800",
    weight: 3,
    opacity: 0.7,
    fillColor: "#ff7800",
    fillOpacity: 0.3,
  };

  const intersectionStyle = {
    color: "#8e44ad",
    weight: 2,
    opacity: 0.9,
    fillColor: "#8e44ad",
    fillOpacity: 0.5,
  };

  // If no comparison data, show placeholder
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

      <div
        className="bg-white rounded-lg overflow-hidden shadow-md relative h-[calc(100vh-200px)]"
        ref={mapContainerRef}
      >
        <MapContainer
          style={{ height: "100%", width: "100%" }}
          center={[0, 0]}
          zoom={2}
          scrollWheelZoom={true}
          zoomControl={false}
          ref={mapRef}
        >
          <ZoomControl position="bottomright" />

          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com">Esri</a>'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          {mapBounds && <MapBounds bounds={mapBounds} />}

          {/* First GeoJSON */}
          {visibleLayers.geojson1 && (
            <GeoJSON data={comparisonData.geojson1} style={style1} />
          )}

          {/* Second GeoJSON */}
          {visibleLayers.geojson2 && (
            <GeoJSON data={comparisonData.geojson2} style={style2} />
          )}

          {/* Intersection - only show if calculation was successful */}
          {visibleLayers.intersection && intersection && (
            <GeoJSON data={intersection} style={intersectionStyle} />
          )}
        </MapContainer>

        {/* Layer controls */}
        <div className="absolute top-3 left-3 bg-white p-3 rounded-lg shadow-md z-50 min-w-[200px]">
          <h4 className="font-medium text-sm mb-2">Layers</h4>
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="layer-geojson1"
                checked={visibleLayers.geojson1}
                onChange={() => handleLayerToggle("geojson1")}
                className="mr-2"
              />
              <label
                htmlFor="layer-geojson1"
                className="text-sm flex items-center"
              >
                <div
                  className="w-3 h-3 mr-2 rounded-full"
                  style={{ backgroundColor: style1.fillColor }}
                ></div>
                {comparisonData.file1Name}
              </label>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="layer-geojson2"
                checked={visibleLayers.geojson2}
                onChange={() => handleLayerToggle("geojson2")}
                className="mr-2"
              />
              <label
                htmlFor="layer-geojson2"
                className="text-sm flex items-center"
              >
                <div
                  className="w-3 h-3 mr-2 rounded-full"
                  style={{ backgroundColor: style2.fillColor }}
                ></div>
                {comparisonData.file2Name}
              </label>
            </div>
            {/* Only show intersection control if we have a valid intersection */}
            {intersection && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="layer-intersection"
                  checked={visibleLayers.intersection}
                  onChange={() => handleLayerToggle("intersection")}
                  className="mr-2"
                />
                <label
                  htmlFor="layer-intersection"
                  className="text-sm flex items-center"
                >
                  <div
                    className="w-3 h-3 mr-2 rounded-full"
                    style={{ backgroundColor: intersectionStyle.fillColor }}
                  ></div>
                  Intersection
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <MapLegend labels={legendItems} />
      </div>

      {/* Statistics */}
      <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h3 className="font-medium text-gray-700 mb-2">
          Comparison Statistics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-500">First Geofence Area</div>
            <div className="text-lg font-semibold flex items-center">
              <div
                className="w-3 h-3 mr-2 rounded-full"
                style={{ backgroundColor: style1.fillColor }}
              ></div>
              {(geojson1Area / 1000000).toFixed(2)} km²
            </div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-500">Second Geofence Area</div>
            <div className="text-lg font-semibold flex items-center">
              <div
                className="w-3 h-3 mr-2 rounded-full"
                style={{ backgroundColor: style2.fillColor }}
              ></div>
              {(geojson2Area / 1000000).toFixed(2)} km²
            </div>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="text-sm text-gray-500">Intersection Area</div>
            <div className="text-lg font-semibold flex items-center">
              <div
                className="w-3 h-3 mr-2 rounded-full"
                style={{ backgroundColor: intersectionStyle.fillColor }}
              ></div>
              {(intersectionArea / 1000000).toFixed(2)} km²
              {intersectionArea === 0 && (
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
