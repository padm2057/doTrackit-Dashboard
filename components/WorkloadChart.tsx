import React, { useMemo } from 'react';
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
}

export const WorkloadChart: React.FC<WorkloadChartProps> = ({ 
  data, 
  isDarkMode = false,
  weekdayHours,
  setWeekdayHours,
  weekendHours,
  setWeekendHours,
  readOnly = false
}) => {
  
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

  const getPhaseColor = (phase: string) => {
    if (phase.includes('Design')) return '#a855f7'; // purple-500
    if (phase.includes('Frontend')) return '#3b82f6'; // blue-500
    if (phase.includes('Backend') || phase.includes('Business')) return '#6366f1'; // indigo-500
    // Swapped QA and User
    if (phase.includes('Verification') || phase.includes('QA')) return '#f43f5e'; // rose-500 (Was Amber)
    if (phase.includes('Deployment')) return '#10b981'; // emerald-500
    if (phase.includes('User')) return '#f59e0b'; // amber-500 (Was Rose)
    return isDarkMode ? '#94a3b8' : '#64748b'; // slate-400 : slate-500
  };

  const axisColor = isDarkMode ? '#94a3b8' : '#94a3b8';
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 h-80 flex flex-col w-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Daily Workload Intensity
            {readOnly && (
               <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">LOCKED</span>
            )}
          </h3>
          <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
             <div className="flex items-center gap-1">
               <span className="text-[10px] text-slate-400 dark:text-slate-500">Colored by Phase</span>
             </div>
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
          <ResponsiveContainer width="99%" height="100%" minWidth={0} minHeight={0} debounce={200}>
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
        </div>
      </div>
    </div>
  );
};