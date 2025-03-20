"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// Import DirectMultiPolygonMap secara dinamis
const DirectMultiPolygonMap = dynamic(() => import("./DirectMultiPolygonMap"), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <i className="fas fa-spinner fa-spin text-blue-500 text-3xl mb-3"></i>
        <p>Loading map visualization...</p>
      </div>
    </div>
  ),
});

export default function Validator({ validationResult }) {
  const [fixedGeojson, setFixedGeojson] = useState(null);
  const [activeTab, setActiveTab] = useState("warnings");

  if (!validationResult) {
    return null;
  }

  const { isValid, errors, warnings, fixes, originalGeojson } =
    validationResult;

  const handleApplyFix = (fixKey, params = {}) => {
    if (fixes[fixKey]) {
      let fixed;

      if (fixKey === "removeZCoordinates") {
        fixed = fixes.removeZCoordinates.apply();
      } else if (fixKey === "convertToSingleRing") {
        // Untuk konversi dari MultiPolygon ke Polygon
        // Selalu gunakan ring index 0 (exterior ring pertama) secara default
        fixed = fixes.convertToSingleRing.apply(0);
        console.log("Converted GeoJSON:", fixed);
      } else if (fixKey === "selectPolygon") {
        // Untuk memilih polygon, selalu gunakan polygon pertama
        fixed = fixes.selectPolygon.apply(0);
      }

      if (fixed) {
        setFixedGeojson(fixed);
        setActiveTab("fixed");
      }
    }
  };

  const handleDownload = (geojson) => {
    const jsonString = JSON.stringify(geojson, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "fixed-geofence.geojson";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <i className="fas fa-check-circle mr-2 text-blue-500"></i>
          Validation Results
        </h2>

        {isValid && warnings.length === 0 ? (
          <div className="alert alert-success">
            <i className="fas fa-check-circle mr-2"></i>
            GeoJSON is valid and meets all requirements.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {errors.length > 0 && (
              <div className="alert alert-error">
                <h3 className="font-bold mb-1 flex items-center">
                  <i className="fas fa-exclamation-circle mr-2"></i>
                  Error:
                </h3>
                <ul className="list-disc pl-5">
                  {errors.map((error, index) => (
                    <li key={`error-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="alert alert-warning">
                <h3 className="font-bold mb-1 flex items-center">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  Warning:
                </h3>
                <ul className="list-disc pl-5">
                  {warnings.map((warning, index) => (
                    <li key={`warning-${index}`}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab untuk navigasi */}
      {(warnings.length > 0 || fixedGeojson) && (
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab("warnings")}
              className={`py-3 px-6 font-medium ${
                activeTab === "warnings"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <i
                className={`fas fa-tools mr-2 ${
                  activeTab === "warnings" ? "text-blue-500" : ""
                }`}
              ></i>
              Fix Issues
            </button>
            {fixedGeojson && (
              <button
                onClick={() => setActiveTab("fixed")}
                className={`py-3 px-6 font-medium ${
                  activeTab === "fixed"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <i
                  className={`fas fa-check mr-2 ${
                    activeTab === "fixed" ? "text-blue-500" : ""
                  }`}
                ></i>
                Fixed Result
              </button>
            )}
          </div>
        </div>
      )}

      {/* Konten tab */}
      <div className="p-6">
        {activeTab === "warnings" && warnings.length > 0 && (
          <div className="space-y-6">
            <h3 className="font-bold text-lg flex items-center mb-4">
              <i className="fas fa-wrench mr-2 text-yellow-500"></i>
              Fix Options:
            </h3>

            {/* Original GeoJSON Visualization */}
            <div className="mb-6">
              <h4 className="font-medium text-gray-700 mb-2">
                Original GeoJSON:
              </h4>
              <DirectMultiPolygonMap geojson={originalGeojson} />
            </div>

            {/* Option for z-coordinates */}
            {fixes.removeZCoordinates && (
              <div className="card">
                <h4 className="card-title flex items-center">
                  <i className="fas fa-cube mr-2 text-blue-500"></i>
                  Z-Coordinates Detected
                </h4>
                <p className="mb-4 text-gray-600">
                  Your file has z-coordinates which may cause compatibility
                  issues.
                </p>
                <button
                  onClick={() => handleApplyFix("removeZCoordinates")}
                  className="btn btn-primary"
                >
                  <i className="fas fa-trash-alt mr-2"></i>
                  Remove Z-Coordinates
                </button>
              </div>
            )}

            {/* Option for MultiPolygon */}
            {fixes.convertToSingleRing && (
              <div className="card">
                <h4 className="card-title flex items-center">
                  <i className="fas fa-object-group mr-2 text-blue-500"></i>
                  MultiPolygon Detected
                </h4>
                <p className="mb-4 text-gray-600">
                  Your file has a MultiPolygon type. This application requires a
                  single Polygon format. Click the button below to convert the
                  MultiPolygon to a standard Polygon.
                </p>
                <button
                  onClick={() => handleApplyFix("convertToSingleRing")}
                  className="btn btn-primary"
                >
                  <i className="fas fa-magic mr-2"></i>
                  Convert to Single Polygon
                </button>
              </div>
            )}

            {/* Option for multiple polygons */}
            {fixes.selectPolygon && !fixes.convertToPolygon && (
              <div className="card">
                <h4 className="card-title flex items-center">
                  <i className="fas fa-shapes mr-2 text-blue-500"></i>
                  Multiple Polygons Detected
                </h4>
                <p className="mb-4 text-gray-600">
                  Your file has multiple polygons. This application requires a
                  format with a single polygon. Click the button below to use
                  the first polygon.
                </p>
                <button
                  onClick={() => handleApplyFix("selectPolygon")}
                  className="btn btn-primary"
                >
                  <i className="fas fa-check-circle mr-2"></i>
                  Convert to Single Polygon
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "fixed" && fixedGeojson && (
          <div className="space-y-6">
            <h3 className="font-bold text-lg flex items-center mb-4">
              <i className="fas fa-check-circle mr-2 text-green-500"></i>
              Fixed GeoJSON:
            </h3>

            <div className="mb-6">
              <DirectMultiPolygonMap geojson={fixedGeojson} />
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => handleDownload(fixedGeojson)}
                className="btn btn-secondary"
              >
                <i className="fas fa-download mr-2"></i>
                Download GeoJSON
              </button>

              <button
                onClick={() => {
                  setFixedGeojson(null);
                  setActiveTab("warnings");
                }}
                className="btn btn-outline"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Back to Fix Options
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
