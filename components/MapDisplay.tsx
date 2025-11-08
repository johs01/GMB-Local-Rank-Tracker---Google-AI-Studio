import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RankingPoint, Business } from '../types';

declare global {
  namespace google.maps {
      interface MapTypeStyle { elementType?: string; featureType?: string; stylers: any[]; }
      class Map { constructor(mapDiv: Element | null, opts?: MapOptions); fitBounds(bounds: LatLngBounds): void; setCenter(center: LatLng | { lat: number; lng: number }): void; setZoom(zoom: number): void; }
      interface MapOptions { center?: { lat: number; lng: number; } | LatLng; zoom?: number; styles?: MapTypeStyle[]; disableDefaultUI?: boolean; zoomControl?: boolean; }
      // FIX: Add missing setTitle and setOptions methods to Marker type definition.
      class Marker { constructor(opts?: MarkerOptions); setMap(map: Map | null): void; setPosition(latLng: LatLng | { lat: number; lng: number }): void; setIcon(icon: any): void; setZIndex(zIndex: number): void; setOpacity(opacity: number | null): void; addListener(eventName: string, handler: Function): google.maps.MapsEventListener; setTitle(title: string | null): void; setOptions(options: MarkerOptions): void; }
      // FIX: Add missing opacity property to MarkerOptions interface.
      // FIX: Made position optional to allow setOptions to be called without it.
      interface MarkerOptions { position?: { lat: number; lng: number; } | LatLng; map?: Map; title?: string; icon?: any; anchor?: Point; zIndex?: number; opacity?: number; }
      class InfoWindow { constructor(opts?: InfoWindowOptions); setContent(content: string | Node): void; open(map: Map, anchor?: Marker): void; close(): void; }
      interface InfoWindowOptions { content?: string | Node; }
      class Point { constructor(x: number, y: number); }
      class Size { constructor(width: number, height: number, widthUnit?: string, heightUnit?: string); }
      class LatLng { constructor(lat: number, lng: number); lat(): number; lng(): number; }
      class LatLngBounds { constructor(sw?: LatLng, ne?: LatLng); extend(point: LatLng | { lat: number; lng: number }): void; getCenter(): LatLng; }
      interface MapsEventListener { remove(): void; }
      namespace places {
        class AutocompleteService { getPlacePredictions(request: AutocompletionRequest, callback: (results: AutocompletePrediction[] | null, status: string) => void): void; }
        class PlacesService { constructor(map: Map); getDetails(request: PlaceDetailsRequest, callback: (result: PlaceResult | null, status: string) => void): void; }
        interface AutocompletionRequest { input: string; types?: string[]; location?: LatLng; radius?: number; }
        interface AutocompletePrediction { place_id: string; structured_formatting: { main_text: string; secondary_text: string }; }
        interface PlaceDetailsRequest { placeId: string; fields: string[]; }
        interface PlaceResult { name?: string; formatted_address?: string; geometry?: { location?: LatLng }; place_id?: string; }
        const PlacesServiceStatus: { OK: string };
      }
      namespace visualization {
        class HeatmapLayer {
            constructor(opts?: HeatmapLayerOptions);
            setData(data: any);
            setMap(map: Map | null): void;
        }
        interface HeatmapLayerOptions {
            data?: any[];
            map?: Map;
            gradient?: string[];
            opacity?: number;
            radius?: number;
        }
        interface WeightedLocation {
            location: LatLng;
            weight: number;
        }
    }
  }
  interface Window { google: typeof google; gm_authFailure: () => void; }
}

interface MapDisplayProps {
  onMapLoad: (map: google.maps.Map) => void;
  results: RankingPoint[];
  businessLocation: Business | null;
  onSelectPoint: (point: RankingPoint | null) => void;
  selectedPoint: RankingPoint | null;
  hoveredCompetitorId: string | null;
  showHeatmap: boolean;
}

const scriptId = 'google-maps-script';
let mapsApiPromise: Promise<void> | null = null;

const resetMapsApi = () => {
    mapsApiPromise = null;
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
        existingScript.remove();
    }
    if ((window as any).google) {
       (window as any).google = undefined;
    }
};

const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
    if (mapsApiPromise) return mapsApiPromise;
    mapsApiPromise = new Promise((resolve, reject) => {
        if (window.google?.maps?.places) return resolve();
        
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,visualization`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (error) => {
            resetMapsApi();
            reject(error);
        };
        document.head.appendChild(script);
    });
    return mapsApiPromise;
};

const mapStyles: google.maps.MapTypeStyle[] = [
    { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
    { featureType: "administrative.land_parcel", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
    { featureType: "road.local", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
];

const createMarkerIcon = (rank: number, isSelected: boolean, isDimmed: boolean): google.maps.MarkerOptions['icon'] => {
  const rankText = rank > 20 ? '20+' : rank.toString();
  const getColor = () => {
    if (rank <= 3) return '#22c55e';
    if (rank <= 6) return '#facc15';
    if (rank <= 10) return '#f97316';
    return '#ef4444';
  };
  const size = isSelected ? 44 : 36;
  const fontSize = rank > 20 ? 14 : (isSelected ? 18 : 16);
  const strokeWidth = isSelected ? 3 : 2;

  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - strokeWidth/2}" fill="${getColor()}" stroke="${isSelected ? '#4F46E5' : 'rgba(0,0,0,0.1)'}" stroke-width="${strokeWidth}"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white">${rankText}</text>
    </svg>
  `;

  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new window.google.maps.Size(size, size),
    anchor: new window.google.maps.Point(size/2, size/2),
  };
};

const MapDisplay: React.FC<MapDisplayProps> = ({ onMapLoad, results, businessLocation, onSelectPoint, selectedPoint, hoveredCompetitorId, showHeatmap }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(() => localStorage.getItem('googleMapsApiKey'));
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  
  const markersRef = useRef<google.maps.Marker[]>([]);
  const businessMarkerRef = useRef<google.maps.Marker | null>(null);
  const listenerRefs = useRef<google.maps.MapsEventListener[]>([]);
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  useEffect(() => {
    const handleAuthFailure = () => {
        setApiKeyError("Google Maps API Error: Your key is not authorized for this website. Please check your API key's 'Application restrictions' in the Google Cloud Console and ensure this site is on the allowed list.");
        localStorage.removeItem('googleMapsApiKey');
        setMapsApiKey(null);
        setIsApiLoaded(false); 
        setMap(null);
        resetMapsApi();
    };
    window.gm_authFailure = handleAuthFailure;

    if (mapsApiKey && !isApiLoaded) {
      loadGoogleMapsScript(mapsApiKey)
        .then(() => { setIsApiLoaded(true); setApiKeyError(null); })
        .catch(error => { 
            setApiKeyError("Failed to load Google Maps script.");
            resetMapsApi();
        });
    }
    return () => { (window as any).gm_authFailure = null; };
  }, [mapsApiKey, isApiLoaded]);

  useEffect(() => {
    if (isApiLoaded && mapRef.current && !map) {
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: { lat: 34.0522, lng: -118.2437 }, zoom: 12,
        styles: mapStyles, disableDefaultUI: true, zoomControl: true,
      });
      setMap(newMap);
      onMapLoad(newMap);
    }
  }, [isApiLoaded, map, onMapLoad]);

  useEffect(() => {
    if (map && (results.length > 0 || businessLocation)) {
        const bounds = new window.google.maps.LatLngBounds();
        if (businessLocation) {
            bounds.extend({ lat: businessLocation.latitude, lng: businessLocation.longitude });
        }
        if (results.length > 0) {
            results.forEach(point => bounds.extend({ lat: point.lat, lng: point.lng }));
        } else {
            // If only business location, set a reasonable zoom
            map.setCenter({ lat: businessLocation!.latitude, lng: businessLocation!.longitude });
            map.setZoom(14);
            return;
        }
        map.fitBounds(bounds);
    }
  }, [map, results, businessLocation]);

  useEffect(() => {
    if (!map || !window.google?.maps?.visualization) return;

    if (showHeatmap && results.length > 0) {
        const heatmapData = results.map(point => ({
            location: new window.google.maps.LatLng(point.lat, point.lng),
            weight: point.competitorRanks.filter(c => c.rank <= 5).length
        }));
        
        if (!heatmapRef.current) {
            heatmapRef.current = new window.google.maps.visualization.HeatmapLayer({
                data: heatmapData,
                radius: 40,
                opacity: 0.8,
            });
        } else {
            heatmapRef.current.setData(heatmapData);
        }
        heatmapRef.current.setMap(map);
    } else {
        if (heatmapRef.current) {
            heatmapRef.current.setMap(null);
        }
    }
  }, [map, results, showHeatmap]);


  useEffect(() => {
    if (!map) return;
  
    listenerRefs.current.forEach(listener => listener.remove());
    listenerRefs.current = [];
  
    if (businessLocation) {
        const businessLatLng = { lat: businessLocation.latitude, lng: businessLocation.longitude };
        const isDimmed = hoveredCompetitorId !== null && hoveredCompetitorId !== businessLocation.id;
        
        if (businessMarkerRef.current) {
            businessMarkerRef.current.setPosition(businessLatLng);
            businessMarkerRef.current.setMap(map);
            businessMarkerRef.current.setTitle(businessLocation.name);
        } else {
            businessMarkerRef.current = new window.google.maps.Marker({
                position: businessLatLng, map: map, title: businessLocation.name,
                icon: { url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="20" fill="#4F46E5" fill-opacity="0.3"/><circle cx="20" cy="20" r="12" fill="#4F46E5"/><path d="M17.0391 24C15.3624 24 14 22.6376 14 20.9609C14 19.9974 14.4738 19.123 15.25 18.5634V18.5634C15.8036 18.204 16.0833 17.5571 16.0833 16.8333C16.0833 15.5702 17.1202 14.5333 18.3833 14.5333C19.6464 14.5333 20.6833 15.5702 20.6833 16.8333C20.6833 17.5571 20.963 18.204 21.5167 18.5634V18.5634C22.2929 19.123 22.7667 19.9974 22.7667 20.9609C22.7667 22.6376 21.4042 24 19.7276 24H17.0391Z" fill="white"/></svg>'), anchor: new window.google.maps.Point(20, 20) },
                zIndex: 1000
            });
        }
        businessMarkerRef.current.setOpacity(isDimmed ? 0.3 : 1);
    } else {
        businessMarkerRef.current?.setMap(null);
    }
  
    results.forEach((point, i) => {
        const isSelected = selectedPoint?.id === point.id;
        const topCompetitor = point.competitorRanks.find(c => c.rank === 1)?.business.name ?? "N/A";
        const markerTitle = `Rank: ${point.rank > 20 ? '20+' : point.rank}. Top Competitor: ${topCompetitor}`;

        const isHoverMatch = point.competitorRanks.some(cr => cr.business.id === hoveredCompetitorId);
        const isDimmed = hoveredCompetitorId !== null && !isHoverMatch;

        let marker = markersRef.current[i];
        if (marker) {
            marker.setPosition({ lat: point.lat, lng: point.lng });
            marker.setMap(showHeatmap ? null : map);
        } else {
            marker = new window.google.maps.Marker({ position: { lat: point.lat, lng: point.lng }, map: showHeatmap ? null : map });
            markersRef.current[i] = marker;
        }
        marker.setOptions({
            icon: createMarkerIcon(point.rank, isSelected, isDimmed),
            zIndex: isSelected ? 100 : point.rank,
            opacity: isDimmed ? 0.3 : 1,
            title: markerTitle
        });

        const clickListener = marker.addListener('click', () => {
            onSelectPoint(isSelected ? null : point);
        });
        listenerRefs.current.push(clickListener);
    });
  
    for (let i = results.length; i < markersRef.current.length; i++) {
        markersRef.current[i]?.setMap(null);
    }
  
  }, [map, results, businessLocation, onSelectPoint, selectedPoint, hoveredCompetitorId, showHeatmap]);

  const handleKeySubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (keyInput.trim()) {
          localStorage.setItem('googleMapsApiKey', keyInput.trim());
          setMapsApiKey(keyInput.trim());
          setIsApiLoaded(false);
          setKeyInput('');
      }
  };

  if (!mapsApiKey || apiKeyError) {
      return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Google Maps API Key Required</h2>
              <p className="text-gray-600 mb-4 max-w-md">To display the map, please provide a valid Google Maps JavaScript API key.</p>
              {apiKeyError && <p role="alert" className="text-red-500 mb-4 font-medium max-w-lg">{apiKeyError}</p>}
              <form onSubmit={handleKeySubmit} className="flex flex-col sm:flex-row items-center gap-2">
                  <input type="text" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="Enter your API key" className="w-full sm:w-auto flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm"/>
                  <button type="submit" className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-indigo-700">Save & Load</button>
              </form>
          </div>
      );
  }

  return (
    <div role="application" aria-label="Interactive map of scan results" className="w-full h-full relative bg-gray-300">
      <div ref={mapRef} className="w-full h-full" />
       {!isApiLoaded && (<div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10"><p>Loading map...</p></div>)}
       {isApiLoaded && !businessLocation && (<div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10"><p>Select a business to begin a scan.</p></div>)}
    </div>
  );
};

export default MapDisplay;
