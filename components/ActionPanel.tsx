import React from 'react';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { FireIcon } from './icons/FireIcon';
import { ScanResult, ScanSettings } from '../types';

interface ActionPanelProps {
    scanResult: ScanResult;
    scanSettings: ScanSettings;
    isHeatmapVisible: boolean;
    onToggleHeatmap: (visible: boolean) => void;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ scanResult, scanSettings, isHeatmapVisible, onToggleHeatmap }) => {
    
    const handleExport = () => {
        const { rankings } = scanResult;
        if (rankings.length === 0) {
            alert("No data to export.");
            return;
        }

        const headers = ["ID", "Latitude", "Longitude", "Your Rank", "Top Competitor"];
        const rows = rankings.map(point => [
            point.id,
            point.lat,
            point.lng,
            point.rank,
            point.competitorRanks.find(c => c.rank === 1)?.business.name ?? "N/A"
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        const filename = `GMB_Scan_${scanSettings.location?.name}_${new Date().toISOString().split('T')[0]}.csv`;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-2 space-y-2 z-20">
            <button className="w-full flex items-center gap-3 text-left p-2 rounded-md hover:bg-gray-100 text-sm font-medium text-gray-400 cursor-not-allowed" disabled>
                <ClipboardIcon />
                <span>Add To Monitoring</span>
            </button>
            <button onClick={handleExport} className="w-full flex items-center gap-3 text-left p-2 rounded-md hover:bg-gray-100 text-sm font-medium">
                <DownloadIcon />
                <span>Export Report</span>
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <div className="flex items-center justify-between p-2">
                 <span id="heatmap-label" className={`flex items-center gap-3 text-sm font-medium transition-colors ${isHeatmapVisible ? 'text-orange-600' : 'text-gray-500'}`}>
                    <FireIcon />
                    Show Heatmap
                 </span>
                 <button
                    role="switch"
                    aria-checked={isHeatmapVisible}
                    aria-labelledby="heatmap-label"
                    onClick={() => onToggleHeatmap(!isHeatmapVisible)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${isHeatmapVisible ? 'bg-orange-500' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ease-in-out duration-200 ${isHeatmapVisible ? 'translate-x-5' : 'translate-x-0.5'}`}></span>
                </button>
            </div>
        </div>
    );
};

export default ActionPanel;
