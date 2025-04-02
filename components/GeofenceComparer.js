"use client";

import { useState, useRef } from "react";
import { validateGeofence } from "../utils/geofenceUtils";

export default function GeofenceComparer({ onComparisonReady }) {
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging1, setIsDragging1] = useState(false);
  const [isDragging2, setIsDragging2] = useState(false);
  const fileInput1Ref = useRef(null);
  const fileInput2Ref = useRef(null);

  // Handler for first file input
  const handleFile1Change = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // File extension validation
    if (!selectedFile.name.endsWith(".geojson")) {
      setError("Error: Only files with .geojson extension are allowed.");
      setFile1(null);
      return;
    }

    setError(null);
    setFile1(selectedFile);
  };

  // Handler for second file input
  const handleFile2Change = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // File extension validation
    if (!selectedFile.name.endsWith(".geojson")) {
      setError("Error: Only files with .geojson extension are allowed.");
      setFile2(null);
      return;
    }

    setError(null);
    setFile2(selectedFile);
  };

  // Drag & Drop handlers for first file
  const handleDragOver1 = (e) => {
    e.preventDefault();
    setIsDragging1(true);
  };

  const handleDragLeave1 = () => {
    setIsDragging1(false);
  };

  const handleDrop1 = (e) => {
    e.preventDefault();
    setIsDragging1(false);

    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    // File extension validation
    if (!droppedFile.name.endsWith(".geojson")) {
      setError("Error: Only files with .geojson extension are allowed.");
      setFile1(null);
      return;
    }

    setError(null);
    setFile1(droppedFile);
  };

  // Drag & Drop handlers for second file
  const handleDragOver2 = (e) => {
    e.preventDefault();
    setIsDragging2(true);
  };

  const handleDragLeave2 = () => {
    setIsDragging2(false);
  };

  const handleDrop2 = (e) => {
    e.preventDefault();
    setIsDragging2(false);

    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    // File extension validation
    if (!droppedFile.name.endsWith(".geojson")) {
      setError("Error: Only files with .geojson extension are allowed.");
      setFile2(null);
      return;
    }

    setError(null);
    setFile2(droppedFile);
  };

  const handleCompare = async () => {
    if (!file1 || !file2) {
      setError("Please select two files to compare.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Read the first file
      const reader1 = new FileReader();
      reader1.onload = async (e1) => {
        try {
          const content1 = e1.target.result;
          const geojson1 = JSON.parse(content1);

          // Read the second file
          const reader2 = new FileReader();
          reader2.onload = async (e2) => {
            try {
              const content2 = e2.target.result;
              const geojson2 = JSON.parse(content2);

              // Validate both GeoJSON files
              const validation1 = validateGeofence(geojson1);
              const validation2 = validateGeofence(geojson2);

              // Send both geojson data to parent component
              onComparisonReady({
                geojson1: geojson1,
                geojson2: geojson2,
                file1Name: file1.name,
                file2Name: file2.name,
                validation1,
                validation2,
              });

              setIsLoading(false);
            } catch (err) {
              setError(`Error parsing second GeoJSON: ${err.message}`);
              setIsLoading(false);
            }
          };

          reader2.onerror = () => {
            setError("Error reading second file.");
            setIsLoading(false);
          };

          reader2.readAsText(file2);
        } catch (err) {
          setError(`Error parsing first GeoJSON: ${err.message}`);
          setIsLoading(false);
        }
      };

      reader1.onerror = () => {
        setError("Error reading first file.");
        setIsLoading(false);
      };

      reader1.readAsText(file1);
    } catch (err) {
      setError(`Error: ${err.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title flex items-center">
        <i className="fas fa-exchange-alt mr-2 text-blue-500"></i>
        Compare Geofence Files
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* First file uploader */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            First Geofence File
          </label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragging1
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={handleDragOver1}
            onDragLeave={handleDragLeave1}
            onDrop={handleDrop1}
            onClick={() => fileInput1Ref.current.click()}
          >
            <input
              ref={fileInput1Ref}
              type="file"
              accept=".geojson"
              onChange={handleFile1Change}
              className="hidden"
            />

            <i className="fas fa-file-upload text-2xl text-gray-400 mb-2"></i>
            <p className="text-sm text-gray-600">
              {isDragging1
                ? "Drop file here"
                : "Drag & drop GeoJSON file or click to select"}
            </p>
          </div>

          {file1 && (
            <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200 flex items-center">
              <i className="fas fa-file-code text-blue-500 mr-2"></i>
              <div className="flex-1 truncate">
                <p className="font-medium text-sm text-gray-700">
                  {file1.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(file1.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <button
                className="text-gray-500 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile1(null);
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          )}
        </div>

        {/* Second file uploader */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Second Geofence File
          </label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragging2
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={handleDragOver2}
            onDragLeave={handleDragLeave2}
            onDrop={handleDrop2}
            onClick={() => fileInput2Ref.current.click()}
          >
            <input
              ref={fileInput2Ref}
              type="file"
              accept=".geojson"
              onChange={handleFile2Change}
              className="hidden"
            />

            <i className="fas fa-file-upload text-2xl text-gray-400 mb-2"></i>
            <p className="text-sm text-gray-600">
              {isDragging2
                ? "Drop file here"
                : "Drag & drop GeoJSON file or click to select"}
            </p>
          </div>

          {file2 && (
            <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200 flex items-center">
              <i className="fas fa-file-code text-blue-500 mr-2"></i>
              <div className="flex-1 truncate">
                <p className="font-medium text-sm text-gray-700">
                  {file2.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(file2.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <button
                className="text-gray-500 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile2(null);
                }}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 alert alert-error">
          <i className="fas fa-exclamation-circle mr-2"></i>
          {error}
        </div>
      )}

      <button
        onClick={handleCompare}
        disabled={!file1 || !file2 || isLoading}
        className={`mt-4 w-full py-2 px-4 rounded-md font-medium flex items-center justify-center ${
          !file1 || !file2 || isLoading
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "btn btn-primary"
        }`}
      >
        {isLoading ? (
          <>
            <i className="fas fa-spinner fa-spin mr-2"></i>
            Processing...
          </>
        ) : (
          <>
            <i className="fas fa-exchange-alt mr-2"></i>
            Compare Geofences
          </>
        )}
      </button>

      <div className="mt-4 text-xs text-gray-500">
        <p className="flex items-center">
          <i className="fas fa-lock mr-1"></i>
          Your files are processed locally and not sent to any server.
        </p>
      </div>
    </div>
  );
}
