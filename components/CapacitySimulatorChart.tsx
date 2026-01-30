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
  LabelList
} from 'recharts';
import { Task } from '../types';
import { calculateProjectSchedule } from '../utils/scheduler';

interface CapacitySimulatorChartProps {
  tasks: Task[];
  currentWeekday: number;
  currentWeekend: number;
  isDarkMode?: boolean;
  bufferPercent: number;
  onBufferChange: (val: number) => void;
  startDate?: Date;
  readOnly?: boolean;
}

export const CapacitySimulatorChart: React.FC<CapacitySimulatorChartProps> = ({ 
  tasks, 
  currentWeekday, 
  currentWeekend,
  isDarkMode = false,
  bufferPercent,
  onBufferChange,
  startDate,
  readOnly = false
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const data = useMemo(() => {
    // Helper to calc duration
    const getDuration = (wkDay: number, wkEnd: number, taskList: Task[] = tasks) => {
      // Pass the startDate to the scheduler
      const schedule = calculateProjectSchedule(taskList, wkDay, wkEnd, startDate);
      if (schedule.length === 0) return { days: 0, date: new Date() };
      
      const start = schedule[0].startDate.getTime();
      const end = Math.max(...schedule.map(t => t.endDate.getTime()));
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      return { days, date: new Date(end) };
    };

    // 1. Realistic Plan (Current Settings + Adjustable Buffer)
    const bufferedTasks = tasks.map(t => ({
        ...t,
        duration_hours: t.duration_hours * (1 + (bufferPercent / 100))
    }));
    // Use currentWeekday/currentWeekend so that 0% buffer matches Current Plan exactly
    const realistic = getDuration(currentWeekday, currentWeekend, bufferedTasks);
    
    // 2. Current Settings (Raw estimates)
    const current = getDuration(currentWeekday, currentWeekend);
    
    // 3. Max Velocity (Hustle, Raw estimates)
    const hustle = getDuration(10, 5);

    return [
      {
        name: 'Realistic Plan',
        desc: `Current + ${bufferPercent}% Buffer`,
        days: realistic.days,
        date: realistic.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        color: '#10b981', // emerald-500
        opacity: 0.7
      },
      {
        name: 'Current Plan',
        desc: `${currentWeekday}h/day, ${currentWeekend}h Wknds`,
        days: current.days,
        date: current.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        color: '#3b82f6', // blue-500
        opacity: 1
      },
      {
        name: 'Max Velocity',
        desc: '10h/day, 5h Wknds',
        days: hustle.days,
        date: hustle.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        color: '#f43f5e', // rose-500
        opacity: 0.8
      }
    ];
  }, [tasks, currentWeekday, currentWeekend, bufferPercent, startDate]);

  const axisColor = isDarkMode ? '#94a3b8' : '#64748b';
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 transition-all duration-200 h-auto flex flex-col w-full">
      {/* Accordion Header */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isOpen ? 'border-b border-slate-200 dark:border-slate-800' : ''}`}
      >
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Schedule Scenarios
            {readOnly && (
               <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">LOCKED</span>
            )}
          </h3>
          {!isOpen && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Compare delivery speeds.</p>}
        </div>
        
        <div className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
        </div>
      </div>
      
      {/* Content */}
      {isOpen && (
        <div className="p-6 h-80 flex flex-col animate-fade-in">
             <div className="flex justify-between items-start mb-2">
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Compare delivery speeds.</p>
                
                {/* Buffer Input - Interactive */}
                <div className={`flex flex-col items-end ${readOnly ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Safety Buffer %</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            disabled={readOnly}
                            value={bufferPercent}
                            onChange={(e) => onBufferChange(parseInt(e.target.value))}
                            className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 disabled:cursor-not-allowed"
                        />
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 min-w-[30px] text-right">
                            {bufferPercent}%
                        </span>
                    </div>
                </div>
             </div>
             
             <div className="flex-1 min-h-0 min-w-0 relative">
                <div className="absolute inset-0">
                {isMounted ? (
                    <ResponsiveContainer width="100%" height="100%" debounce={50}>
                        <BarChart
                        layout="vertical"
                        data={data}
                        margin={{ top: 10, right: 60, left: 10, bottom: 5 }}
                        barCategoryGap={20}
                        >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke={gridColor} />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={85} 
                            tick={{ fontSize: 11, fill: axisColor, fontWeight: 600 }}
                            interval={0}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                <div className="bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 shadow-lg rounded text-xs z-50">
                                    <div className="font-bold text-slate-800 dark:text-slate-200">{d.name}</div>
                                    <div className="text-slate-500 dark:text-slate-400 mb-1">{d.desc}</div>
                                    <div className="flex justify-between gap-4 border-t border-slate-100 dark:border-slate-700 pt-1 mt-1">
                                    <span className="text-slate-600 dark:text-slate-400">Duration:</span>
                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{d.days} Days</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                    <span className="text-slate-600 dark:text-slate-400">Launch:</span>
                                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{d.date}</span>
                                    </div>
                                </div>
                                );
                            }
                            return null;
                            }}
                        />
                        <Bar dataKey="days" radius={[0, 4, 4, 0]} barSize={32}>
                            {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={entry.opacity} />
                            ))}
                            <LabelList 
                            dataKey="date" 
                            position="right" 
                            style={{ fontSize: '11px', fontWeight: 'bold', fill: isDarkMode ? '#94a3b8' : '#475569' }} 
                            />
                        </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
                    </div>
                )}
                </div>
                
                {/* Comparison Text Overlay */}
                <div className="absolute bottom-2 right-2 text-[10px] text-slate-400 dark:text-slate-500 italic bg-white/80 dark:bg-slate-900/80 px-2 rounded">
                    Working "Max Velocity" saves {Math.max(0, data[1].days - data[2].days)} days vs Current.
                </div>
             </div>
        </div>
      )}
    </div>
  );
};