"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import DashboardHeader from "../components/DashboardHeader";
import GeofenceComparer from "../components/GeofenceComparer";

// Import map component dynamically to avoid SSR issues
const GeofenceComparisonMap = dynamic(
  () => import("../components/GeofenceComparisonMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-blue-500 text-3xl mb-3"></i>
          <p>Loading Map Components...</p>
        </div>
      </div>
    ),
  }
);

export default function ComparisonPage() {
  const [comparisonData, setComparisonData] = useState(null);

  const handleComparisonReady = (data) => {
    setComparisonData(data);
    // Scroll to the comparison result
    setTimeout(() => {
      const element = document.getElementById("comparison-result");
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
          <GeofenceComparer onComparisonReady={handleComparisonReady} />

          <div className="mt-6">
            <h3 className="font-medium text-gray-700 mb-2">Help</h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <i className="fas fa-info-circle text-blue-500 mr-2"></i>
                  About Comparison
                </h4>
                <p className="mt-2 text-gray-600">
                  This tool allows you to compare two geofence files visually
                  and analyze their intersection.
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <i className="fas fa-lightbulb text-yellow-500 mr-2"></i>
                  How to Use
                </h4>
                <ul className="mt-2 text-gray-600 space-y-2 pl-5 list-disc">
                  <li>Upload two .geojson files</li>
                  <li>Click &quot;Compare Geofences&quot; to visualize them</li>
                  <li>Toggle layers to see different views</li>
                  <li>Download the comparison as an image</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-content">
          <div id="comparison-result">
            {comparisonData ? (
              <GeofenceComparisonMap comparisonData={comparisonData} />
            ) : (
              <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow-md">
                <div className="text-center p-8 max-w-md">
                  <i className="fas fa-exchange-alt text-blue-500 text-5xl mb-4"></i>
                  <h3 className="text-xl font-medium text-gray-800 mb-2">
                    Welcome to Geofence Comparison
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Upload two GeoJSON files in the sidebar to compare their
                    boundaries and visualize the intersection.
                  </p>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <i className="fas fa-upload text-blue-500 text-xl mb-2"></i>
                      <p className="text-sm text-gray-700">Upload</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <i className="fas fa-map-marked-alt text-blue-500 text-xl mb-2"></i>
                      <p className="text-sm text-gray-700">Compare</p>
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
