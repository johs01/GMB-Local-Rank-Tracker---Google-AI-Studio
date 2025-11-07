
import React, { useState, useEffect } from 'react';
import { ScanSettings, ScanResult, Business, Insight, InsightType, RankingPoint, ScanHistoryItem, CompetitorRank } from '../types';
import { SettingsIcon } from './icons/SettingsIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { ChevronUpIcon } from './icons/ChevronUpIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { InfoIcon } from './icons/InfoIcon';
import { BoltIcon } from './icons/BoltIcon';
import { ClockIcon } from './icons/ClockIcon'; // New Icon
import { TrashIcon } from './icons/TrashIcon'; // New Icon


interface SidebarProps {
  scanSettings: ScanSettings;
  setScanSettings: React.Dispatch<React.SetStateAction<ScanSettings>>;
  scanResult: ScanResult | null;
  onScan: () => void;
  isScanning: boolean;
  onBack: () => void;
  businesses: Business[];
  onSearch: (query: string) => void;
  isSearching: boolean;
  onSelectBusiness: (business: Business) => void;
  insights: Record<InsightType, Insight>;
  fetchInsights: (type: InsightType) => void;
  selectedPoint: RankingPoint | null;
  onHoverCompetitor: (id: string | null) => void;
  scanProgress: { current: number, total: number } | null;
  scanHistory: ScanHistoryItem[];
  onLoadHistory: (item: ScanHistoryItem) => void;
  onDeleteHistory: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = (props) => {
  if (props.scanResult) {
    return <ResultsSidebar {...props} />;
  }
  return <SettingsSidebar {...props} />;
};

const SettingsSidebar: React.FC<Omit<SidebarProps, 'scanResult' | 'onBack' | 'insights' | 'fetchInsights' | 'selectedPoint' | 'onHoverCompetitor'>> = ({ 
    scanSettings, setScanSettings, onScan, isScanning, businesses, onSearch, isSearching, onSelectBusiness, scanProgress, scanHistory, onLoadHistory, onDeleteHistory
}) => {
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        setInputValue(scanSettings.location?.name || '');
    }, [scanSettings.location]);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (!scanSettings.location && inputValue.trim().length >= 3) {
                onSearch(inputValue);
            } else {
                onSearch(''); 
            }
        }, 1500);

        return () => clearTimeout(handler);
    }, [inputValue, scanSettings.location, onSearch]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newQuery = e.target.value;
        setInputValue(newQuery);
        if (scanSettings.location) {
            setScanSettings(prev => ({ ...prev, location: null }));
        }
    };

    return (
        <aside className="w-[360px] bg-white border-r border-gray-200 p-6 flex flex-col shrink-0">
            <div className="flex items-center gap-3">
                <span className="text-indigo-600"><ChartBarIcon /></span>
                <h2 className="text-xl font-bold">Quick Scan</h2>
            </div>
            <p className="text-gray-500 text-sm mt-1">Analyze local search rankings for your target location.</p>
            
            <div className="flex-grow mt-8 overflow-y-auto -mr-3 pr-2">
                <div>
                    <h3 className="text-base font-semibold flex items-center gap-2"><SettingsIcon /> Scan Settings</h3>
                    <div className="mt-4 space-y-4 text-sm">
                        <div>
                            <label className="font-medium text-gray-700">Location</label>
                            <div className="relative">
                                <input 
                                    type="text"
                                    placeholder="Search for your business"
                                    value={inputValue}
                                    onChange={handleSearchChange}
                                    disabled={isSearching || isScanning}
                                    className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                                {isSearching && <div className="absolute right-3 top-2.5 h-5 w-5 animate-spin rounded-full border-b-2 border-indigo-500"></div>}
                                {businesses.length > 0 && !scanSettings.location && (
                                    <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 shadow-lg max-h-60 overflow-auto">
                                        {businesses.map(business => (
                                            <li key={business.id} onClick={() => onSelectBusiness(business)} className="px-4 py-2 hover:bg-gray-100 cursor-pointer">
                                                <p className="font-semibold">{business.name}</p>
                                                <p className="text-xs text-gray-500">{business.address}</p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="font-medium text-gray-700">Search Query</label>
                            <input 
                                type="text"
                                value={scanSettings.searchQuery}
                                onChange={(e) => setScanSettings(prev => ({ ...prev, searchQuery: e.target.value }))}
                                className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                disabled={isScanning}
                            />
                        </div>
                        <div>
                            <label className="font-medium text-gray-700">Grid Size</label>
                            <select
                                value={scanSettings.gridSize}
                                onChange={(e) => setScanSettings(prev => ({ ...prev, gridSize: e.target.value }))}
                                className="w-full mt-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                disabled={isScanning}
                            >
                                <option>3 x 3 (0.5 km)</option>
                                <option>5 x 5 (0.75 km)</option>
                                <option>7 x 7 (1 km)</option>
                                <option>9 x 9 (1.5 km)</option>
                                <option>11 x 11 (2 km)</option>
                                <option>13 x 13 (3 km)</option>
                                <option>15 x 11 (4 km)</option>
                                <option>21 x 21 (10 km)</option>
                            </select>
                        </div>
                    </div>
                </div>
                <ScanHistory history={scanHistory} onLoad={onLoadHistory} onDelete={onDeleteHistory} disabled={isScanning} />
            </div>

            <div className="mt-auto pt-4">
                {isScanning && scanProgress && (
                    <div className="mb-2 text-center text-sm text-gray-600">
                        <p>Scanning point {scanProgress.current} of {scanProgress.total}...</p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}></div>
                        </div>
                    </div>
                )}
                 <button 
                    onClick={onScan}
                    disabled={isScanning || !scanSettings.location}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
                 >
                    {isScanning ? 'Scanning...' : <><BoltIcon /> Start Quick Scan</>}
                 </button>
            </div>
        </aside>
    );
};

const ResultsSidebar: React.FC<SidebarProps> = ({ scanSettings, scanResult, onBack, insights, fetchInsights, selectedPoint, onHoverCompetitor }) => {
    const [activeTab, setActiveTab] = useState('summary');

    // Automatically switch to summary tab when a point is selected for drill-down
    useEffect(() => {
        if (selectedPoint) {
            setActiveTab('summary');
        }
    }, [selectedPoint]);

    const renderContent = () => {
        if (activeTab === 'summary' && scanResult) {
            // If a point is selected, show drill-down. Otherwise, show overall competitors.
            if (selectedPoint) {
                return <PointDrillDown point={selectedPoint} onHoverCompetitor={onHoverCompetitor} targetBusinessId={scanSettings.location?.id} />;
            }
            return <CompetitorList competitors={scanResult.competitors} onHoverCompetitor={onHoverCompetitor} />;
        }
        if (activeTab === 'insights') {
            return (
                <>
                    <InsightAccordion title="Ranking Insights" type="ranking" icon={<SparklesIcon />} insight={insights.ranking} onFetch={fetchInsights} isDefaultOpen={true} />
                    <InsightAccordion title="Competitor Gap" type="competitor" icon={<ChartBarIcon />} insight={insights.competitor} onFetch={fetchInsights} />
                    <InsightAccordion title="Review Volume" type="review" icon={<InfoIcon />} insight={insights.review} onFetch={fetchInsights} />
                </>
            );
        }
        return null;
    };

    return (
         <aside className="w-[360px] bg-white border-r border-gray-200 p-6 flex flex-col shrink-0">
             <button onClick={onBack} className="text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1 mb-3">
                &lt; Quick Scan
            </button>
            
            <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-base font-semibold flex items-center gap-2"><SettingsIcon /> Scan Settings</h3>
                <div className="mt-3 space-y-2 text-sm text-gray-600">
                    <p><strong>Location:</strong> {scanSettings.location?.name}</p>
                    <p><strong>Search Query:</strong> {scanSettings.searchQuery}</p>
                    <p><strong>Grid Size:</strong> {scanSettings.gridSize}</p>
                </div>
            </div>

            <div className="mt-6">
                <h3 className="text-base font-semibold flex items-center gap-2"><ChartBarIcon /> Scan Results</h3>
                <div className="mt-3 flex border border-gray-200 rounded-lg p-1 bg-gray-50">
                    <button 
                        onClick={() => setActiveTab('summary')}
                        className={`w-1/2 py-1.5 text-sm font-medium rounded-md ${activeTab === 'summary' ? 'bg-white shadow-sm' : 'text-gray-600'}`}>
                        Result Summary
                    </button>
                    <button 
                        onClick={() => setActiveTab('insights')}
                        className={`w-1/2 py-1.5 text-sm font-medium rounded-md flex items-center justify-center gap-1 ${activeTab === 'insights' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-600'}`}>
                       <SparklesIcon /> AI Insights
                    </button>
                </div>
            </div>

            <div className="mt-4 flex-grow overflow-y-auto pr-2 -mr-3 space-y-3">
                {renderContent()}
            </div>
         </aside>
    );
};

const CompetitorList: React.FC<{competitors: Business[], onHoverCompetitor: (id: string | null) => void}> = ({ competitors, onHoverCompetitor }) => (
    <div className="border border-gray-200 rounded-lg bg-white">
        <div className="p-3 border-b border-gray-200">
            <h4 className="font-semibold text-sm">Top 20 Competitors</h4>
        </div>
        <ul className="divide-y divide-gray-200">
            {competitors.length > 0 ? competitors.map((c, i) => (
               <li key={c.id} className="px-3 py-2 text-sm" onMouseEnter={() => onHoverCompetitor(c.id)} onMouseLeave={() => onHoverCompetitor(null)}>
                   <p className="font-medium text-gray-800">{i + 1}. {c.name}</p>
                   <p className="text-xs text-gray-500 truncate">{c.address}</p>
               </li>
            )) : (
                <li className="px-3 py-4 text-sm text-gray-500 text-center">No competitors found.</li>
            )}
        </ul>
    </div>
);

const PointDrillDown: React.FC<{point: RankingPoint, onHoverCompetitor: (id: string | null) => void, targetBusinessId?: string}> = ({ point, onHoverCompetitor, targetBusinessId }) => (
    <div className="border border-gray-200 rounded-lg bg-white">
        <div className="p-3 border-b border-gray-200">
            <h4 className="font-semibold text-sm">Rankings at this Point</h4>
            <p className="text-xs text-gray-500">Your Rank: <span className="font-bold text-indigo-600">{point.rank}</span></p>
        </div>
        <ul className="divide-y divide-gray-200 max-h-[40vh] overflow-y-auto">
            {point.competitorRanks.map(({ rank, business }) => (
               <li key={business.id} className={`px-3 py-2 text-sm ${business.id === targetBusinessId ? 'bg-indigo-50' : ''}`} onMouseEnter={() => onHoverCompetitor(business.id)} onMouseLeave={() => onHoverCompetitor(null)}>
                   <p className="font-medium text-gray-800">{rank}. {business.name}</p>
                   <p className="text-xs text-gray-500 truncate">{business.address}</p>
               </li>
            ))}
        </ul>
    </div>
);

const ScanHistory: React.FC<{history: ScanHistoryItem[], onLoad: (item: ScanHistoryItem) => void, onDelete: (id: string) => void, disabled: boolean}> = ({ history, onLoad, onDelete, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (history.length === 0) return null;

    return (
        <div className="mt-6">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center text-left text-base font-semibold">
                <span className="flex items-center gap-2"><ClockIcon /> Scan History</span>
                {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>
            {isOpen && (
                <div className="mt-2 space-y-2">
                    {history.map(item => (
                        <div key={item.id} className="border rounded-lg p-2 text-sm hover:border-indigo-400 group">
                            <p className="font-semibold truncate">{item.settings.location?.name}</p>
                            <p className="text-xs text-gray-500 truncate">"{item.settings.searchQuery}" on {item.timestamp}</p>
                            <div className="flex items-center justify-end gap-2 mt-1">
                                <button onClick={() => onDelete(item.id)} disabled={disabled} className="p-1 text-gray-400 hover:text-red-500 disabled:text-gray-300 disabled:cursor-not-allowed">
                                    <TrashIcon />
                                </button>
                                <button onClick={() => onLoad(item)} disabled={disabled} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-indigo-300 disabled:cursor-not-allowed">
                                    Load
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


interface InsightAccordionProps {
    title: string; type: InsightType; icon: React.ReactNode;
    insight: Insight; onFetch: (type: InsightType) => void; isDefaultOpen?: boolean;
}

const InsightAccordion: React.FC<InsightAccordionProps> = ({ title, type, icon, insight, onFetch, isDefaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(isDefaultOpen);

    useEffect(() => {
        if(isOpen && insight.status === 'idle') {
            onFetch(type);
        }
    }, [isOpen, insight.status, type, onFetch]);

    const headerClass = isOpen ? "bg-indigo-600 text-white" : "bg-gray-100 hover:bg-gray-200";

    return (
        <div className="border border-gray-200 rounded-lg">
            <button onClick={() => setIsOpen(!isOpen)} className={`w-full flex justify-between items-center p-3 rounded-t-lg ${headerClass} transition-colors`}>
                <div className="flex items-center gap-2">
                    <span className={isOpen ? 'text-indigo-300' : 'text-indigo-600'}>{icon}</span>
                    <span className="font-semibold text-sm">{title}</span>
                </div>
                {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>
            {isOpen && (
                <div className="p-4 text-sm text-gray-700 bg-white rounded-b-lg">
                    {insight.status === 'loading' && <div className="flex items-center justify-center py-4"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-indigo-500"></div></div>}
                    {insight.status === 'error' && <p className="text-red-500">{insight.content}</p>}
                    {insight.status === 'success' && (
                        <div>
                            <p className="whitespace-pre-wrap">{insight.content}</p>
                            {insight.sources.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="font-semibold text-xs text-gray-500 uppercase">Sources</h4>
                                    <ul className="mt-2 space-y-1">
                                        {insight.sources.map((source, index) => (
                                            <li key={index}>
                                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-xs block truncate">
                                                    {source.title || source.uri}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Sidebar;
