
import { ScanResult, RankingPoint, ScanSettings, Business, CompetitorRank, GroundingSource } from '../types';

const parseGridSize = (gridSize: string): { width: number; height: number; spanKm: number } => {
    const sizeMatch = gridSize.match(/(\d+)\s*x\s*(\d+)/);
    const distMatch = gridSize.match(/\(([\d.]+)\s*km\)/);
    const width = sizeMatch ? parseInt(sizeMatch[1], 10) : 7;
    const height = sizeMatch ? parseInt(sizeMatch[2], 10) : 7;
    const spanKm = distMatch ? parseFloat(distMatch[1]) : 1;
    return { width, height, spanKm };
};

const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateScanResults = async (
    settings: ScanSettings, 
    competitors: Business[],
    onProgress: (progress: { current: number, total: number }) => void,
    sources: GroundingSource[] // API COMPLIANCE FIX: Accept sources
): Promise<ScanResult> => {
  if (!settings.location) {
      throw new Error("Location must be provided for a scan.");
  }

  const targetBusiness = settings.location;
  const { width, height, spanKm } = parseGridSize(settings.gridSize);
  const totalPoints = width * height;
  
  const rankings: RankingPoint[] = [];

  const LAT_DEG_IN_KM = 111.132;
  const LNG_DEG_IN_KM = 111.320 * Math.cos(targetBusiness.latitude * Math.PI / 180);
  const maxDimension = Math.max(width, height);
  const stepKm = maxDimension > 1 ? spanKm / (maxDimension - 1) : 0;
  const stepLat = stepKm / LAT_DEG_IN_KM;
  const stepLng = stepKm / LNG_DEG_IN_KM;
  const startLat = targetBusiness.latitude + ((height - 1) / 2) * stepLat;
  const startLng = targetBusiness.longitude - ((width - 1) / 2) * stepLng;

  const allBusinesses = [targetBusiness, ...competitors];

  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const pointId = r * width + c;
      const lat = startLat - r * stepLat;
      const lng = startLng + c * stepLng;

      await sleep(10); 
      onProgress({ current: pointId + 1, total: totalPoints });

      const businessScores = allBusinesses.map(business => {
          const distance = getDistanceKm(lat, lng, business.latitude, business.longitude);
          const score = (1 / (distance + 0.1)) * (0.8 + Math.random() * 0.4);
          return { business, score };
      });
      
      businessScores.sort((a, b) => b.score - a.score);

      const competitorRanks: CompetitorRank[] = businessScores.map((item, index) => ({
          rank: index + 1,
          business: item.business
      }));

      const targetBusinessRank = competitorRanks.find(cr => cr.business.id === targetBusiness.id)?.rank || 21;

      rankings.push({
        id: pointId,
        rank: targetBusinessRank,
        lat,
        lng,
        competitorRanks,
      });
    }
  }

  const totalRank = rankings.reduce((acc, curr) => acc + curr.rank, 0);
  const averageRank = totalRank / rankings.length;
  const top3 = rankings.filter(r => r.rank <= 3).length;
  const top10 = rankings.filter(r => r.rank <= 10).length;

  // DATA CONSISTENCY FIX: Create the authoritative, sorted competitor list
  const businessRankSums: Record<string, { total: number, count: number, business: Business }> = {};
  allBusinesses.forEach(b => {
      businessRankSums[b.id] = { total: 0, count: 0, business: b };
  });

  rankings.forEach(point => {
      point.competitorRanks.forEach(cr => {
          if (businessRankSums[cr.business.id]) {
              businessRankSums[cr.business.id].total += cr.rank;
              businessRankSums[cr.business.id].count++;
          }
      });
  });

  const sortedCompetitorList = Object.values(businessRankSums)
    .map(data => ({
        ...data.business,
        averageRank: data.count > 0 ? data.total / data.count : 99,
    }))
    .sort((a, b) => a.averageRank - b.averageRank);


  return {
    summary: {
      averageRank: parseFloat(averageRank.toFixed(1)),
      top3,
      top10,
    },
    rankings,
    gridSize: settings.gridSize,
    competitors: sortedCompetitorList, // Use the consistent, sorted list
    sources, // API COMPLIANCE FIX: Include sources in the final result
  };
};
