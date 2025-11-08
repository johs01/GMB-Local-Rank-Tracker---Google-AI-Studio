
import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapDisplay from './components/MapDisplay';
import ActionPanel from './components/ActionPanel';
import { ScanSettings, ScanResult, Business, Insight, InsightType, RankingPoint, ScanHistoryItem, PlaceAutocompleteResult } from './types';
import { generateScanResults } from './services/mockDataService';
import { getRankingInsights, getCompetitorGapAnalysis, getReviewVolumeAnalysis, getCompetitorList } from './services/geminiService';

const App: React.FC = () => {
  const [scanSettings, setScanSettings] = useState<ScanSettings>({
    location: null,
    searchQuery: 'barber',
    gridSize: '15 x 11 (4 km)',
  });
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [businesses, setBusinesses] = useState<PlaceAutocompleteResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  
  const [selectedPoint, setSelectedPoint] = useState<RankingPoint | null>(null);
  const [hoveredCompetitorId, setHoveredCompetitorId] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [scanProgress, setScanProgress] = useState<{ current: number, total: number} | null>(null);

  const searchCache = useRef(new Map<string, PlaceAutocompleteResult[]>());
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);


  const getLocation = useCallback((): Promise<{ latitude: number, longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setUserLocation(location);
          resolve(location);
        },
        (error) => {
          console.error("Error getting user location:", error);
          reject(error);
        }
      );
    });
  }, []);


  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('gmbScanHistory');
      if (savedHistory) {
        setScanHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error("Failed to load scan history:", error);
      setScanHistory([]);
    }
    
    getLocation().catch(() => {
      console.log("User location not available on initial load.");
    });
  }, [getLocation]);

  const [insights, setInsights] = useState<Record<InsightType, Insight>>({
    ranking: { status: 'idle', content: null, sources: [] },
    competitor: { status: 'idle', content: null, sources: [] },
    review: { status: 'idle', content: null, sources: [] },
  });

  const handlePlaceSearch = useCallback(async (query: string, map: google.maps.Map | null) => {
      if (query.length < 3) {
          setBusinesses([]);
          return;
      }
      if (searchCache.current.has(query)) {
          setBusinesses(searchCache.current.get(query)!);
          return;
      }
      if (!window.google?.maps?.places) {
          console.error("Places API not loaded");
          return;
      }
      if (!autocompleteServiceRef.current) {
          autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
      }

      setIsSearching(true);
      
      let locationToUse = userLocation;
      if (!locationToUse) {
          try {
              locationToUse = await getLocation();
          } catch (error) {
              console.warn("Could not get user location for search, proceeding without it.");
          }
      }

      const request: google.maps.places.AutocompletionRequest = {
        input: query,
        types: ['establishment'],
      };
      if (locationToUse) {
        request.location = new google.maps.LatLng(locationToUse.latitude, locationToUse.longitude);
        request.radius = 50000; // 50km radius bias
      }

      autocompleteServiceRef.current.getPlacePredictions(request, (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
              const formattedResults = results.map(r => ({
                  id: r.place_id,
                  name: r.structured_formatting.main_text,
                  address: r.structured_formatting.secondary_text,
              }));
              searchCache.current.set(query, formattedResults);
              setBusinesses(formattedResults);
          } else {
              setBusinesses([]);
          }
          setIsSearching(false);
      });
  }, [userLocation, getLocation]);

  const handlePlaceSelect = useCallback((place: PlaceAutocompleteResult, map: google.maps.Map | null) => {
    if (!map) return;
    if (!placesServiceRef.current) {
        placesServiceRef.current = new window.google.maps.places.PlacesService(map);
    }
    
    setIsSearching(true);
    placesServiceRef.current.getDetails({ placeId: place.id, fields: ['name', 'formatted_address', 'geometry', 'place_id'] }, (result, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && result?.geometry?.location) {
            const business: Business = {
                id: result.place_id!,
                name: result.name!,
                address: result.formatted_address!,
                latitude: result.geometry.location.lat(),
                longitude: result.geometry.location.lng(),
            };
            setScanSettings(prev => ({ ...prev, location: business }));
            setBusinesses([]);
        } else {
            console.error('Failed to get place details:', status);
        }
        setIsSearching(false);
    });
  }, []);

  const handleSelectBusiness = useCallback((business: Business) => {
    setScanSettings(prev => ({ ...prev, location: business }));
    setBusinesses([]);
  }, []);
  
  const handleScan = useCallback(async () => {
    if (!scanSettings.location) return;
    setIsScanning(true);
    setScanCompleted(false);
    setScanResult(null);
    setSelectedPoint(null);
    setInsights({
        ranking: { status: 'idle', content: null, sources: [] },
        competitor: { status: 'idle', content: null, sources: [] },
        review: { status: 'idle', content: null, sources: [] },
    });

    try {
      const { businesses: competitors, sources: competitorSources } = await getCompetitorList(scanSettings.location, scanSettings.searchQuery);
      
      const onProgress = (progress: { current: number, total: number }) => setScanProgress(progress);
      
      const results = await generateScanResults(scanSettings, competitors, onProgress, competitorSources);
      
      setScanResult(results);
      setScanCompleted(true);

      const newHistoryItem: ScanHistoryItem = {
        id: new Date().toISOString(),
        timestamp: new Date().toLocaleString(),
        settings: scanSettings,
        result: results,
      };
      setScanHistory(prev => {
          const newHistory = [newHistoryItem, ...prev.slice(0, 9)];
          localStorage.setItem('gmbScanHistory', JSON.stringify(newHistory));
          return newHistory;
      });

    } catch (error) {
      console.error("Failed to complete scan:", error);
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  }, [scanSettings]);

  const loadScanFromHistory = (item: ScanHistoryItem) => {
    setScanSettings(item.settings);
    setScanResult(item.result);
    setScanCompleted(true);
    setSelectedPoint(null);
    setInsights({
        ranking: { status: 'idle', content: null, sources: [] },
        competitor: { status: 'idle', content: null, sources: [] },
        review: { status: 'idle', content: null, sources: [] },
    });
  };

  const deleteScanFromHistory = (id: string) => {
    setScanHistory(prev => {
        const newHistory = prev.filter(item => item.id !== id);
        localStorage.setItem('gmbScanHistory', JSON.stringify(newHistory));
        return newHistory;
    });
  };
  
  const handleBackToSettings = () => {
      setScanResult(null);
      setScanCompleted(false);
      setSelectedPoint(null);
      setInsights({
        ranking: { status: 'idle', content: null, sources: [] },
        competitor: { status: 'idle', content: null, sources: [] },
        review: { status: 'idle', content: null, sources: [] },
      });
  };

  const fetchInsights = useCallback(async (type: InsightType) => {
    if (!scanSettings.location || !scanResult) return;

    setInsights(prev => ({ ...prev, [type]: { ...prev[type], status: 'loading' } }));
    
    try {
      let insightData;
      if (type === 'ranking') {
          insightData = await getRankingInsights(scanSettings.location, scanSettings.searchQuery, scanResult);
      } else if (type === 'competitor') {
          insightData = await getCompetitorGapAnalysis(scanSettings.location, scanSettings.searchQuery);
      } else { // review
          insightData = await getReviewVolumeAnalysis(scanSettings.location, scanSettings.searchQuery);
      }
      
      setInsights(prev => ({ ...prev, [type]: { status: 'success', content: insightData.content, sources: insightData.sources } }));
    } catch (error) {
      console.error(`Error fetching ${type} insights:`, error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setInsights(prev => ({ ...prev, [type]: { status: 'error', content: `Failed to load insights. ${errorMessage}`, sources: [] } }));
    }
  }, [scanSettings, scanResult]);


  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col text-gray-800">
      <Header />
      <main className="flex-grow flex h-[calc(100vh-4rem)]">
        <Sidebar
          scanSettings={scanSettings}
          setScanSettings={setScanSettings}
          scanResult={scanResult}
          onScan={handleScan}
          isScanning={isScanning}
          onBack={handleBackToSettings}
          businesses={businesses}
          onSearch={(query) => handlePlaceSearch(query, mapInstance)}
          isSearching={isSearching}
          onSelectBusiness={(place) => handlePlaceSelect(place, mapInstance)}
          insights={insights}
          fetchInsights={fetchInsights}
          selectedPoint={selectedPoint}
          onHoverCompetitor={setHoveredCompetitorId}
          scanProgress={scanProgress}
          scanHistory={scanHistory}
          onLoadHistory={loadScanFromHistory}
          onDeleteHistory={deleteScanFromHistory}
        />
        <div className="flex-grow relative">
          <MapDisplay 
            onMapLoad={setMapInstance}
            results={scanResult?.rankings ?? []} 
            businessLocation={scanSettings.location}
            onSelectPoint={setSelectedPoint}
            selectedPoint={selectedPoint}
            hoveredCompetitorId={hoveredCompetitorId}
          />
          {scanCompleted && (
             <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white py-2 px-4 rounded-md shadow-lg text-sm z-20">
             Your scan has been completed. <button onClick={() => setScanCompleted(false)} className="font-bold underline ml-2">Close</button>
           </div>
          )}
          {scanResult && <ActionPanel scanResult={scanResult} scanSettings={scanSettings}/>}
        </div>
      </main>
    </div>
  );
};

export default App;
