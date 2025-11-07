
import React from 'react';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { EyeIcon } from './icons/EyeIcon';
import { ScanResult, ScanSettings } from '../types';

interface ActionPanelProps {
    scanResult: ScanResult;
    scanSettings: ScanSettings;
}

const ActionPanel: React.FC<ActionPanelProps> = ({ scanResult, scanSettings }) => {
    
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
                 <div className="flex items-center gap-3 text-sm font-medium text-gray-400">
                    <EyeIcon />
                    <span>Show Competitors</span>
                 </div>
                 <label htmlFor="competitors-toggle" className="inline-flex relative items-center cursor-not-allowed">
                    <input type="checkbox" value="" id="competitors-toggle" className="sr-only peer" disabled />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
            </div>
        </div>
    );
};

export default ActionPanel;
