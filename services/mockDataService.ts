import { ScanSettings, ScanResult, Business, RankingPoint, CompetitorRank, GroundingSource } from '../types';

// Helper to simulate async operations
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to parse grid size string like "15 x 11 (4 km)"
const parseGridSize = (gridSizeStr: string) => {
    const sizeMatch = gridSizeStr.match(/(\d+)\s*x\s*(\d+)/);
    const distanceMatch = gridSizeStr.match(/\(([\d.]+)\s*km\)/);
    const cols = sizeMatch ? parseInt(sizeMatch[1], 10) : 7;
    const rows = sizeMatch ? parseInt(sizeMatch[2], 10) : 7;
    const distanceKm = distanceMatch ? parseFloat(distanceMatch[1]) : 1;
    return { cols, rows, distanceKm };
};

// Simple distance calculation (not geographically accurate, but fine for mock)
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2));
};

export const generateScanResults = async (
    settings: ScanSettings,
    competitors: Business[],
    onProgress: (progress: { current: number; total: number }) => void,
    competitorSources: GroundingSource[]
): Promise<ScanResult> => {
    if (!settings.location) {
        throw new Error("Location is not set for scan.");
    }

    const { cols, rows, distanceKm } = parseGridSize(settings.gridSize);
    const totalPoints = cols * rows;
    const rankings: RankingPoint[] = [];

    // Convert km to approximate degrees
    const latKmPerDegree = 111;
    const latDelta = (distanceKm / latKmPerDegree) / Math.max(1, rows - 1);
    const lngDelta = (distanceKm / (latKmPerDegree * Math.cos(settings.location.latitude * Math.PI / 180))) / Math.max(1, cols - 1);

    const startLat = settings.location.latitude - (latDelta * (rows - 1)) / 2;
    const startLng = settings.location.longitude - (lngDelta * (cols - 1)) / 2;

    let pointId = 0;
    const allBusinesses = [settings.location, ...competitors];

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            pointId++;
            const currentLat = startLat + i * latDelta;
            const currentLng = startLng + j * lngDelta;

            // Simulate ranking logic
            const rankingsForPoint: { business: Business, score: number }[] = allBusinesses.map(business => {
                const dist = calculateDistance(currentLat, currentLng, business.latitude, business.longitude);
                // Higher score is better. Closer businesses get higher scores. Add some randomness.
                const score = (1 - (dist / (distanceKm/latKmPerDegree))) * 100 + (Math.random() * 20 - 10);
                return { business, score };
            });

            rankingsForPoint.sort((a, b) => b.score - a.score);

            const competitorRanks: CompetitorRank[] = rankingsForPoint.map((r, index) => ({
                rank: index + 1,
                business: r.business
            }));
            
            const targetBusinessRank = competitorRanks.find(r => r.business.id === settings.location!.id)?.rank ?? 21;

            rankings.push({
                id: pointId,
                rank: targetBusinessRank,
                lat: currentLat,
                lng: currentLng,
                competitorRanks
            });

            onProgress({ current: pointId, total: totalPoints });
            await sleep(25); // Simulate work
        }
    }

    const totalRank = rankings.reduce((sum, p) => sum + (p.rank > 20 ? 21 : p.rank), 0);
    const top3Count = rankings.filter(p => p.rank <= 3).length;
    const top10Count = rankings.filter(p => p.rank <= 10).length;

    const summary = {
        averageRank: rankings.length > 0 ? totalRank / rankings.length : 0,
        top3: rankings.length > 0 ? (top3Count / rankings.length) * 100 : 0,
        top10: rankings.length > 0 ? (top10Count / rankings.length) * 100 : 0,
    };

    // For the sidebar list, let's calculate average rank for each competitor.
    const competitorsWithAvgRank = competitors.map(comp => {
        const totalCompRank = rankings.reduce((sum, p) => {
            const compRank = p.competitorRanks.find(cr => cr.business.id === comp.id)?.rank ?? 21;
            return sum + compRank;
        }, 0);
        return {
            ...comp,
            averageRank: rankings.length > 0 ? totalCompRank / rankings.length : 21,
        };
    });
    competitorsWithAvgRank.sort((a, b) => a.averageRank - b.averageRank);

    return {
        summary,
        rankings,
        gridSize: settings.gridSize,
        competitors: competitorsWithAvgRank,
        sources: competitorSources,
    };
};
