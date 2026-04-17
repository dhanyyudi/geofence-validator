# Geofence Validator

A comprehensive web application for validating, fixing, and analyzing GeoJSON geofence files. Built with Next.js and React, this tool helps ensure your geofence data meets required standards and provides visual comparison capabilities.

![Geofence Validator](https://img.shields.io/badge/Next.js-16.1.6-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19.0.0-blue?style=flat-square&logo=react)
![MapLibre](https://img.shields.io/badge/MapLibre-5.23.0-green?style=flat-square)

## Features

### 🔍 Geofence Validator
- **File Format Validation**: Ensures .geojson file extension and proper JSON structure
- **Coordinate System Check**: Validates geographic coordinates (lat/lon format)
- **Z-Coordinate Detection**: Identifies and removes z-coordinates that may cause compatibility issues
- **Geometry Type Validation**: Detects MultiPolygon and multiple polygon structures
- **Automatic Fixes**: One-click solutions to convert MultiPolygon to Polygon format
- **Visual Preview**: Interactive map display of original and fixed geofences
- **Download Results**: Export validated and fixed GeoJSON files

### 🔄 Geofence Comparison
- **Side-by-Side Comparison**: Upload and compare two geofence files
- **Visual Overlay**: See both geofences on the same map
- **Intersection Analysis**: Calculate and visualize overlapping areas
- **Layer Toggle**: Switch between different visualization layers
- **Screenshot Export**: Save comparison results as images

### 🔁 Data Conversion
- **Supported Inputs**: Convert `.kml`, `.kmz`, and zipped shapefiles (`.zip`) locally in the browser
- **Auto-Normalization**: Output is cleaned automatically to match validator requirements
- **Best-Effort Polygonization**: Closed linework is converted into polygon boundaries when safe
- **Strict Rejection Rules**: Open lines, point-only data, and invalid CRS outputs are blocked with clear errors
- **Preview + Download**: Review the cleaned polygon on the map and download `*.cleaned.geojson`

### 🛣️ Polyline Converter
- **Multiple Input Methods**:
  - Direct polyline string input
  - OSRM API URL parsing
  - File upload (.txt files)
- **Input Normalization**: Handles embedded polyline query strings and infers `polyline` vs `polyline6` precision automatically
- **Route Segment Selection**: Extract and convert specific route segments
- **Format Options**:
  - LineString (for routes)
  - Polygon (closed paths)
- **Precision Control**: Support for precision levels 5 and 6
- **OSRM Integration**: Fetch and decode polylines from OSRM routing responses
- **Route Metadata**: Display distance, duration, and waypoint information
- **Safer UI State**: Decode actions and file success status only apply to the currently active input tab

## Installation

### Prerequisites
- Node.js 18.x or higher
- npm, yarn, pnpm, or bun package manager

### Clone Repository
```bash
git clone https://github.com/yourusername/geofence-validator.git
cd geofence-validator
```

### Install Dependencies
```bash
npm install
# or
yarn install
# or
pnpm install
```

### Run Development Server
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

### Build for Production
```bash
npm run build
npm run start
```

## Usage Guide

### Validating a Geofence

1. **Navigate to Validator Page**
   - Click on the "Validator" tab in the header

2. **Upload Your File**
   - Drag and drop a .geojson file onto the upload area
   - Or click to browse and select a file

3. **View Validation Results**
   - The application will automatically validate your file
   - Errors are displayed in red alerts
   - Warnings are displayed in yellow alerts

4. **Apply Fixes**
   - If issues are detected, fix options will be displayed
   - Click on the appropriate fix button:
     - "Remove Z-Coordinates" for 3D coordinate issues
     - "Convert to Single Polygon" for MultiPolygon structures
   - The fixed geofence will be displayed on the map

5. **Download Fixed File**
   - Click "Download GeoJSON" to save the corrected file
   - The file will be named `fixed-geofence.geojson`

### Comparing Geofences

1. **Navigate to Compare Page**
   - Click on the "Compare" tab in the header

2. **Upload Two Files**
   - Upload the first geofence in the left upload area
   - Upload the second geofence in the right upload area

3. **Start Comparison**
   - Click "Compare Geofences" button
   - Wait for the map visualization to load

4. **Analyze Results**
   - Toggle layers to view:
     - First geofence only
     - Second geofence only
     - Both geofences overlaid
     - Intersection area
   - View statistics about overlapping areas

5. **Export Results**
   - Click "Download Screenshot" to save the comparison view

### Converting Spatial Data

1. **Navigate to Data Conversion Page**
   - Click on the "Data Conversion" tab in the header

2. **Upload Supported Input**
   - Drag and drop a `.kml`, `.kmz`, or zipped shapefile `.zip`
   - Files stay in the browser and are not uploaded to a server

3. **Convert to Clean GeoJSON**
   - Click "Convert to Clean GeoJSON"
   - KML/KMZ are parsed locally
   - SHP ZIP archives are read locally and merged if the archive contains multiple shapefiles

4. **Review Normalized Output**
   - The app removes Z coordinates automatically
   - The app keeps only the largest polygon if multiple polygons are found
   - The app removes interior holes and validates the final result against validator requirements
   - Closed linework is polygonized when possible; open lines and point-only data are rejected

5. **Download Result**
   - Click "Download Clean GeoJSON"
   - The downloaded filename uses the source name with `.cleaned.geojson`

### Converting Polylines

1. **Navigate to Polyline Page**
   - Click on the "Polyline" tab in the header

2. **Choose Input Method**
   - **Direct Input**: Paste encoded polyline string
   - **OSRM URL**: Enter OSRM API URL to extract polyline
   - **File Upload**: Upload a .txt file containing polyline
   - The decode button only activates when the selected tab has valid input

3. **Configure Options**
   - Select precision level (5 or 6)
   - Choose output format (LineString or Polygon)
   - For OSRM URLs: Select specific route segment if needed
   - Precision is auto-adjusted when the source declares `geometries=polyline` or `polyline6`

4. **Decode Polyline**
   - Click "Decode Polyline" button
   - View the decoded route on the map
   - See route metadata (distance, duration, waypoints)
   - Invalid or non-polyline input is rejected before rendering

5. **Download Results**
   - Click "Download GeoJSON" to save the converted file
   - The file will contain the decoded coordinates in GeoJSON format

## Validation Criteria

### Required Standards
- **File Extension**: Must be `.geojson`
- **Coordinate System**: Geographic coordinates (WGS84/EPSG:4326)
  - Longitude: -180 to 180
  - Latitude: -90 to 90
- **Z-Coordinates**: Should not contain elevation data
- **Geometry Type**: Should be `Polygon`, not `MultiPolygon`
- **Single Polygon**: Should contain only one polygon feature

### Common Issues and Fixes

| Issue | Description | Fix |
|-------|-------------|-----|
| Z-Coordinates | File contains elevation data | Remove z-coordinates automatically |
| MultiPolygon | Geometry type is MultiPolygon | Convert to single Polygon |
| Multiple Rings | Polygon has multiple exterior rings | Select and extract primary ring |
| Invalid CRS | Wrong coordinate reference system | Manual fix required in GIS software |

## Technology Stack

- **Frontend Framework**: Next.js 16.1.6
- **UI Library**: React 19.0.0
- **Mapping**: MapLibre GL, react-map-gl
- **Geospatial Processing**: Turf.js 7.2.0
- **Spatial Conversion**: @tmcw/togeojson, JSZip, shpjs
- **Styling**: Tailwind CSS 3.4.17
- **Icons**: Font Awesome 6.4.0
- **Analytics**: Vercel Speed Insights

## Project Structure

```
geofence-validator/
├── app/
│   ├── page.js              # Validator page (home)
│   ├── layout.js            # Root layout with global styles
│   ├── globals.css          # Global CSS styles
│   ├── conversion/
│   │   └── page.js          # Data conversion page
│   ├── compare/
│   │   └── page.js          # Comparison page
│   └── polyline/
│       └── page.js          # Polyline converter page
├── components/
│   ├── DashboardHeader.js   # Navigation header
│   ├── DataConversionPage.js # Spatial data conversion workspace
│   ├── FileUploader.js      # File upload component
│   ├── Validator.js         # Validation results display
│   ├── GeofenceComparer.js  # File comparison uploader
│   ├── GeofenceComparisonMap.js  # Comparison map display
│   ├── GeofenceMapView.js   # Shared MapLibre polygon preview
│   ├── ComparisonPage.js    # Comparison page layout
│   ├── PolylineConverter.js # Polyline input handler
│   ├── PolylineViewer.js    # Polyline map display
│   └── PolylinePage.js      # Polyline page layout
├── utils/
│   ├── dataConversion.js    # Spatial file conversion and normalization
│   ├── geofenceUtils.js     # Geofence validation logic
│   ├── PolylineUtils.js     # Polyline encoding/decoding
│   └── OSRMUtils.js         # OSRM API integration
├── public/                  # Static assets
├── package.json             # Dependencies
└── README.md               # This file
```

## API Integration

### OSRM URL Format
The application can parse OSRM routing API responses in the following format:
```
https://your-osrm-server.com/route/v1/{profile}/{coordinates}?{parameters}
```

**Supported Profiles**:
- `van`, `car`, `bike`, `foot`, etc.

**Parameters**:
- `overview=full` - Include full route geometry
- `geometries=polyline` or `polyline6` - Polyline encoding format
- `steps=true` - Include turn-by-turn instructions

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Considerations

- **File Size Limit**: Optimal for files up to 5MB
- **Coordinate Count**: Best performance with <50,000 coordinates
- **Map Rendering**: Automatically optimizes polygon simplification for large datasets

## Privacy & Security

- **Client-Side Processing**: All file processing happens in your browser
- **No Data Upload**: Files are never sent to external servers
- **Local Storage**: No data is stored permanently
- **Secure**: HTTPS recommended for production deployment

## Troubleshooting

### Map Not Loading
- Check console for errors
- Ensure map tiles are reachable from your network
- Verify file is valid GeoJSON

### Validation Fails
- Confirm file has .geojson extension
- Verify JSON syntax is correct
- Check coordinate ranges are valid

### Polyline Decode Error
- Verify polyline string is complete
- Check precision setting matches encoding
- Ensure URL is properly formatted

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [MapLibre](https://maplibre.org/) - Interactive maps
- [Turf.js](https://turfjs.org/) - Geospatial analysis
- [shpjs](https://github.com/calvinmetcalf/shapefile-js) - Browser-side shapefile parsing
- [JSZip](https://stuk.github.io/jszip/) - Browser-side zip reading
- [toGeoJSON](https://github.com/tmcw/togeojson) - KML to GeoJSON conversion
- [Font Awesome](https://fontawesome.com/) - Icons
- [Tailwind CSS](https://tailwindcss.com/) - Styling

## Support

For issues, questions, or suggestions:
- Open an issue on [GitHub](https://github.com/dhanyyudi/geofence-validator/issues)
- Check existing documentation
- Review closed issues for solutions

## Changelog

### Version 0.2.0
- Added `Data Conversion` page for `.kml`, `.kmz`, and `.zip` shapefile inputs
- Added browser-side conversion pipeline with validator-ready GeoJSON normalization
- Added MapLibre-based preview for converted data
- Improved Polyline conversion input handling and render/zoom reliability
- Replaced the default favicon with app-specific branding

### Version 0.1.0
- Initial release with validator, compare, and polyline tooling
- Initial release
- Geofence validation and fixing
- Geofence comparison tool
- Polyline converter
- OSRM integration
- Interactive map visualization

---

**Made with ❤️ for the GIS community**
