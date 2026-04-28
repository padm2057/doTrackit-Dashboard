import React, { useMemo, useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';
import { DailyWorkload } from '../utils/scheduler';

interface WorkloadChartProps {
  data: DailyWorkload[];
  isDarkMode?: boolean;
  weekdayHours: number;
  setWeekdayHours: (hours: number) => void;
  weekendHours: number;
  setWeekendHours: (hours: number) => void;
  readOnly?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const WorkloadChart: React.FC<WorkloadChartProps> = ({ 
  data, 
  isDarkMode = false,
  weekdayHours,
  setWeekdayHours,
  weekendHours,
  setWeekendHours,
  readOnly = false,
  onMoveUp,
  onMoveDown
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Extract unique phases present in the data for stacking
  const phases = useMemo(() => {
    const keys = new Set<string>();
    data.forEach(d => {
      Object.keys(d).forEach(k => {
        if (['date', 'hours', 'label', 'tooltipLabel', 'isWeekend', 'limit'].indexOf(k) === -1) {
          keys.add(k);
        }
      });
    });
    return Array.from(keys);
  }, [data]);

  const fallbackColors = [
    '#f43f5e', // rose
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16'  // lime
  ];

  const getPhaseColor = (phase: string) => {
    if (phase.includes('Design')) return '#a855f7'; 
    if (phase.includes('Frontend')) return '#3b82f6';
    if (phase.includes('Backend') || phase.includes('Business')) return '#6366f1';
    if (phase.includes('Verification') || phase.includes('QA')) return '#f43f5e';
    if (phase.includes('Deployment')) return '#10b981';
    if (phase.includes('User')) return '#f59e0b';
    
    let hash = 0;
    for (let i = 0; i < phase.length; i++) {
        hash = phase.charCodeAt(i) + ((hash << 5) - hash);
    }
    return fallbackColors[Math.abs(hash) % fallbackColors.length];
  };

  const axisColor = isDarkMode ? '#94a3b8' : '#94a3b8';
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 transition-all duration-200 h-auto flex flex-col w-full break-inside-avoid">
      {/* Accordion Header */}
      <div 
        className={`px-6 py-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isOpen ? 'border-b border-slate-200 dark:border-slate-800' : ''}`}
      >
        <div 
            onClick={() => setIsOpen(!isOpen)}
            className="flex-grow cursor-pointer"
        >
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Daily Workload Intensity
            {readOnly && (
               <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">LOCKED</span>
            )}
          </h3>
          {!isOpen && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Visualize capacity vs demand.</p>}
        </div>

        <div className="flex items-center gap-4">
            {/* Reorder Controls */}
            {(onMoveUp || onMoveDown) && (
                <div className="flex flex-col gap-0.5 opacity-50 hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }} 
                        disabled={!onMoveUp}
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-20"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-slate-500">
                            <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
                        disabled={!onMoveDown}
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded disabled:opacity-20"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-slate-500">
                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            )}

            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 cursor-pointer ${isOpen ? 'rotate-180' : ''}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
            </div>
        </div>
      </div>
      
      {/* Content */}
      {isOpen && (
        // ... (keep existing content)
        <div className="p-6 h-80 flex flex-col animate-fade-in">
            <div className="flex justify-between items-start mb-2">
                <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Colored by Phase</span>
                    </div>
                </div>

                {/* Capacity Inputs - Interactive */}
                <div className={`flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700/50 ${readOnly ? 'opacity-60 pointer-events-none' : ''}`}>
                    <div className="flex flex-col items-center">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Weekdays</label>
                        <div className="flex items-center gap-1">
                            <input 
                                type="number" 
                                min="0" 
                                max="24" 
                                disabled={readOnly}
                                value={weekdayHours}
                                onChange={(e) => setWeekdayHours(Number(e.target.value))}
                                className="w-12 text-center text-sm font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:dark:bg-slate-800"
                            />
                            <span className="text-xs text-slate-400 font-bold">h</span>
                        </div>
                    </div>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                    <div className="flex flex-col items-center">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Weekends</label>
                        <div className="flex items-center gap-1">
                            <input 
                                type="number" 
                                min="0" 
                                max="24" 
                                disabled={readOnly}
                                value={weekendHours}
                                onChange={(e) => setWeekendHours(Number(e.target.value))}
                                className="w-12 text-center text-sm font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-slate-700 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:dark:bg-slate-800"
                            />
                            <span className="text-xs text-slate-400 font-bold">h</span>
                        </div>
                    </div>
                </div>
            </div>
      
            <div className="flex-1 min-h-0 min-w-0 relative">
                <div className="absolute inset-0">
                {isMounted ? (
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                        <BarChart
                        data={data}
                        margin={{
                            top: 5,
                            right: 10,
                            left: 0,
                            bottom: 5,
                        }}
                        >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                        <XAxis 
                            dataKey="label" 
                            stroke={axisColor} 
                            fontSize={11} 
                            tickMargin={5}
                            interval="preserveStartEnd"
                        />
                        <YAxis 
                            stroke={axisColor} 
                            fontSize={11}
                            width={30}
                            label={{ value: 'Hours', angle: -90, position: 'insideLeft', style: { fill: axisColor, fontSize: 10 } }}
                        />
                        <Tooltip
                            cursor={{ fill: isDarkMode ? '#1e293b' : '#f1f5f9' }}
                            content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const item = payload[0].payload as DailyWorkload;
                                // Sort payload by value desc to show biggest contributors first
                                const sortedPayload = [...payload].sort((a, b) => Number(b.value) - Number(a.value));
                                
                                return (
                                <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 shadow-lg rounded-lg text-xs z-50">
                                    <p className="font-bold text-slate-800 dark:text-slate-200 mb-1 border-b border-slate-100 dark:border-slate-700 pb-1">{item.tooltipLabel}</p>
                                    
                                    {sortedPayload.map((entry: any) => (
                                        <div key={entry.name} className="flex items-center gap-2 mb-0.5">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                            <span className="text-slate-600 dark:text-slate-300 font-medium">{entry.name}:</span>
                                            <span className="text-slate-900 dark:text-slate-100 font-bold">{entry.value}h</span>
                                        </div>
                                    ))}
                                    
                                    <div className="mt-2 pt-1 border-t border-slate-100 dark:border-slate-700 flex justify-between gap-4">
                                        <span className="text-slate-500 dark:text-slate-400">Total: {item.hours}h</span>
                                        <span className="text-slate-400 dark:text-slate-500">Limit: {item.limit}h</span>
                                    </div>

                                    {item.hours > item.limit && (
                                    <p className="text-red-500 font-bold mt-1 text-right">Overloaded!</p>
                                    )}
                                </div>
                                );
                            }
                            return null;
                            }}
                        />
                        
                        {phases.map(phase => (
                            <Bar 
                                key={phase} 
                                dataKey={phase} 
                                stackId="a" 
                                fill={getPhaseColor(phase)} 
                                animationDuration={500}
                            />
                        ))}

                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
                    </div>
                )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};