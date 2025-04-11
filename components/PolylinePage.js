"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import DashboardHeader from "../components/DashboardHeader";
import PolylineConverter from "../components/PolylineConverter";

// Import PolylineViewer component dynamically WITHOUT ANY SSR
const PolylineViewer = dynamic(() => import("../components/PolylineViewer"), {
  ssr: false, // This is critical to prevent window reference errors
  loading: () => (
    <div className="h-96 bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <i className="fas fa-spinner fa-spin text-blue-500 text-3xl mb-3"></i>
        <p>Loading Map Components...</p>
      </div>
    </div>
  ),
});

export default function PolylinePage() {
  const [conversionResult, setConversionResult] = useState(null);

  const handleConversionComplete = (result) => {
    setConversionResult(result);
    // Use a larger offset to ensure header doesn't cover content
    if (typeof window !== "undefined") {
      setTimeout(() => {
        const element = document.getElementById("conversion-result");
        if (element) {
          window.scrollTo({
            top: element.offsetTop - 80,
            behavior: "smooth",
          });
        }
      }, 100);
    }
  };

  return (
    <div className="min-h-screen">
      <DashboardHeader />

      <div className="dashboard-container">
        <div className="dashboard-sidebar">
          <PolylineConverter onConversionComplete={handleConversionComplete} />

          <div className="mt-6">
            <h3 className="font-medium text-gray-700 mb-2">Help</h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <i className="fas fa-info-circle text-blue-500 mr-2"></i>
                  About Polyline Converter
                </h4>
                <p className="mt-2 text-gray-600">
                  This tool decodes encoded polyline strings to GeoJSON format
                  and visualizes them on a map.
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <i className="fas fa-link text-blue-500 mr-2"></i>
                  OSRM URL Support
                </h4>
                <p className="mt-2 text-gray-600 text-sm">
                  You can paste an OSRM API URL to extract and decode the
                  polyline.
                </p>
                <div className="mt-1 text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded overflow-x-auto break-all">
                  https://mapbox-osrm-proxy.example.com/tdroute/v1/[routing_profile]/[coordinates]?parameters
                </div>
                <p className="mt-2 text-gray-600 text-sm">
                  For routes with multiple waypoints, you can select individual
                  segments to visualize separately.
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <i className="fas fa-lightbulb text-yellow-500 mr-2"></i>
                  What are Polylines?
                </h4>
                <p className="mt-2 text-gray-600">
                  Polylines are encoded strings that represent a series of
                  geographic coordinates, commonly used in mapping applications
                  to efficiently store and transmit route data.
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <i className="fas fa-cog text-gray-500 mr-2"></i>
                  Precision Options
                </h4>
                <ul className="mt-2 text-gray-600 space-y-2 pl-5 list-disc">
                  <li>
                    <strong>Precision 5:</strong> Default for Google Maps
                  </li>
                  <li>
                    <strong>Precision 6:</strong> Higher accuracy (used for some
                    GIS applications)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-content">
          <div id="conversion-result">
            {conversionResult && (
              <PolylineViewer conversionResult={conversionResult} />
            )}

            {!conversionResult && (
              <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow-md">
                <div className="text-center p-8 max-w-md">
                  <i className="fas fa-route text-blue-500 text-5xl mb-4"></i>
                  <h3 className="text-xl font-medium text-gray-800 mb-2">
                    Welcome to Polyline Converter
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Enter an encoded polyline string to decode and visualize it
                    on a map. You can also download the result as GeoJSON.
                  </p>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <i className="fas fa-keyboard text-blue-500 text-xl mb-2"></i>
                      <p className="text-sm text-gray-700">Enter Polyline</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <i className="fas fa-map-marked-alt text-blue-500 text-xl mb-2"></i>
                      <p className="text-sm text-gray-700">Visualize</p>
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
