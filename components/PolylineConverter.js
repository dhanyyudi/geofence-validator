"use client";

import { useState, useRef } from "react";
import {
  decodePolyline,
  polylineToGeoJSON,
  encodePolyline,
  polylineToPolygon,
} from "../utils/PolylineUtils";

export default function PolylineConverter({ onConversionComplete }) {
  const [encodedPolyline, setEncodedPolyline] = useState("");
  const [precision, setPrecision] = useState(6);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [outputType, setOutputType] = useState("linestring"); // "linestring" or "polygon"
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleInputChange = (e) => {
    setEncodedPolyline(e.target.value);
    if (error) setError(null);
  };

  const handlePrecisionChange = (e) => {
    setPrecision(parseInt(e.target.value));
  };

  const handleOutputTypeChange = (e) => {
    setOutputType(e.target.value);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        setEncodedPolyline(content.trim());
        if (error) setError(null);
      } catch (err) {
        setError(`Error reading file: ${err.message}`);
      }
    };
    reader.onerror = () => {
      setError("Error reading file.");
    };
    reader.readAsText(file);
  };

  const handleDecode = () => {
    if (!encodedPolyline.trim()) {
      setError("Please enter an encoded polyline string.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Decode the polyline
      const coordinates = decodePolyline(encodedPolyline, precision);

      if (coordinates.length === 0) {
        setError("No valid coordinates found in the encoded polyline.");
        setIsLoading(false);
        return;
      }

      // Create GeoJSON based on the output type
      let geojson;
      if (outputType === "polygon") {
        geojson = polylineToPolygon(coordinates);
      } else {
        geojson = polylineToGeoJSON(encodedPolyline, precision);
      }

      // Send result to parent component
      if (onConversionComplete) {
        onConversionComplete({
          success: true,
          encodedPolyline,
          coordinates,
          geojson,
          outputType,
        });
      }
    } catch (err) {
      setError(`Error decoding polyline: ${err.message}`);
      if (onConversionComplete) {
        onConversionComplete({ success: false, error: err.message });
      }
    }

    setIsLoading(false);
  };

  const handleClearInput = () => {
    setEncodedPolyline("");
    setError(null);
    if (onConversionComplete) {
      onConversionComplete(null);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title flex items-center">
        <i className="fas fa-route mr-2 text-blue-500"></i>
        Polyline Converter
      </h2>

      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Encoded Polyline String
        </label>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={encodedPolyline}
            onChange={handleInputChange}
            placeholder="Paste encoded polyline string here..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
          />
          {encodedPolyline && (
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              onClick={handleClearInput}
            >
              <i className="fas fa-times-circle"></i>
            </button>
          )}
        </div>

        <div className="flex items-center mt-2">
          <span className="text-sm text-gray-500 mr-2">
            or upload from file:
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current.click()}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          >
            <i className="fas fa-upload mr-1"></i>
            Upload
          </button>
        </div>
      </div>

      <div className="space-y-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Precision
          </label>
          <select
            value={precision}
            onChange={handlePrecisionChange}
            className="w-full p-2 border border-gray-300 rounded-lg"
          >
            <option value={5}>5 (Google Maps default)</option>
            <option value={6}>6 (Higher precision)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Output Format
          </label>
          <select
            value={outputType}
            onChange={handleOutputTypeChange}
            className="w-full p-2 border border-gray-300 rounded-lg"
          >
            <option value="linestring">LineString</option>
            <option value="polygon">Polygon (closed path)</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-4 alert alert-error">
          <i className="fas fa-exclamation-circle mr-2"></i>
          {error}
        </div>
      )}

      <button
        onClick={handleDecode}
        disabled={isLoading || !encodedPolyline.trim()}
        className={`mt-4 w-full py-3 px-4 rounded-md font-medium flex items-center justify-center ${
          isLoading || !encodedPolyline.trim()
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
            <i className="fas fa-play-circle mr-2"></i>
            Decode Polyline
          </>
        )}
      </button>

      <div className="mt-4 text-xs text-gray-500">
        <p className="flex items-center">
          <i className="fas fa-info-circle mr-1"></i>
          Polyline encoding is a compact way to represent routes in mapping
          applications.
        </p>
      </div>
    </div>
  );
}
