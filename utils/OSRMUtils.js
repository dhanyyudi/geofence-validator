/**
 * Utility functions for working with OSRM API responses
 */

const POLYLINE_QUERY_KEYS = ["geometry", "polyline", "encodedPolyline"];

export function inferPrecisionFromGeometry(geometryType) {
  if (geometryType === "polyline6") return 6;
  if (geometryType === "polyline") return 5;
  return null;
}

function extractPolylineFromSearchParams(searchParams) {
  for (const key of POLYLINE_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value) {
      return value;
    }
  }

  return null;
}

export function normalizePolylineInput(input) {
  const trimmed = input?.trim();
  if (!trimmed) {
    return { type: "empty", value: "", inferredPrecision: null };
  }

  try {
    const url = new URL(trimmed);
    const embeddedPolyline = extractPolylineFromSearchParams(url.searchParams);
    if (embeddedPolyline) {
      return {
        type: "embedded-polyline",
        value: decodeURIComponent(embeddedPolyline),
        inferredPrecision: inferPrecisionFromGeometry(
          url.searchParams.get("geometries")
        ),
      };
    }

    return {
      type: "url",
      value: trimmed,
      inferredPrecision: inferPrecisionFromGeometry(
        url.searchParams.get("geometries")
      ),
    };
  } catch {}

  const queryIndex = trimmed.indexOf("?");
  const possibleQuery = queryIndex >= 0 ? trimmed.slice(queryIndex + 1) : trimmed;
  const searchParams = new URLSearchParams(possibleQuery);
  const embeddedPolyline = extractPolylineFromSearchParams(searchParams);
  if (embeddedPolyline) {
    return {
      type: "embedded-polyline",
      value: decodeURIComponent(embeddedPolyline),
      inferredPrecision: inferPrecisionFromGeometry(searchParams.get("geometries")),
    };
  }

  const suffixMatch = trimmed.match(
    /^([^?&]+)&(geometries|overview|steps|start_time|annotations|approaches)=/i
  );
  if (suffixMatch) {
    return {
      type: "embedded-polyline",
      value: suffixMatch[1],
      inferredPrecision: inferPrecisionFromGeometry(searchParams.get("geometries")),
    };
  }

  return { type: "polyline", value: trimmed, inferredPrecision: null };
}

/**
 * Extracts an encoded polyline from an OSRM API URL by making a request and
 * parsing the JSON response.
 *
 * @param {string} url - The OSRM API URL
 * @returns {Promise<Object>} - Object containing polyline and metadata
 */
export async function extractPolylineFromURL(url) {
  try {
    // Validate the URL
    if (!url || !url.includes("mapbox-osrm") || !url.includes("route")) {
      throw new Error("Invalid OSRM API URL");
    }

    // Make the API request
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = await response.json();

    // Validate the response structure
    if (
      !data ||
      !data.routes ||
      !data.routes.length ||
      !data.routes[0].geometry
    ) {
      throw new Error("Invalid API response: Missing route geometry");
    }

    // Extract the main encoded polyline
    const encodedPolyline = data.routes[0].geometry;

    // Extract metadata
    const metadata = {
      distance: data.routes[0].distance,
      duration: data.routes[0].duration,
      waypoints: data.waypoints?.length || 0,
    };

    // Extract leg and step information
    const legs = data.routes[0].legs || [];

    // Create a structured representation of legs and steps
    const routeSegments = [];

    // Process each leg (segment between waypoints)
    legs.forEach((leg, legIndex) => {
      const legSteps = leg.steps || [];

      // Get the waypoint names or indices for this leg
      const startWaypoint =
        data.waypoints?.[legIndex]?.name || `Waypoint ${legIndex}`;
      const endWaypoint =
        data.waypoints?.[legIndex + 1]?.name || `Waypoint ${legIndex + 1}`;

      // Add the leg info
      routeSegments.push({
        type: "leg",
        index: legIndex,
        startWaypoint,
        endWaypoint,
        distance: leg.distance,
        duration: leg.duration,
        geometry: leg.geometry || combineStepGeometries(legSteps),
        steps: legSteps.map((step, stepIndex) => ({
          type: "step",
          legIndex,
          index: stepIndex,
          name: step.name || `Step ${stepIndex + 1}`,
          instruction: step.maneuver?.instruction || "",
          distance: step.distance,
          duration: step.duration,
          geometry: step.geometry,
        })),
      });
    });

    return {
      success: true,
      encodedPolyline,
      metadata,
      routeSegments,
      response: data,
    };
  } catch (error) {
    console.error("Error extracting polyline from URL:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Helper function to combine step geometries when a leg doesn't have its own geometry
 *
 * @param {Array} steps - The steps to combine
 * @returns {string} - The combined geometry
 */
function combineStepGeometries(steps) {
  if (!steps || steps.length === 0) return "";

  // For now, just return the first step's geometry
  // In a real implementation, you'd need to properly combine polylines
  return steps[0].geometry || "";
}

/**
 * Extracts parameters from an OSRM API URL
 *
 * @param {string} url - The OSRM API URL
 * @returns {Object} - Object containing the extracted parameters
 */
export function extractParametersFromURL(url) {
  try {
    const urlObj = new URL(url);
    const searchParams = urlObj.searchParams;

    // Get the coordinates from the path
    const path = urlObj.pathname;
    const pathParts = path.split("/");

    // The coordinates are after the profile (e.g., /van/)
    let coordinatesString = "";
    for (let i = 0; i < pathParts.length; i++) {
      if (
        pathParts[i] === "van" ||
        pathParts[i] === "car" ||
        pathParts[i] === "bike" ||
        pathParts[i] === "foot"
      ) {
        if (i + 1 < pathParts.length) {
          coordinatesString = pathParts[i + 1];
          break;
        }
      }
    }

    // Parse coordinates
    const coordinates = coordinatesString.split(";").map((coord) => {
      const [lng, lat] = coord.split(",").map(parseFloat);
      return { lng, lat };
    });

    return {
      coordinates,
      overview: searchParams.get("overview") || "simplified",
      steps: searchParams.get("steps") === "true",
      geometries: searchParams.get("geometries") || "polyline",
      startTime: searchParams.get("start_time") || null,
      approaches: searchParams.get("approaches")?.split(";") || [],
    };
  } catch (error) {
    console.error("Error extracting parameters from URL:", error);
    return { error: error.message };
  }
}
