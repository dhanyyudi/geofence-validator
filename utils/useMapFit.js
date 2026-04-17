"use client";

import { useCallback, useEffect, useRef } from "react";

export function useMapFit(mapRef, bounds) {
  const boundsRef = useRef(bounds);
  const fittedForBoundsRef = useRef(null);

  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  const fitToLatestBounds = useCallback(
    (reason = "manual") => {
      const map = mapRef.current;
      const b = boundsRef.current;
      if (!map || !b) {
        console.debug("[useMapFit] skip", reason, {
          hasMap: !!map,
          hasBounds: !!b,
        });
        return;
      }
      if (fittedForBoundsRef.current === b) {
        return;
      }
      try {
        if (typeof map.resize === "function") map.resize();
        map.fitBounds(b, { padding: 40, duration: 400, maxZoom: 16 });
        fittedForBoundsRef.current = b;
        console.debug("[useMapFit] fit ok", reason, b);
      } catch (err) {
        console.warn("[useMapFit] fitBounds failed:", err);
      }
    },
    [mapRef]
  );

  useEffect(() => {
    fittedForBoundsRef.current = null;
    if (!bounds) return;

    let cancelled = false;
    let rafId = null;
    let cleanupOnLoad = null;
    const timers = [];

    const attempt = (reason) => {
      if (cancelled) return;
      const map = mapRef.current;
      if (!map) return;
      if (typeof map.loaded === "function" && map.loaded()) {
        fitToLatestBounds(reason);
      } else if (typeof map.once === "function") {
        const onLoad = () => fitToLatestBounds("load-event");
        map.once("load", onLoad);
        cleanupOnLoad = () => {
          try {
            map.off?.("load", onLoad);
          } catch {}
        };
      }
    };

    rafId = requestAnimationFrame(() => attempt("raf"));
    timers.push(setTimeout(() => attempt("timeout-250"), 250));
    timers.push(setTimeout(() => attempt("timeout-1000"), 1000));

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      timers.forEach(clearTimeout);
      if (cleanupOnLoad) cleanupOnLoad();
    };
  }, [mapRef, bounds, fitToLatestBounds]);

  return { handleLoad: () => fitToLatestBounds("onLoad-prop") };
}
