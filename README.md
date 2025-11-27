# Geofence Validator

A comprehensive web application for validating, fixing, and analyzing GeoJSON geofence files. Built with Next.js and React, this tool helps ensure your geofence data meets required standards and provides visual comparison capabilities.

![Geofence Validator](https://img.shields.io/badge/Next.js-15.2.3-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19.0.0-blue?style=flat-square&logo=react)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-green?style=flat-square&logo=leaflet)

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

### 🛣️ Polyline Converter
- **Multiple Input Methods**:
  - Direct polyline string input
  - OSRM API URL parsing
  - File upload (.txt files)
- **Route Segment Selection**: Extract and convert specific route segments
- **Format Options**:
  - LineString (for routes)
  - Polygon (closed paths)
- **Precision Control**: Support for precision levels 5 and 6
- **OSRM Integration**: Fetch and decode polylines from OSRM routing responses
- **Route Metadata**: Display distance, duration, and waypoint information

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

### Converting Polylines

1. **Navigate to Polyline Page**
   - Click on the "Polyline" tab in the header

2. **Choose Input Method**
   - **Direct Input**: Paste encoded polyline string
   - **OSRM URL**: Enter OSRM API URL to extract polyline
   - **File Upload**: Upload a .txt file containing polyline

3. **Configure Options**
   - Select precision level (5 or 6)
   - Choose output format (LineString or Polygon)
   - For OSRM URLs: Select specific route segment if needed

4. **Decode Polyline**
   - Click "Decode Polyline" button
   - View the decoded route on the map
   - See route metadata (distance, duration, waypoints)

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

- **Frontend Framework**: Next.js 15.2.3
- **UI Library**: React 19.0.0
- **Mapping**: Leaflet 1.9.4, React-Leaflet 5.0.0
- **Geospatial Processing**: Turf.js 7.2.0
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
│   ├── compare/
│   │   └── page.js          # Comparison page
│   └── polyline/
│       └── page.js          # Polyline converter page
├── components/
│   ├── DashboardHeader.js   # Navigation header
│   ├── FileUploader.js      # File upload component
│   ├── Validator.js         # Validation results display
│   ├── GeofenceMap.js       # Single geofence map
│   ├── DirectMultiPolygonMap.js  # Advanced map display
│   ├── GeofenceComparer.js  # File comparison uploader
│   ├── GeofenceComparisonMap.js  # Comparison map display
│   ├── ComparisonPage.js    # Comparison page layout
│   ├── PolylineConverter.js # Polyline input handler
│   ├── PolylineViewer.js    # Polyline map display
│   └── PolylinePage.js      # Polyline page layout
├── utils/
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
- Ensure Leaflet CSS is loaded
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
- [Leaflet](https://leafletjs.com/) - Interactive maps
- [Turf.js](https://turfjs.org/) - Geospatial analysis
- [Font Awesome](https://fontawesome.com/) - Icons
- [Tailwind CSS](https://tailwindcss.com/) - Styling

## Support

For issues, questions, or suggestions:
- Open an issue on [GitHub](https://github.com/dhanyyudi/geofence-validator/issues)
- Check existing documentation
- Review closed issues for solutions

## Changelog

### Version 0.1.0
- Initial release
- Geofence validation and fixing
- Geofence comparison tool
- Polyline converter
- OSRM integration
- Interactive map visualization

---

**Made with ❤️ for the GIS community**
