
import React from 'react';
import { LogoIcon } from './icons/LogoIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { BoltIcon } from './icons/BoltIcon';

const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-gray-200 px-4 h-16 flex items-center justify-between z-30 shrink-0">
      <div className="flex items-center gap-4">
        <LogoIcon />
        <h1 className="text-lg font-bold text-gray-800">GRID MY BUSINESS</h1>
        <div className="h-6 w-px bg-gray-200"></div>
        <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-md px-3 py-1.5 text-sm font-medium">
          <span>Acme Workspace</span>
          <ChevronDownIcon />
        </button>
      </div>
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors">
          <BoltIcon />
          <span>Quick Scan</span>
        </button>
        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm cursor-pointer">
          S
        </div>
      </div>
    </header>
  );
};

export default Header;
