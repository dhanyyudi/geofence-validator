"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import FileUploader from "../components/FileUploader.js";
import DashboardHeader from "../components/DashboardHeader";
import "leaflet/dist/leaflet.css";

// Import Map component dynamically to avoid SSR errors
const Validator = dynamic(() => import("../components/Validator"), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <i className="fas fa-spinner fa-spin text-blue-500 text-3xl mb-3"></i>
        <p>Loading Map Components...</p>
      </div>
    </div>
  ),
});

// DirectMultiPolygonMap is also loaded dynamically
const DirectMultiPolygonMap = dynamic(
  () => import("../components/DirectMultiPolygonMap"),
  {
    ssr: false,
  }
);

export default function Home() {
  const [validationResult, setValidationResult] = useState(null);

  const handleValidationComplete = (result) => {
    setValidationResult(result);
    // Use a larger offset to ensure header doesn't cover content
    setTimeout(() => {
      const element = document.getElementById("validation-result");
      if (element) {
        window.scrollTo({
          top: element.offsetTop - 80,
          behavior: "smooth",
        });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen">
      <DashboardHeader />

      <div className="dashboard-container">
        <div className="dashboard-sidebar">
          <FileUploader onValidationComplete={handleValidationComplete} />

          <div className="mt-6">
            <h3 className="font-medium text-gray-700 mb-2">Help</h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <i className="fas fa-info-circle text-blue-500 mr-2"></i>
                  About Validator
                </h4>
                <p className="mt-2 text-gray-600">
                  Geofence Validator helps ensure your GeoJSON files conform to
                  required standards.
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <i className="fas fa-check-circle text-green-500 mr-2"></i>
                  Validation Criteria
                </h4>
                <ul className="mt-2 text-gray-600 space-y-2 pl-5 list-disc">
                  <li>File extension must be .geojson</li>
                  <li>Geographic coordinates (lat/lon)</li>
                  <li>No z-coordinates</li>
                  <li>Type must be Polygon, not MultiPolygon</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-content">
          <div id="validation-result">
            {validationResult && (
              <Validator validationResult={validationResult} />
            )}

            {!validationResult && (
              <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow-md">
                <div className="text-center p-8 max-w-md">
                  <i className="fas fa-map-marked-alt text-blue-500 text-5xl mb-4"></i>
                  <h3 className="text-xl font-medium text-gray-800 mb-2">
                    Welcome to Geofence Validator
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Upload a GeoJSON file in the sidebar to validate and fix
                    your geofence.
                  </p>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <i className="fas fa-upload text-blue-500 text-xl mb-2"></i>
                      <p className="text-sm text-gray-700">Upload</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <i className="fas fa-check-circle text-blue-500 text-xl mb-2"></i>
                      <p className="text-sm text-gray-700">Validate</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <i className="fas fa-download text-blue-500 text-xl mb-2"></i>
                      <p className="text-sm text-gray-700">Download</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
