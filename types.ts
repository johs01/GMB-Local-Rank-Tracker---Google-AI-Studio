
export interface Business {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface PlaceAutocompleteResult {
    id: string;
    name: string;
    address: string;
}

export interface ScanSettings {
  location: Business | null;
  searchQuery: string;
  gridSize: string;
}

export interface CompetitorRank {
  rank: number;
  business: Business;
}

export interface RankingPoint {
  id: number;
  rank: number; // Rank of the target business
  lat: number;
  lng: number;
  competitorRanks: CompetitorRank[]; // Full ranking list for this point
}

export interface GroundingSource {
    uri: string;
    title: string;
}

export interface ScanResult {
  summary: {
    averageRank: number;
    top3: number;
    top10: number;
  };
  rankings: RankingPoint[];
  gridSize: string;
  competitors: Business[];
  sources: GroundingSource[]; // API COMPLIANCE FIX
}

export type InsightType = 'ranking' | 'competitor' | 'review';

export interface Insight {
    status: 'idle' | 'loading' | 'success' | 'error';
    content: string | null;
    sources: GroundingSource[];
}

export interface ScanHistoryItem {
  id: string;
  timestamp: string;
  settings: ScanSettings;
  result: ScanResult;
}
