import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ProcessedTask, CalendarNote, TaskNote } from '../types';

interface GanttChartProps {
  tasks: ProcessedTask[];
  baselineTasks?: ProcessedTask[]; // Ghost main
  baselineRealisticTasks?: ProcessedTask[]; // Ghost realistic
  baselineMaxVelocityTasks?: ProcessedTask[]; // Ghost max velocity
  realisticTasks?: ProcessedTask[];
  maxVelocityTasks?: ProcessedTask[];
  weekendHours: number;
  weekdayHours?: number; // Added to calc intensity
  isDarkMode?: boolean;
  isPdfExport?: boolean;
  bufferPercent?: number;
  projectStartDate: Date;
  currentDate?: Date;
  onTaskToggle?: (taskId: string) => void;
  isExecutionMode?: boolean;
  calendarNotes?: CalendarNote[];
  taskNotes?: TaskNote[];
  onDateClick?: (date: Date) => void;
  onTaskClick?: (task: ProcessedTask) => void;
}

export const GanttChart: React.FC<GanttChartProps> = ({ 
  tasks, 
  baselineTasks,
  baselineRealisticTasks,
  baselineMaxVelocityTasks,
  realisticTasks, 
  maxVelocityTasks, 
  weekendHours, 
  weekdayHours = 8, // Default fallback
  isDarkMode = false,
  isPdfExport = false,
  bufferPercent = 30,
  projectStartDate,
  currentDate,
  onTaskToggle,
  isExecutionMode = false,
  calendarNotes = [],
  taskNotes = [],
  onDateClick,
  onTaskClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // Tooltip State
  const [activeTooltip, setActiveTooltip] = useState<{
    x: number;
    y: number;
    task: ProcessedTask;
    realistic?: ProcessedTask;
    dailyInfo?: { date: string, hours: number, capacity: number };
  } | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    if (typeof window !== 'undefined') {
        checkMobile();
        window.addEventListener('resize', checkMobile);
    }
    return () => {
        if (typeof window !== 'undefined') window.removeEventListener('resize', checkMobile);
    }
  }, []);
  
  // Metrics
  const DAY_WIDTH = isPdfExport ? 25 : (isMobile ? 40 : 60);
  const HEADER_HEIGHT = 54;
  const ROW_HEIGHT = 52; 
  
  // Column Widths
  const NAME_COL_WIDTH = isPdfExport ? 140 : (isMobile ? 50 : 220); 
  const NOTES_COL_WIDTH = isPdfExport ? 30 : (isMobile ? 35 : 80); // Increased from 60 to 80
  const SIDEBAR_WIDTH = NAME_COL_WIDTH + NOTES_COL_WIDTH;
  
  const VISUAL_SHIFT_DAYS = 1;
  
  const getEndDay = (taskList?: ProcessedTask[]) => 
    taskList ? taskList.reduce((acc, t) => Math.max(acc, t.startOffsetDays + t.durationDays), 0) : 0;

  const effectiveMaxDay = Math.max(
      getEndDay(tasks),
      getEndDay(realisticTasks),
      getEndDay(baselineTasks),
      getEndDay(baselineRealisticTasks),
      getEndDay(maxVelocityTasks),
      getEndDay(baselineMaxVelocityTasks)
  );
    
  const totalDays = effectiveMaxDay + 4 + VISUAL_SHIFT_DAYS; 
  const chartWidth = totalDays * DAY_WIDTH;
  const totalWidth = SIDEBAR_WIDTH + chartWidth;

  const now = currentDate || new Date();
  const diffTime = now.getTime() - projectStartDate.getTime();
  const nowOffsetDays = (diffTime / (1000 * 60 * 60 * 24)) + VISUAL_SHIFT_DAYS;
  const showNowLine = nowOffsetDays >= 0 && nowOffsetDays <= totalDays;
  
  const getDateLabel = (dayOffset: number) => {
    const d = new Date(projectStartDate);
    d.setDate(d.getDate() + dayOffset - VISUAL_SHIFT_DAYS);
    return {
      dateObj: d,
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
      day: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      isWeekend: d.getDay() === 0 || d.getDay() === 6
    };
  };
  
  // Helper to format date for comparison
  const toDateKey = (d: Date) => {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Helper to calc offset from distribution key
  const getDayOffset = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const current = new Date(y, m - 1, d);
      const startZero = new Date(projectStartDate);
      startZero.setHours(0,0,0,0);
      const diff = current.getTime() - startZero.getTime();
      return Math.round(diff / (1000 * 60 * 60 * 24));
  };

  const getDayCapacity = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m-1, d);
      const day = date.getDay();
      return (day === 0 || day === 6) ? weekendHours : weekdayHours;
  };

  const getPhaseColor = (phase: string) => {
    if (phase.includes('Design')) return 'bg-purple-500 border-purple-600';
    if (phase.includes('Frontend')) return 'bg-blue-500 border-blue-600';
    if (phase.includes('Backend') || phase.includes('Business')) return 'bg-indigo-500 border-indigo-600';
    if (phase.includes('Verification') || phase.includes('QA')) return 'bg-rose-500 border-rose-600';
    if (phase.includes('Deployment')) return 'bg-emerald-500 border-emerald-600';
    if (phase.includes('User')) return 'bg-amber-500 border-amber-600';
    return isDarkMode ? 'bg-slate-600 border-slate-700' : 'bg-slate-500 border-slate-600';
  };

  return (
    <div className={`gantt-container bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col ${isExecutionMode ? 'ring-2 ring-rose-500/20' : ''}`}>
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4">
        <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">Timeline & Dependencies</h3>
            {isExecutionMode && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase tracking-wider animate-pulse">
                    Execution Mode
                </span>
            )}
        </div>
        
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs w-full xl:w-auto xl:justify-end">
           <div className="flex items-center gap-4 border-r border-slate-200 dark:border-slate-700 pr-4 mr-2">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span className="w-8 h-2 bg-emerald-500 rounded-sm"></span> Realistic (+{bufferPercent}%)
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span className="w-8 h-2 bg-rose-500 rounded-sm"></span> Max Velocity
                </div>
           </div>
           <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400"><span className="w-2.5 h-2.5 bg-purple-500 rounded-sm"></span> Design</div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400"><span className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></span> Frontend</div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400"><span className="w-2.5 h-2.5 bg-indigo-500 rounded-sm"></span> Logic</div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400"><span className="w-2.5 h-2.5 bg-rose-500 rounded-sm"></span> QA</div>
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></span> Deploy</div>
           </div>
        </div>
      </div>

      <div className="gantt-scroll-area overflow-x-auto" ref={containerRef}>
        <div className="flex relative" style={{ width: totalWidth, height: (tasks.length * ROW_HEIGHT) + HEADER_HEIGHT + 20 }}>
            {/* Left Column: Task Names & Notes */}
            <div style={{ width: SIDEBAR_WIDTH }} className="sticky left-0 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.3)] transition-all duration-300">
                {/* Sidebar Header */}
                <div style={{ height: HEADER_HEIGHT }} className={`sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center`}>
                    <div style={{ width: NAME_COL_WIDTH }} className={`h-full flex items-center px-3 ${isMobile ? 'justify-center' : ''}`}>
                        {isMobile ? '#' : 'Task Name'}
                    </div>
                    <div style={{ width: NOTES_COL_WIDTH }} className="h-full flex items-center justify-center border-l border-slate-100 dark:border-slate-700">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-slate-400">
                             <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z" clipRule="evenodd" />
                             <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
                        </svg>
                    </div>
                </div>

                {tasks.map((task) => {
                    const words = task.task_name.split(' ');
                    const shortName = words.slice(0, 3).join(' ') + (words.length > 3 ? '...' : '');
                    const hasUnfinishedPredecessors = task.predecessors.some(predId => {
                        const pred = tasks.find(t => t.id === predId);
                        return pred && !pred.isCompleted;
                    });
                    const isDependencyLocked = !task.isCompleted && hasUnfinishedPredecessors;
                    const textOpacityClass = isExecutionMode && !task.isCompleted ? 'opacity-80' : '';
                    const hasNotes = taskNotes.some(n => n.taskId === task.id);

                    return (
                        <div key={task.id} style={{ height: ROW_HEIGHT }} className="border-b border-slate-100 dark:border-slate-800 flex items-center text-xs font-medium text-slate-700 dark:text-slate-300">
                            {/* Name Column */}
                            <div style={{ width: NAME_COL_WIDTH }} className={`h-full flex items-center px-3 ${isMobile ? 'justify-center' : ''}`} title={task.task_name}>
                                <div className="flex items-center w-full min-w-0">
                                    <div onClick={() => !isDependencyLocked && onTaskToggle && onTaskToggle(task.id)} className={`flex items-center justify-center w-6 h-6 rounded-full border text-[10px] font-bold transition-all duration-200 flex-shrink-0 mr-2 z-10 relative ${task.isCompleted ? 'bg-black dark:bg-slate-200 text-white dark:text-slate-900 border-black dark:border-slate-200 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : isDependencyLocked ? 'bg-slate-100 text-slate-300 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700 cursor-not-allowed' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-300 dark:border-slate-600 hover:border-indigo-500 hover:text-indigo-600 cursor-pointer'} ${isExecutionMode && !task.isCompleted && !isDependencyLocked ? 'animate-pulse ring-1 ring-indigo-500/50' : ''}`}>
                                        {task.isCompleted ? '✓' : task.id}
                                    </div>
                                    {!isMobile && (
                                        <span 
                                            className={`truncate transition-all ${task.isCompleted ? 'text-slate-400 line-through' : (isDependencyLocked ? 'text-slate-400 dark:text-slate-600' : textOpacityClass)}`}
                                        >
                                            {shortName}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Notes Column */}
                            <div style={{ width: NOTES_COL_WIDTH }} className="h-full flex items-center justify-center border-l border-slate-100 dark:border-slate-700">
                                <button 
                                    onClick={() => onTaskClick && onTaskClick(task)}
                                    className={`p-2 rounded-xl transition-all relative group/note ${hasNotes ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10'}`}
                                    title={hasNotes ? "View notes" : "Add note"}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                        <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z" clipRule="evenodd" />
                                        <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
                                    </svg>
                                    {hasNotes && (
                                        <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500 border border-white dark:border-slate-900"></span>
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Right Column: Chart Area */}
            <div className="flex-1 relative h-full">
                {/* Timeline Header */}
                <div className="flex sticky top-0 left-0 right-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 z-20" style={{ height: HEADER_HEIGHT }}>
                    {Array.from({ length: Math.ceil(totalDays) }).map((_, i) => {
                        const { day, month, weekday, isWeekend, dateObj } = getDateLabel(i);
                        const isZeroWorkWeekend = isWeekend && weekendHours === 0;
                        const dateKey = toDateKey(dateObj);
                        const hasNote = calendarNotes.some(n => n.date === dateKey);

                        return (
                            <div 
                                key={i} 
                                style={{ width: DAY_WIDTH }} 
                                onClick={() => onDateClick && onDateClick(dateObj)}
                                className={`flex-shrink-0 flex flex-col items-center justify-center text-[10px] border-r border-slate-200 dark:border-slate-800 leading-tight cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors relative group
                                    ${isZeroWorkWeekend ? 'bg-slate-200 dark:bg-slate-950 text-slate-400 dark:text-slate-600' : isWeekend ? 'bg-slate-100 dark:bg-slate-900' : ''}`}
                                title="Click to add note"
                            >
                                <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">{weekday}</span>
                                <span className={`font-bold text-xs ${hasNote ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}`}>{day}</span>
                                <span className="text-[9px] text-slate-400 dark:text-slate-500">{month}</span>
                                
                                {hasNote && (
                                    <div className="absolute bottom-1 w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-sm"></div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Grid Background */}
                <div className="absolute top-0 bottom-0 left-0 right-0 z-0 flex pointer-events-none">
                    {Array.from({ length: Math.ceil(totalDays) }).map((_, i) => {
                        const { isWeekend } = getDateLabel(i);
                        const isZeroWorkWeekend = isWeekend && weekendHours === 0;
                        return <div key={i} style={{ width: DAY_WIDTH }} className={`flex-shrink-0 border-r border-dashed border-slate-300 dark:border-slate-800 h-full ${isZeroWorkWeekend ? 'bg-slate-100 dark:bg-slate-950/50' : isWeekend ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''}`} />;
                    })}
                </div>

                {/* Today Line */}
                {showNowLine && (
                    <div className="absolute bottom-0 border-l-2 border-dashed border-amber-500 z-50 pointer-events-none" style={{ left: Math.max(nowOffsetDays * DAY_WIDTH, 0), top: HEADER_HEIGHT }}>
                        <div className="absolute -top-3 text-[9px] font-bold text-white bg-amber-600 dark:bg-amber-500 px-2 py-1 rounded shadow-md whitespace-nowrap ring-2 ring-white dark:ring-slate-900 z-50 transition-transform duration-300" style={{ left: 0, transform: nowOffsetDays * DAY_WIDTH < 25 ? 'none' : 'translateX(-50%)' }}>Today</div>
                    </div>
                )}

                {/* Dependency Lines */}
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0" style={{ marginTop: HEADER_HEIGHT }}>
                    <defs>
                        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                            <polygon points="0 0, 6 2, 0 4" fill={isDarkMode ? "#64748b" : "#94a3b8"} />
                        </marker>
                    </defs>
                    {tasks.map(task => 
                        task.predecessors.map(predId => {
                            const pred = tasks.find(p => p.id === predId);
                            if (!pred) return null;

                            const pOffset = Number(pred.startOffsetDays);
                            const pDuration = Number(pred.durationDays);
                            const pRow = Number(pred.rowIndex);
                            const tOffset = Number(task.startOffsetDays);
                            const tRow = Number(task.rowIndex);

                            const startX = (pOffset + pDuration + VISUAL_SHIFT_DAYS) * DAY_WIDTH;
                            const startY = (pRow * ROW_HEIGHT) + 26; 
                            const endX = (tOffset + VISUAL_SHIFT_DAYS) * DAY_WIDTH;
                            const endY = (tRow * ROW_HEIGHT) + 26;
                            
                            const gap = endX - startX;
                            const midX = startX + (gap > 20 ? 15 : gap/2);
                            return <path key={`${pred.id}-${task.id}`} d={`M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`} fill="none" stroke={isDarkMode ? "#64748b" : "#94a3b8"} strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#arrowhead)" className="transition-all duration-300 opacity-50" />;
                        })
                    )}
                </svg>

                {/* Task Bars (Ghost + Broken Main) */}
                <div className="absolute top-0 left-0 w-full z-10" style={{ marginTop: HEADER_HEIGHT }}>
                    {tasks.map((task) => {
                        const realistic = realisticTasks?.find(t => t.id === task.id);
                        const maxVel = maxVelocityTasks?.find(t => t.id === task.id);
                        const baseline = baselineTasks?.find(t => t.id === task.id);
                        const baselineRealistic = baselineRealisticTasks?.find(t => t.id === task.id);
                        const baselineMaxVel = baselineMaxVelocityTasks?.find(t => t.id === task.id);
                        const isDone = task.isCompleted;

                        return (
                            <div key={task.id} style={{ height: ROW_HEIGHT, width: '100%', position: 'relative' }}>
                                {/* Ghost Bars (Continuous for context) */}
                                {baselineRealistic && <div className="absolute rounded-sm border border-emerald-300 dark:border-emerald-700/50 bg-emerald-100/30 dark:bg-emerald-900/10 pointer-events-none" style={{ left: (baselineRealistic.startOffsetDays + VISUAL_SHIFT_DAYS) * DAY_WIDTH, width: Math.max(baselineRealistic.durationDays * DAY_WIDTH, 4), height: 4, top: 6, borderStyle: 'dashed' }} />}
                                {baselineMaxVel && <div className="absolute rounded-sm border border-rose-300 dark:border-rose-700/50 bg-rose-100/30 dark:bg-rose-900/10 pointer-events-none" style={{ left: (baselineMaxVel.startOffsetDays + VISUAL_SHIFT_DAYS) * DAY_WIDTH, width: Math.max(baselineMaxVel.durationDays * DAY_WIDTH, 4), height: 4, top: 42, borderStyle: 'dashed' }} />}
                                {baseline && <div className="absolute rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 pointer-events-none" style={{ left: (baseline.startOffsetDays + VISUAL_SHIFT_DAYS) * DAY_WIDTH, width: Math.max(baseline.durationDays * DAY_WIDTH, 4), height: 14, top: 19, opacity: 0.5, borderStyle: 'dashed' }} />}
                                {!isDone && maxVel && <div className="absolute rounded-sm bg-rose-400/80 dark:bg-rose-500/80 pointer-events-none z-10" style={{ left: (maxVel.startOffsetDays + VISUAL_SHIFT_DAYS) * DAY_WIDTH, width: Math.max(maxVel.durationDays * DAY_WIDTH, 4), height: 4, top: 42 }} />}
                                {!isDone && realistic && <div className="absolute rounded-sm bg-emerald-400/80 dark:bg-emerald-500/80 pointer-events-none z-10" style={{ left: (realistic.startOffsetDays + VISUAL_SHIFT_DAYS) * DAY_WIDTH, width: Math.max(realistic.durationDays * DAY_WIDTH, 4), height: 4, top: 6 }} />}

                                {/* MAIN TASK BLOCKS (BROKEN DOWN) */}
                                {task.scheduleDistribution ? Object.entries(task.scheduleDistribution).map(([dateStr, hours]) => {
                                    const offset = Number(getDayOffset(dateStr));
                                    const dayCap = getDayCapacity(dateStr);
                                    
                                    // Calculate visual width based on intensity (usage vs capacity)
                                    // If dayCap is 0 (weekend), assume it's like a full day visually or small? 
                                    // Use 24 as fallback to prevent div/0, but realistically use max(1, dayCap)
                                    const capacityDenom = Math.max(1, dayCap);
                                    const intensityRatio = Math.min(1, Number(hours) / capacityDenom);
                                    
                                    // Scale the width of the block itself
                                    const blockWidth = Math.max(4, intensityRatio * (DAY_WIDTH - 4));

                                    return (
                                        <div
                                            key={dateStr}
                                            className={`absolute rounded shadow-sm border flex items-center justify-center z-20 group cursor-help transition-all duration-300 overflow-hidden ${getPhaseColor(task.phase)} ${isDone ? 'opacity-75 saturate-75' : ''}`}
                                            style={{
                                                left: (offset + VISUAL_SHIFT_DAYS) * DAY_WIDTH,
                                                width: blockWidth,
                                                height: 20,
                                                top: 16,
                                            }}
                                            onMouseEnter={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setActiveTooltip({
                                                    x: rect.left + (rect.width / 2),
                                                    y: rect.top,
                                                    task,
                                                    realistic,
                                                    dailyInfo: { date: dateStr, hours, capacity: dayCap }
                                                });
                                            }}
                                            onMouseLeave={() => setActiveTooltip(null)}
                                        >
                                             {/* Intensity visualizer overlay */}
                                             <div className="absolute inset-0 bg-white/20 pointer-events-none"></div>
                                             
                                             {isDone && <div className="absolute w-full h-[2px] bg-slate-900/50 dark:bg-white/50 z-30 pointer-events-none" />}
                                             
                                             {/* Text Label - Only show if wide enough */}
                                             {blockWidth > 18 && (
                                                <span className="text-[9px] font-bold text-white z-30 relative drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
                                                    {hours}h
                                                </span>
                                             )}
                                        </div>
                                    );
                                }) : (
                                    /* Fallback if no distribution (shouldn't happen) */
                                    <div className={`absolute rounded shadow-sm border flex items-center justify-center z-20 ${getPhaseColor(task.phase)}`} style={{ left: (task.startOffsetDays + VISUAL_SHIFT_DAYS) * DAY_WIDTH, width: Math.max(task.durationDays * DAY_WIDTH, 4), height: 20, top: 16 }}>
                                        fallback
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
      </div>

      {/* Tooltip */}
      {activeTooltip && typeof document !== 'undefined' && createPortal(
            <div className="fixed z-[9999] pointer-events-none print:hidden" style={{ left: activeTooltip.x, top: activeTooltip.y, transform: 'translate(-50%, -100%)', marginTop: '-8px' }}>
                <div className="bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl w-52 border border-slate-700">
                    <div className="font-bold mb-1 truncate">{activeTooltip.task.task_name}</div>
                    
                    {activeTooltip.dailyInfo && (
                        <div className="bg-slate-800 -mx-3 -mt-1 mb-2 px-3 py-1 border-b border-slate-700 flex justify-between items-center">
                             <span className="text-slate-400 font-mono">{activeTooltip.dailyInfo.date}</span>
                             <span className="font-bold text-emerald-400">{activeTooltip.dailyInfo.hours}h / {activeTooltip.dailyInfo.capacity}h</span>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div><span className="block text-slate-500">Total Duration</span>{activeTooltip.task.duration_hours}h</div>
                        <div><span className="block text-slate-500">Phase</span>{activeTooltip.task.phase}</div>
                        <div><span className="block text-slate-500">Start Date</span>{activeTooltip.task.startDate.toLocaleDateString()}</div>
                        <div><span className="block text-slate-500">End Date</span>{activeTooltip.task.endDate.toLocaleDateString()}</div>
                    </div>
                </div>
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900 mx-auto"></div>
            </div>,
            document.body
       )}
    </div>
  );
};