"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import DashboardHeader from "../components/DashboardHeader";
import { convertSpatialFile } from "../utils/dataConversion";
import { downloadGeojson } from "../utils/validatorStore";

const GeofenceMapView = dynamic(() => import("../components/GeofenceMapView"), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-100 flex items-center justify-center rounded-lg">
      <div className="text-center">
        <i className="fas fa-spinner fa-spin text-blue-500 text-3xl mb-3"></i>
        <p>Loading Map Components...</p>
      </div>
    </div>
  ),
});

const ACCEPTED_EXTENSIONS = [".kml", ".kmz", ".zip"];

function formatBytes(size) {
  if (!size) return "0 KB";
  return `${(size / 1024).toFixed(2)} KB`;
}

export default function DataConversionPage() {
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  const acceptFile = (candidate) => {
    if (!candidate) return;

    const lowerName = candidate.name.toLowerCase();
    const isAccepted = ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!isAccepted) {
      setError("Unsupported file type. Use .kml, .kmz, or zipped shapefile .zip.");
      setFile(null);
      setResult(null);
      return;
    }

    setFile(candidate);
    setResult(null);
    setError(null);
  };

  const handleClearFile = (e) => {
    e?.stopPropagation();
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConvert = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const converted = await convertSpatialFile(file);
      setResult(converted);
      setTimeout(() => {
        const element = document.getElementById("conversion-result");
        if (element) {
          window.scrollTo({
            top: element.offsetTop - 80,
            behavior: "smooth",
          });
        }
      }, 100);
    } catch (err) {
      setResult(null);
      setError(err.message || "Failed to convert the uploaded file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result?.cleanedGeojson || !file?.name) return;
    downloadGeojson(result.cleanedGeojson, file.name, "cleaned");
  };

  return (
    <div className="min-h-screen">
      <DashboardHeader />

      <div className="dashboard-container">
        <div className="dashboard-sidebar">
          <div className="card">
            <h2 className="card-title flex items-center">
              <i className="fas fa-file-export mr-2 text-blue-500"></i>
              Data Conversion
            </h2>

            <div
              className={`mt-4 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                acceptFile(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".kml,.kmz,.zip"
                onChange={(e) => acceptFile(e.target.files[0])}
                className="hidden"
              />

              <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3"></i>
              <p className="text-gray-600 mb-2">
                {isDragging
                  ? "Drop spatial file here"
                  : "Drag & drop KML, KMZ, or SHP ZIP"}
              </p>
              <p className="text-xs text-gray-500">
                Local-only conversion to clean GeoJSON
              </p>
            </div>

            {file && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center">
                <i className="fas fa-file-code text-blue-500 mr-2"></i>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                </div>
                <button
                  aria-label="Remove file"
                  className="text-gray-500 hover:text-red-500"
                  onClick={handleClearFile}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            )}

            {result && (
              <div className="mt-4 p-3 rounded-lg border border-green-200 bg-green-50 text-sm text-green-700">
                <div className="font-medium flex items-center">
                  <i className="fas fa-check-circle mr-2"></i>
                  Converted from {result.sourceFormat}
                </div>
                <p className="mt-1 text-xs text-green-700/90">
                  Output is normalized to validator-ready GeoJSON.
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 alert alert-error">
                <i className="fas fa-exclamation-circle mr-2"></i>
                {error}
              </div>
            )}

            <button
              onClick={handleConvert}
              disabled={!file || isLoading}
              className={`mt-4 w-full py-2 px-4 rounded-md font-medium flex items-center justify-center ${
                !file || isLoading
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "btn btn-primary"
              }`}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Converting...
                </>
              ) : (
                <>
                  <i className="fas fa-sync-alt mr-2"></i>
                  Convert to Clean GeoJSON
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              disabled={!result?.cleanedGeojson}
              className={`mt-3 w-full py-2 px-4 rounded-md font-medium flex items-center justify-center ${
                !result?.cleanedGeojson
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "btn btn-outline"
              }`}
            >
              <i className="fas fa-download mr-2"></i>
              Download Clean GeoJSON
            </button>

            <div className="mt-4 text-xs text-gray-500">
              <p className="flex items-center">
                <i className="fas fa-lock mr-1"></i>
                Files are converted locally in your browser.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-medium text-gray-700 mb-2">Help</h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <i className="fas fa-info-circle text-blue-500 mr-2"></i>
                  Supported Inputs
                </h4>
                <ul className="mt-2 text-gray-600 space-y-2 pl-5 list-disc">
                  <li>KML</li>
                  <li>KMZ</li>
                  <li>Zipped shapefile (.zip)</li>
                </ul>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <i className="fas fa-check-circle text-green-500 mr-2"></i>
                  Output Standard
                </h4>
                <ul className="mt-2 text-gray-600 space-y-2 pl-5 list-disc">
                  <li>GeoJSON FeatureCollection</li>
                  <li>Single Polygon only</li>
                  <li>No Z coordinates</li>
                  <li>No interior holes</li>
                </ul>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-700 flex items-center">
                  <i className="fas fa-lightbulb text-yellow-500 mr-2"></i>
                  Linework Conversion
                </h4>
                <p className="mt-2 text-gray-600">
                  Closed linework is polygonized automatically. Open lines and
                  point-only data are rejected because they cannot become a clean
                  geofence boundary safely.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-content">
          <div id="conversion-result">
            {result ? (
              <div className="space-y-6">
                <GeofenceMapView geojson={result.cleanedGeojson} height="32rem" />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
                    <div className="text-xs text-gray-500">Source Format</div>
                    <div className="font-semibold text-gray-800 mt-1">
                      {result.sourceFormat}
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
                    <div className="text-xs text-gray-500">Parsed Features</div>
                    <div className="font-semibold text-gray-800 mt-1">
                      {result.summary.featureCount}
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
                    <div className="text-xs text-gray-500">Geometry Types</div>
                    <div className="font-semibold text-gray-800 mt-1">
                      {result.summary.geometryTypes.join(", ") || "Unknown"}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md border border-gray-200">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold text-gray-800">
                      Normalization Summary
                    </h3>
                  </div>
                  <div className="p-4">
                    {result.notes.length > 0 ? (
                      <ul className="space-y-2 text-sm text-gray-700 pl-5 list-disc">
                        {result.notes.map((note, index) => (
                          <li key={`${note}-${index}`}>{note}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-600">
                        No extra normalization was needed after conversion.
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md border border-gray-200">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold text-gray-800">
                      Clean Output
                    </h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-sm text-gray-600">
                      The converted file passed validator requirements and is
                      ready to download as clean GeoJSON.
                    </p>
                    <textarea
                      readOnly
                      value={JSON.stringify(result.cleanedGeojson, null, 2)}
                      className="w-full min-h-[16rem] p-3 border border-gray-300 rounded-lg bg-gray-50 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 bg-white rounded-lg shadow-md">
                <div className="text-center p-8 max-w-md">
                  <i className="fas fa-file-export text-blue-500 text-5xl mb-4"></i>
                  <h3 className="text-xl font-medium text-gray-800 mb-2">
                    Welcome to Data Conversion
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Upload KML, KMZ, or SHP ZIP in the sidebar to convert it
                    into clean GeoJSON that already matches validator
                    requirements.
                  </p>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <i className="fas fa-upload text-blue-500 text-xl mb-2"></i>
                      <p className="text-sm text-gray-700">Upload</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <i className="fas fa-sync-alt text-blue-500 text-xl mb-2"></i>
                      <p className="text-sm text-gray-700">Convert</p>
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
