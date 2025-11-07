
import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MapDisplay from './components/MapDisplay';
import ActionPanel from './components/ActionPanel';
import { ScanSettings, ScanResult, Business, Insight, InsightType, RankingPoint, ScanHistoryItem } from './types';
import { generateScanResults } from './services/mockDataService';
import { getRankingInsights, getCompetitorGapAnalysis, searchLocalBusinesses, getReviewVolumeAnalysis, getCompetitorList } from './services/geminiService';

const App: React.FC = () => {
  const [scanSettings, setScanSettings] = useState<ScanSettings>({
    location: null,
    searchQuery: 'barber',
    gridSize: '15 x 11 (4 km)',
  });
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  
  // "10/10" Feature States
  const [selectedPoint, setSelectedPoint] = useState<RankingPoint | null>(null);
  const [hoveredCompetitorId, setHoveredCompetitorId] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [scanProgress, setScanProgress] = useState<{ current: number, total: number} | null>(null);


  useEffect(() => {
    // Load scan history from local storage on initial render
    try {
      const savedHistory = localStorage.getItem('gmbScanHistory');
      if (savedHistory) {
        setScanHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error("Failed to load scan history:", error);
      setScanHistory([]);
    }
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
            },
            (error) => {
                console.error("Error getting user location:", error);
            }
        );
    }
  }, []);

  const [insights, setInsights] = useState<Record<InsightType, Insight>>({
    ranking: { status: 'idle', content: null, sources: [] },
    competitor: { status: 'idle', content: null, sources: [] },
    review: { status: 'idle', content: null, sources: [] },
  });

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 3) {
      setBusinesses([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchLocalBusinesses(query, userLocation ?? undefined);
      setBusinesses(results);
    } catch (error) {
      console.error("Error searching businesses:", error);
      setBusinesses([]);
    } finally {
      setIsSearching(false);
    }
  }, [userLocation]);

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
      // Step 1: Fetch real competitors
      const competitors = await getCompetitorList(scanSettings.location, scanSettings.searchQuery);
      
      // Step 2: Generate scan results with real-time progress
      const onProgress = (progress: { current: number, total: number }) => setScanProgress(progress);
      const results = await generateScanResults(scanSettings, competitors, onProgress);
      
      setScanResult(results);
      setScanCompleted(true);

      // Step 3: Save to history
      const newHistoryItem: ScanHistoryItem = {
        id: new Date().toISOString(),
        timestamp: new Date().toLocaleString(),
        settings: scanSettings,
        result: results,
      };
      setScanHistory(prev => {
          const newHistory = [newHistoryItem, ...prev.slice(0, 9)]; // Keep latest 10
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
          onSearch={handleSearch}
          isSearching={isSearching}
          onSelectBusiness={handleSelectBusiness}
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
