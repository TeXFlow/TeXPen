import React from 'react';
import { HistoryItem } from '../types';
import { useMathJax } from '../hooks/useMathJax';

interface HistorySidebarProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  isOpen: boolean;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ history, onSelect, isOpen }) => {
  // Trigger MathJax when history updates
  useMathJax(history, undefined, 'history-math');

  return (
    <div 
        className={`flex-none border-r border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-black/20 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'w-64 opacity-100' : 'w-0 opacity-0 border-r-0'}`}
    >
       <div className="w-64 h-full flex flex-col">
           <div className="flex-none p-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center whitespace-nowrap">
              <span className="text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider">History</span>
              <span className="text-[10px] text-slate-400 dark:text-white/20">{history.length} items</span>
           </div>
           <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-2 custom-scrollbar">
              {history.length === 0 ? (
                  <div className="p-4 text-center whitespace-nowrap">
                      <p className="text-slate-400 dark:text-white/20 text-xs italic">No history yet.</p>
                  </div>
              ) : (
                  history.map((item) => (
                      <button 
                          key={item.id}
                          onClick={() => onSelect(item)}
                          className="w-full text-left p-3 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-transparent hover:border-black/5 dark:hover:border-white/10 transition-all group relative overflow-hidden"
                      >
                          <div className="history-math text-slate-700 dark:text-white/80 text-sm truncate opacity-70 group-hover:opacity-100 h-6">
                              {`\\( ${item.latex} \\)`}
                          </div>
                          <div className="mt-1 flex justify-between items-center">
                              <span className="text-[10px] text-slate-400 dark:text-white/30 font-mono">
                                  {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                          </div>
                      </button>
                  ))
              )}
           </div>
       </div>
       <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
};

export default HistorySidebar;