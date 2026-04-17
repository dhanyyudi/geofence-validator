import { create } from "zustand";
import { validateGeofence, applyFixes } from "./geofenceUtils";

const initialState = {
  sourceFilename: null,
  originalGeojson: null,
  validationResult: null,
  history: [],
  historyIndex: -1,
};

export const useValidatorStore = create((set, get) => ({
  ...initialState,

  loadGeojson: (geojson, filename) => {
    const result = validateGeofence(geojson);
    set({
      sourceFilename: filename || null,
      originalGeojson: geojson,
      validationResult: result,
      history: [],
      historyIndex: -1,
    });
  },

  reset: () => set({ ...initialState }),

  applySelectedFixes: (fixIds) => {
    const { originalGeojson, history, historyIndex } = get();
    if (!originalGeojson || !Array.isArray(fixIds) || fixIds.length === 0) return;
    const fixed = applyFixes(originalGeojson, fixIds);
    const trimmed = history.slice(0, historyIndex + 1);
    const entry = { fixIds: [...fixIds], geojson: fixed, timestamp: Date.now() };
    set({
      history: [...trimmed, entry],
      historyIndex: trimmed.length,
    });
  },

  undo: () => {
    const { historyIndex } = get();
    if (historyIndex <= 0) {
      set({ historyIndex: -1 });
      return;
    }
    set({ historyIndex: historyIndex - 1 });
  },

  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex >= history.length - 1) return;
    set({ historyIndex: historyIndex + 1 });
  },

  currentGeojson: () => {
    const { history, historyIndex, originalGeojson } = get();
    if (historyIndex < 0 || !history[historyIndex]) return originalGeojson;
    return history[historyIndex].geojson;
  },
}));

export function downloadGeojson(geojson, sourceFilename, suffix = "fixed") {
  if (!geojson) return;
  const json = JSON.stringify(geojson, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const baseName = sourceFilename
    ? sourceFilename.replace(/\.geojson$/i, "")
    : "geofence";
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}.${suffix}.geojson`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
