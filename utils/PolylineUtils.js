/**
 * Decodes an encoded polyline string into a list of coordinates.
 *
 * @param {string} polyline - Encoded polyline string
 * @param {number} precision - Coordinate precision (default: 6)
 * @returns {Array} - Array of [longitude, latitude] coordinates for GeoJSON compatibility
 */
export function decodePolyline(polyline, precision = 6) {
  // Preparation for parsing
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];
  const factor = Math.pow(10, precision);

  // Get polyline length
  const length = polyline.length;

  while (index < length) {
    // For each coordinate component (lat and lng)
    for (let i = 0; i < 2; i++) {
      // Decode value
      let shift = 0;
      let result = 0;

      while (true) {
        if (index >= length) break;

        const b = polyline.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;

        if (!(b >= 0x20)) break;
      }

      // Handle negative values
      if (result & 1) {
        result = ~(result >> 1);
      } else {
        result = result >> 1;
      }

      // Apply delta
      if (i === 0) {
        lat += result;
      } else {
        lng += result;
      }
    }

    // Convert to decimal degrees based on precision
    // Note: GeoJSON uses [longitude, latitude] order
    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
}

/**
 * Converts an encoded polyline string to a GeoJSON object.
 *
 * @param {string} polyline - Encoded polyline string
 * @param {number} precision - Coordinate precision (default: 6)
 * @returns {Object} - GeoJSON FeatureCollection object
 */
export function polylineToGeoJSON(polyline, precision = 6) {
  const coordinates = decodePolyline(polyline, precision);

  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          coordinates: coordinates,
          type: "LineString",
        },
      },
    ],
  };

  return geojson;
}

/**
 * Helper function to encode a single value.
 *
 * @param {number} value - Value to encode
 * @returns {string} - Encoded string
 */
function _encodeValue(value) {
  // Handle negative values
  value = value < 0 ? ~(value << 1) : value << 1;

  // Split into 5-bit chunks
  let result = "";
  while (value >= 0x20) {
    result += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>= 5;
  }
  result += String.fromCharCode(value + 63);

  return result;
}

/**
 * Encodes a list of coordinates into an encoded polyline string.
 *
 * @param {Array} coordinates - Array of [longitude, latitude] coordinates
 * @param {number} precision - Coordinate precision (default: 6)
 * @returns {string} - Encoded polyline string
 */
export function encodePolyline(coordinates, precision = 6) {
  let result = "";
  const factor = Math.pow(10, precision);

  let latPrev = 0;
  let lngPrev = 0;

  for (const coord of coordinates) {
    // GeoJSON uses [longitude, latitude] order
    const [lng, lat] = coord;

    // Convert to integer representation
    const latInt = Math.round(lat * factor);
    const lngInt = Math.round(lng * factor);

    // Calculate delta
    const dlat = latInt - latPrev;
    const dlng = lngInt - lngPrev;

    // Update previous values
    latPrev = latInt;
    lngPrev = lngInt;

    // Encode latitude
    result += _encodeValue(dlat);

    // Encode longitude
    result += _encodeValue(dlng);
  }

  return result;
}

/**
 * Converts a GeoJSON object to an encoded polyline string.
 *
 * @param {Object} geojson - GeoJSON object
 * @param {number} precision - Coordinate precision (default: 6)
 * @returns {string} - Encoded polyline string
 */
export function geoJSONToPolyline(geojson, precision = 6) {
  let coordinates = [];

  // Extract coordinates from GeoJSON
  if (geojson.type === "FeatureCollection") {
    for (const feature of geojson.features) {
      if (feature.geometry && feature.geometry.type === "LineString") {
        coordinates = feature.geometry.coordinates;
        break;
      }
    }
  } else if (geojson.type === "Feature") {
    if (geojson.geometry && geojson.geometry.type === "LineString") {
      coordinates = geojson.geometry.coordinates;
    }
  } else if (geojson.type === "LineString") {
    coordinates = geojson.coordinates;
  }

  // Encode the coordinates
  return encodePolyline(coordinates, precision);
}

/**
 * Converts a polyline to a polygon by closing the path.
 *
 * @param {Array} coordinates - Array of [longitude, latitude] coordinates
 * @returns {Object} - GeoJSON FeatureCollection with Polygon
 */
export function polylineToPolygon(coordinates) {
  // To create a valid polygon, we need to close the path
  // Check if first and last coordinates are the same
  const firstCoord = coordinates[0];
  const lastCoord = coordinates[coordinates.length - 1];

  // Create a copy of coordinates
  const polygonCoords = [...coordinates];

  // If first and last points are not the same, close the polygon
  if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
    polygonCoords.push(firstCoord);
  }

  // Return GeoJSON polygon
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [polygonCoords],
        },
      },
    ],
  };
}
