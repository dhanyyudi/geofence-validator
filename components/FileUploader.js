"use client";

import { useState, useRef } from "react";
import { validateGeofence } from "../utils/geofenceUtils";

export default function FileUploader({ onValidationComplete }) {
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // File extension validation
    if (!selectedFile.name.endsWith(".geojson")) {
      setError("Error: Only files with .geojson extension are allowed.");
      setFile(null);
      return;
    }

    setError(null);
    setFile(selectedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    // File extension validation
    if (!droppedFile.name.endsWith(".geojson")) {
      setError("Error: Only files with .geojson extension are allowed.");
      setFile(null);
      return;
    }

    setError(null);
    setFile(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const content = e.target.result;
          const geojsonData = JSON.parse(content);

          // GeoJSON validation
          const validationResult = validateGeofence(geojsonData);

          // Send validation result to parent component
          onValidationComplete(validationResult);
        } catch (err) {
          setError(`Error parsing GeoJSON: ${err.message}`);
        }
        setIsLoading(false);
      };

      reader.onerror = () => {
        setError("Error reading file.");
        setIsLoading(false);
      };

      reader.readAsText(file);
    } catch (err) {
      setError(`Error: ${err.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title flex items-center">
        <i className="fas fa-file-upload mr-2 text-blue-500"></i>
        Upload Geofence File
      </h2>

      <div
        className={`mt-4 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson"
          onChange={handleFileChange}
          className="hidden"
        />

        <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-3"></i>
        <p className="text-gray-600 mb-2">
          {isDragging
            ? "Drop file here"
            : "Drag & drop GeoJSON file or click to select"}
        </p>
        <p className="text-xs text-gray-500">
          Only .geojson files are accepted
        </p>
      </div>

      {file && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center">
          <i className="fas fa-file-code text-blue-500 mr-2"></i>
          <div className="flex-1">
            <p className="font-medium text-gray-700">{file.name}</p>
            <p className="text-xs text-gray-500">
              {(file.size / 1024).toFixed(2)} KB
            </p>
          </div>
          <button
            className="text-gray-500 hover:text-red-500"
            onClick={(e) => {
              e.stopPropagation();
              setFile(null);
            }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 alert alert-error">
          <i className="fas fa-exclamation-circle mr-2"></i>
          {error}
        </div>
      )}

      <button
        onClick={handleUpload}
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
            Processing...
          </>
        ) : (
          <>
            <i className="fas fa-check-circle mr-2"></i>
            Validate Geofence
          </>
        )}
      </button>

      <div className="mt-4 text-xs text-gray-500">
        <p className="flex items-center">
          <i className="fas fa-lock mr-1"></i>
          Your file is processed locally and not sent to any server.
        </p>
      </div>
    </div>
  );
}
