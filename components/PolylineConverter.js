"use client";

import { useState, useRef } from "react";
import {
  decodePolyline,
  coordinatesToGeoJSON,
  polylineToPolygon,
  validateCoordinates,
} from "../utils/PolylineUtils";
import {
  extractParametersFromURL,
  extractPolylineFromURL,
  normalizePolylineInput,
} from "../utils/OSRMUtils";

export default function PolylineConverter({ onConversionComplete }) {
  const [directPolyline, setDirectPolyline] = useState("");
  const [urlPolyline, setUrlPolyline] = useState("");
  const [filePolyline, setFilePolyline] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [precision, setPrecision] = useState(6);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [outputType, setOutputType] = useState("linestring"); // "linestring" or "polygon"
  const [inputMethod, setInputMethod] = useState("direct"); // "direct", "url", or "file"
  const [osrmUrl, setOsrmUrl] = useState("");
  const [apiResponse, setApiResponse] = useState(null);
  const [routeSegments, setRouteSegments] = useState([]);
  const [selectedSegment, setSelectedSegment] = useState({
    type: "overall", // 'overall', 'leg', or 'step'
    legIndex: null,
    stepIndex: null,
  });

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleInputChange = (e) => {
    setDirectPolyline(e.target.value);
    setApiResponse(null);
    setRouteSegments([]);
    setSelectedSegment({ type: "overall", legIndex: null, stepIndex: null });
    if (error) setError(null);
  };

  const handleUrlChange = (e) => {
    setOsrmUrl(e.target.value);
    setUrlPolyline("");
    setApiResponse(null);
    setRouteSegments([]);
    setSelectedSegment({ type: "overall", legIndex: null, stepIndex: null });
    if (error) setError(null);
  };

  const handlePrecisionChange = (e) => {
    setPrecision(parseInt(e.target.value));
  };

  const handleOutputTypeChange = (e) => {
    setOutputType(e.target.value);
  };

  const handleInputMethodChange = (method) => {
    setInputMethod(method);
    setError(null);

    // Reset segment selection if changing away from URL method
    if (method !== "url") {
      setApiResponse(null);
      setSelectedSegment({ type: "overall", legIndex: null, stepIndex: null });
      setRouteSegments([]);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        setFilePolyline(content.trim());
        setUploadedFileName(file.name);
        setApiResponse(null);
        setRouteSegments([]);
        setSelectedSegment({ type: "overall", legIndex: null, stepIndex: null });
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

  const handleFetchFromUrl = async () => {
    if (!osrmUrl.trim()) {
      setError("Please enter a valid OSRM API URL.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await extractPolylineFromURL(osrmUrl);
      if (result.success) {
        setUrlPolyline(result.encodedPolyline);
        setApiResponse(result.response);
        const params = extractParametersFromURL(osrmUrl);
        if (!params.error && (params.geometries === "polyline" || params.geometries === "polyline6")) {
          setPrecision(params.geometries === "polyline6" ? 6 : 5);
        }

        // Set route segments if available
        if (result.routeSegments && result.routeSegments.length > 0) {
          setRouteSegments(result.routeSegments);
          setSelectedSegment({
            type: "overall",
            legIndex: null,
            stepIndex: null,
          });
        }
      } else {
        setUrlPolyline("");
        setApiResponse(null);
        setRouteSegments([]);
        setSelectedSegment({ type: "overall", legIndex: null, stepIndex: null });
        setError(result.error || "Failed to extract polyline from URL");
      }
    } catch (err) {
      setUrlPolyline("");
      setApiResponse(null);
      setRouteSegments([]);
      setSelectedSegment({ type: "overall", legIndex: null, stepIndex: null });
      setError(`Error fetching from URL: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSegmentSelect = (type, legIndex = null, stepIndex = null) => {
    setSelectedSegment({ type, legIndex, stepIndex });

    // Update the encoded polyline based on selection
    if (type === "overall") {
      setUrlPolyline(apiResponse.routes[0].geometry);
    } else if (type === "leg" && legIndex !== null) {
      const segment = routeSegments.find(
        (seg) => seg.type === "leg" && seg.index === legIndex
      );
      if (segment && segment.geometry) {
        setUrlPolyline(segment.geometry);
      }
    } else if (type === "step" && legIndex !== null && stepIndex !== null) {
      const leg = routeSegments.find(
        (seg) => seg.type === "leg" && seg.index === legIndex
      );
      if (leg && leg.steps && leg.steps[stepIndex]?.geometry) {
        setUrlPolyline(leg.steps[stepIndex].geometry);
      }
    }
  };

  const handleDecode = async () => {
    const activePolyline =
      inputMethod === "direct"
        ? directPolyline
        : inputMethod === "url"
          ? urlPolyline
          : filePolyline;

    if (!activePolyline.trim()) {
      setError("Please enter an encoded polyline string.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const normalizedInput = normalizePolylineInput(activePolyline);
      let polylineToDecode = normalizedInput.value;
      let precisionToUse = normalizedInput.inferredPrecision ?? precision;
      let resolvedApiResponse = apiResponse;
      let resolvedRouteSegments = routeSegments;
      let resolvedSegmentInfo = selectedSegment;

      if (normalizedInput.type === "url") {
        const extracted = await extractPolylineFromURL(normalizedInput.value);
        if (!extracted.success) {
          throw new Error(
            extracted.error || "Failed to extract polyline from URL."
          );
        }

        polylineToDecode = extracted.encodedPolyline;
        resolvedApiResponse = extracted.response || null;
        resolvedRouteSegments = extracted.routeSegments || [];
        resolvedSegmentInfo = { type: "overall", legIndex: null, stepIndex: null };
        if (inputMethod === "url") {
          setApiResponse(resolvedApiResponse);
          setRouteSegments(resolvedRouteSegments);
          setSelectedSegment(resolvedSegmentInfo);
          setUrlPolyline(extracted.encodedPolyline);
        } else if (inputMethod === "direct") {
          setDirectPolyline(extracted.encodedPolyline);
        }
      }

      // Decode the polyline
      const coordinates = validateCoordinates(
        decodePolyline(polylineToDecode, precisionToUse),
        { minPoints: outputType === "polygon" ? 3 : 2 }
      );

      if (precisionToUse !== precision) {
        setPrecision(precisionToUse);
      }

      // Create GeoJSON based on the output type
      let geojson;
      if (outputType === "polygon") {
        geojson = polylineToPolygon(coordinates);
      } else {
        geojson = coordinatesToGeoJSON(coordinates);
      }

      // Prepare metadata based on selected segment
      let metadata = null;
      if (resolvedApiResponse) {
        if (resolvedSegmentInfo.type === "overall") {
          metadata = {
            distance: resolvedApiResponse.routes?.[0]?.distance,
            duration: resolvedApiResponse.routes?.[0]?.duration,
            waypoints: resolvedApiResponse.waypoints?.length || 0,
          };
        } else if (
          resolvedSegmentInfo.type === "leg" &&
          resolvedSegmentInfo.legIndex !== null
        ) {
          const leg = resolvedRouteSegments.find(
            (s) => s.type === "leg" && s.index === resolvedSegmentInfo.legIndex
          );
          metadata = {
            distance: leg?.distance,
            duration: leg?.duration,
            segment: `Leg ${resolvedSegmentInfo.legIndex + 1}: ${leg?.startWaypoint} to ${leg?.endWaypoint}`,
          };
        } else if (resolvedSegmentInfo.type === "step") {
          const leg = resolvedRouteSegments.find(
            (s) => s.type === "leg" && s.index === resolvedSegmentInfo.legIndex
          );
          const step = leg?.steps?.[resolvedSegmentInfo.stepIndex];
          metadata = {
            distance: step?.distance,
            duration: step?.duration,
            segment: `Step ${resolvedSegmentInfo.stepIndex + 1} (${step?.name || "Unnamed"})`,
          };
        }
      }

      // Send result to parent component
      if (onConversionComplete) {
        onConversionComplete({
          success: true,
          encodedPolyline: polylineToDecode,
          coordinates,
          geojson,
          outputType,
          metadata,
          segmentInfo: resolvedSegmentInfo,
        });
      }
    } catch (err) {
      setError(`Error decoding polyline: ${err.message}`);
      if (onConversionComplete) {
        onConversionComplete({ success: false, error: err.message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearInput = () => {
    if (inputMethod === "direct") {
      setDirectPolyline("");
    } else if (inputMethod === "url") {
      setOsrmUrl("");
      setUrlPolyline("");
    } else if (inputMethod === "file") {
      setFilePolyline("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
    setUploadedFileName("");
    setApiResponse(null);
    setRouteSegments([]);
    setSelectedSegment({ type: "overall", legIndex: null, stepIndex: null });
    setError(null);
    if (onConversionComplete) {
      onConversionComplete(null);
    }
  };

  const canDecode = Boolean(
    (inputMethod === "direct" && directPolyline.trim()) ||
      (inputMethod === "url" && urlPolyline.trim() && apiResponse) ||
      (inputMethod === "file" &&
        uploadedFileName &&
        filePolyline.trim())
  );

  return (
    <div className="card">
      <h2 className="card-title flex items-center">
        <i className="fas fa-route mr-2 text-blue-500"></i>
        Polyline Converter
      </h2>

      {/* Input Method Tabs */}
      <div className="flex border-b mb-4">
        <button
          onClick={() => handleInputMethodChange("direct")}
          className={`py-2 px-4 ${
            inputMethod === "direct"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <i className="fas fa-keyboard mr-2"></i>
          Direct Input
        </button>
        <button
          onClick={() => handleInputMethodChange("url")}
          className={`py-2 px-4 ${
            inputMethod === "url"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <i className="fas fa-link mr-2"></i>
          OSRM URL
        </button>
        <button
          onClick={() => handleInputMethodChange("file")}
          className={`py-2 px-4 ${
            inputMethod === "file"
              ? "border-b-2 border-blue-500 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <i className="fas fa-file mr-2"></i>
          File
        </button>
      </div>

      {/* Direct Input Method */}
      {inputMethod === "direct" && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Encoded Polyline String
          </label>
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={directPolyline}
              onChange={handleInputChange}
              placeholder="Paste encoded polyline string here..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 min-h-[120px]"
            />
            {directPolyline && (
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                onClick={handleClearInput}
              >
                <i className="fas fa-times-circle"></i>
              </button>
            )}
          </div>
        </div>
      )}

      {/* URL Input Method */}
      {inputMethod === "url" && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            OSRM API URL
          </label>
          <div className="relative">
            <input
              type="text"
              value={osrmUrl}
              onChange={handleUrlChange}
              placeholder="https://mapbox-osrm-proxy.example.com/tdroute/v1/van/..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            />
            {osrmUrl && (
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
                onClick={handleClearInput}
              >
                <i className="fas fa-times-circle"></i>
              </button>
            )}
          </div>
          <button
            onClick={handleFetchFromUrl}
            disabled={isLoading || !osrmUrl.trim()}
            className={`mt-2 py-2 px-4 rounded-md text-sm flex items-center ${
              isLoading || !osrmUrl.trim()
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Fetching...
              </>
            ) : (
              <>
                <i className="fas fa-download mr-2"></i>
                Fetch Polyline
              </>
            )}
          </button>

          {/* Route Segment Selector */}
          {routeSegments.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Route Segment
              </label>
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="p-2 bg-gray-50 border-b border-gray-300">
                  <div
                    className={`p-2 rounded cursor-pointer ${
                      selectedSegment.type === "overall"
                        ? "bg-blue-100 text-blue-800"
                        : "hover:bg-gray-100"
                    }`}
                    onClick={() => handleSegmentSelect("overall")}
                  >
                    <div className="font-medium flex items-center">
                      <i className="fas fa-route mr-2 text-blue-500"></i>
                      Complete Route
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {apiResponse.routes[0].distance && (
                        <span className="mr-3">
                          Distance:{" "}
                          {(apiResponse.routes[0].distance / 1000).toFixed(1)}{" "}
                          km
                        </span>
                      )}
                      {apiResponse.routes[0].duration && (
                        <span>
                          Duration:{" "}
                          {Math.floor(apiResponse.routes[0].duration / 60)} min
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto p-2">
                  {/* Legs (segments between waypoints) */}
                  {routeSegments.map((leg, legIndex) => (
                    <div key={`leg-${legIndex}`} className="mb-3">
                      <div
                        className={`p-2 rounded cursor-pointer ${
                          selectedSegment.type === "leg" &&
                          selectedSegment.legIndex === legIndex
                            ? "bg-blue-100 text-blue-800"
                            : "hover:bg-gray-100"
                        }`}
                        onClick={() => handleSegmentSelect("leg", legIndex)}
                      >
                        <div className="font-medium flex items-center">
                          <i className="fas fa-map-signs mr-2 text-green-500"></i>
                          Leg {legIndex + 1}: {leg.startWaypoint} to{" "}
                          {leg.endWaypoint}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {leg.distance && (
                            <span className="mr-3">
                              Distance: {(leg.distance / 1000).toFixed(1)} km
                            </span>
                          )}
                          {leg.duration && (
                            <span>
                              Duration: {Math.floor(leg.duration / 60)} min
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Steps within this leg */}
                      {leg.steps && leg.steps.length > 0 && (
                        <div className="ml-4 mt-1 border-l-2 border-gray-200 pl-3">
                          {leg.steps.map((step, stepIndex) => (
                            <div
                              key={`step-${legIndex}-${stepIndex}`}
                              className={`p-2 my-1 rounded cursor-pointer text-sm ${
                                selectedSegment.type === "step" &&
                                selectedSegment.legIndex === legIndex &&
                                selectedSegment.stepIndex === stepIndex
                                  ? "bg-blue-100 text-blue-800"
                                  : "hover:bg-gray-100"
                              }`}
                              onClick={() =>
                                handleSegmentSelect("step", legIndex, stepIndex)
                              }
                            >
                              <div className="flex items-center">
                                <i className="fas fa-walking mr-2 text-yellow-500"></i>
                                {step.name || `Step ${stepIndex + 1}`}
                              </div>
                              {step.distance && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {(step.distance / 1000).toFixed(1)} km
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {urlPolyline && apiResponse && !routeSegments.length && (
            <div className="mt-3 text-sm text-green-600">
              <i className="fas fa-check-circle mr-1"></i>
              Polyline extracted successfully
              <div className="text-xs text-gray-500 mt-1">
                {apiResponse.routes?.[0]?.distance && (
                  <span className="mr-3">
                    Distance:{" "}
                    {(apiResponse.routes[0].distance / 1000).toFixed(1)} km
                  </span>
                )}
                {apiResponse.routes?.[0]?.duration && (
                  <span>
                    Duration: {Math.floor(apiResponse.routes[0].duration / 60)}{" "}
                    min
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* File Input Method */}
      {inputMethod === "file" && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Polyline File
          </label>
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <i className="fas fa-upload mb-3 text-gray-400 text-xl"></i>
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag
                  and drop
                </p>
                <p className="text-xs text-gray-500">
                  TXT file with encoded polyline
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".txt"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {uploadedFileName && (
            <div className="mt-3 text-sm text-green-600">
              <i className="fas fa-check-circle mr-1"></i>
              File loaded successfully: {uploadedFileName}
            </div>
          )}
        </div>
      )}

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
        disabled={isLoading || !canDecode}
        className={`mt-4 w-full py-3 px-4 rounded-md font-medium flex items-center justify-center ${
          isLoading || !canDecode
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
