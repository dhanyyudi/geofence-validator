"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  useValidatorStore,
  downloadGeojson,
} from "../utils/validatorStore";
import { validateGeofence } from "../utils/geofenceUtils";

const GeofenceMapView = dynamic(() => import("./GeofenceMapView"), {
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

export default function Validator() {
  const validationResult = useValidatorStore((s) => s.validationResult);
  const originalGeojson = useValidatorStore((s) => s.originalGeojson);
  const history = useValidatorStore((s) => s.history);
  const historyIndex = useValidatorStore((s) => s.historyIndex);
  const sourceFilename = useValidatorStore((s) => s.sourceFilename);
  const applySelectedFixes = useValidatorStore((s) => s.applySelectedFixes);
  const undo = useValidatorStore((s) => s.undo);
  const redo = useValidatorStore((s) => s.redo);

  const [selectedFixes, setSelectedFixes] = useState(() => new Set());

  const currentGeojson = useMemo(() => {
    if (historyIndex >= 0 && history[historyIndex]) {
      return history[historyIndex].geojson;
    }
    return originalGeojson;
  }, [historyIndex, history, originalGeojson]);

  const currentValidation = useMemo(
    () => (currentGeojson ? validateGeofence(currentGeojson) : null),
    [currentGeojson]
  );

  useEffect(() => {
    setSelectedFixes(new Set());
  }, [currentGeojson]);

  if (!validationResult || !currentValidation) return null;

  const { errors } = currentValidation;
  const issues = currentValidation.issues;
  const stats = currentValidation.stats;
  const isValid = currentValidation.isValid;
  const fixableIssues = issues.filter((i) => i.fixId);
  const nothingWrong = isValid && issues.length === 0;
  const viewingFixed = historyIndex >= 0;
  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  const toggleFix = (fixId) => {
    setSelectedFixes((prev) => {
      const next = new Set(prev);
      if (next.has(fixId)) next.delete(fixId);
      else next.add(fixId);
      return next;
    });
  };

  const selectAll = () => {
    const all = fixableIssues.map((i) => i.fixId);
    setSelectedFixes(new Set(all));
  };

  const clearSelection = () => setSelectedFixes(new Set());

  const handleApply = () => {
    const ids = Array.from(selectedFixes);
    if (ids.length === 0) return;
    applySelectedFixes(ids);
    setSelectedFixes(new Set());
  };

  const handleDownload = () => {
    downloadGeojson(currentGeojson, sourceFilename, "fixed");
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold mb-4 flex items-center">
          <i className="fas fa-check-circle mr-2 text-blue-500"></i>
          Validation Results
          {sourceFilename && (
            <span className="ml-3 text-sm font-normal text-gray-500">
              ({sourceFilename})
            </span>
          )}
        </h2>

        {nothingWrong ? (
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
                  Errors:
                </h3>
                <ul className="list-disc pl-5">
                  {errors.map((error, index) => (
                    <li key={`error-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {issues.length > 0 && (
              <div className="alert alert-warning">
                <h3 className="font-bold mb-1 flex items-center">
                  <i className="fas fa-exclamation-triangle mr-2"></i>
                  Detected issues ({issues.length}):
                </h3>
                <ul className="list-disc pl-5">
                  {issues.map((w) => (
                    <li key={`issue-${w.id}`}>
                      <span className="font-medium">{w.title}</span>
                      {" — "}
                      <span className="text-gray-700">{w.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {stats?.polygonCount > 1 && (
          <div className="mt-4 text-xs text-gray-500">
            Polygon stats:{" "}
            {stats.polygons
              .map(
                (p, i) =>
                  `#${i + 1}: ${(p.area / 1_000_000).toFixed(2)} km² (${p.pointCount} pts)`
              )
              .join(" · ")}
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        <div>
          <h3 className="font-medium text-gray-700 mb-2">
            {viewingFixed ? "Fixed GeoJSON" : "Original GeoJSON"}
          </h3>
          <GeofenceMapView geojson={currentGeojson} />
        </div>

        {fixableIssues.length > 0 && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold flex items-center">
                <i className="fas fa-wrench mr-2 text-yellow-500"></i>
                Fix options
              </h3>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={selectAll}
                  className="text-blue-600 hover:underline"
                >
                  Select all
                </button>
                <span className="text-gray-400">|</span>
                <button
                  onClick={clearSelection}
                  className="text-gray-600 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {fixableIssues.map((issue) => (
                <label
                  key={issue.fixId}
                  className="flex items-start p-3 bg-white rounded border border-gray-200 cursor-pointer hover:border-blue-400"
                >
                  <input
                    type="checkbox"
                    checked={selectedFixes.has(issue.fixId)}
                    onChange={() => toggleFix(issue.fixId)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">
                      {issue.title}
                    </div>
                    <div className="text-sm text-gray-600">
                      {issue.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 items-center">
              <button
                onClick={handleApply}
                disabled={selectedFixes.size === 0}
                className={`btn ${
                  selectedFixes.size === 0
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "btn-primary"
                }`}
              >
                <i className="fas fa-magic mr-2"></i>
                Apply {selectedFixes.size > 0 && `(${selectedFixes.size})`} fix
                {selectedFixes.size === 1 ? "" : "es"}
              </button>

              <button
                onClick={undo}
                disabled={!canUndo}
                className={`btn btn-outline ${!canUndo ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <i className="fas fa-undo mr-2"></i>
                Undo
              </button>

              <button
                onClick={redo}
                disabled={!canRedo}
                className={`btn btn-outline ${!canRedo ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <i className="fas fa-redo mr-2"></i>
                Redo
              </button>

              {viewingFixed && (
                <button
                  onClick={handleDownload}
                  className="btn btn-secondary ml-auto"
                >
                  <i className="fas fa-download mr-2"></i>
                  Download fixed GeoJSON
                </button>
              )}
            </div>

            {history.length > 0 && (
              <div className="mt-3 text-xs text-gray-500">
                Fix history: {history.length} step(s)
                {historyIndex >= 0 && ` · viewing step ${historyIndex + 1}`}
              </div>
            )}
          </div>
        )}

        {nothingWrong && (
          <div className="flex justify-end">
            <button onClick={handleDownload} className="btn btn-secondary">
              <i className="fas fa-download mr-2"></i>
              Download GeoJSON
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
