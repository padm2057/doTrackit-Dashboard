import React, { useRef, useEffect, useState, useMemo } from 'react';
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
  onChunkClick?: (taskId: string, targetHours: number) => void;
  isExecutionMode?: boolean;
  calendarNotes?: CalendarNote[];
  taskNotes?: TaskNote[];
  onDateClick?: (date: Date) => void;
  onTaskClick?: (task: ProcessedTask) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
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
  onChunkClick,
  isExecutionMode = false,
  calendarNotes = [],
  taskNotes = [],
  onDateClick,
  onTaskClick,
  onMoveUp,
  onMoveDown
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // Default to Closed
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  
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

  // Auto-expand for PDF Export
  useEffect(() => {
      if (isPdfExport) {
          setIsOpen(true);
      }
  }, [isPdfExport]);
  
  // Metrics
  const DAY_WIDTH = isPdfExport ? 25 : (isMobile ? 40 : 60);
  const HEADER_HEIGHT = 54;
  
  // Dynamic Row Metrics - Adjusted to prevent overlap between text and buttons
  const BASE_ROW_HEIGHT = 76; // Decreased from 88 for tighter packing
  const SUB_ROW_HEIGHT = 28;  // Decreased from 36 to reduce space between chunks
  const CONTENT_START_Y = 48; // Kept at 48 to ensure text header has enough room
  
  // Column Widths
  const NAME_COL_WIDTH = isPdfExport ? 140 : (isMobile ? 50 : 220); 
  const NOTES_COL_WIDTH = isPdfExport ? 30 : (isMobile ? 35 : 80); 
  const SIDEBAR_WIDTH = NAME_COL_WIDTH + NOTES_COL_WIDTH;
  
  const VISUAL_SHIFT_DAYS = 1;

  // --- PRE-CALCULATE LAYOUT (Variable Heights) ---
  const taskLayout = useMemo(() => {
    const layout = new Map<string, { y: number, height: number, chunks: [string, number][] }>();
    let currentY = 0;

    tasks.forEach(task => {
        const dist: Record<string, number> = task.scheduleDistribution || {};
        // Sort chunks by date to ensure visual waterfall flow
        const sortedChunks = Object.entries(dist).sort((a, b) => a[0].localeCompare(b[0]));
        
        // At least 1 slot even if no chunks
        const chunkCount = Math.max(1, sortedChunks.length);
        
        // Calculate dynamic height: Base + extra rows for subsequent chunks
        const height = BASE_ROW_HEIGHT + ((chunkCount - 1) * SUB_ROW_HEIGHT);

        layout.set(task.id, {
            y: currentY,
            height,
            chunks: sortedChunks
        });
        currentY += height;
    });

    return { map: layout, totalHeight: currentY };
  }, [tasks]);
  
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
  
  const toDateKey = (d: Date) => {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

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
    <div className={`gantt-container bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col print:break-inside-avoid ${isExecutionMode ? 'ring-2 ring-rose-500/20' : ''}`}>
      
      {/* Accordion Header */}
      <div 
        className={`px-6 py-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isOpen ? 'border-b border-slate-200 dark:border-slate-800' : ''}`}
      >
        <div 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-3 cursor-pointer flex-grow"
        >
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-1.5 rounded text-indigo-600 dark:text-indigo-400">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
               </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">Timeline & Dependencies</h3>
            {isExecutionMode && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase tracking-wider animate-pulse">
                    Execution Mode
                </span>
            )}
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

      {isOpen && (
        <div className="animate-fade-in">
            {/* Legend Bar */}
            <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                <div className="flex items-center gap-4 border-r border-slate-200 dark:border-slate-700 pr-4 mr-2">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                            <span className="w-8 h-2 border-2 border-slate-400 border-dashed rounded-sm bg-slate-100 opacity-60"></span> Ghost Base
                        </div>
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

            <div className="gantt-scroll-area overflow-x-auto" ref={containerRef}>
                <div className="flex relative" style={{ width: totalWidth, height: taskLayout.totalHeight + HEADER_HEIGHT + 20 }}>
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
                            const layout = taskLayout.map.get(task.id)!;
                            const words = task.task_name.split(' ');
                            const shortName = words.slice(0, 3).join(' ') + (words.length > 3 ? '...' : '');
                            const hasUnfinishedPredecessors = task.predecessors.some(predId => {
                                const pred = tasks.find(t => t.id === predId);
                                return pred && !pred.isCompleted;
                            });
                            const isDependencyLocked = !task.isCompleted && hasUnfinishedPredecessors;
                            const hasNotes = taskNotes.some(n => n.taskId === task.id);
                            const isHovered = hoveredTask === task.id;

                            return (
                                <div 
                                    key={task.id} 
                                    style={{ height: layout.height }} 
                                    className={`relative border-b border-slate-100 dark:border-slate-800 flex items-start text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors ${isHovered ? 'bg-indigo-50 dark:bg-indigo-900/10' : 'bg-white dark:bg-slate-900'}`}
                                    onMouseEnter={() => setHoveredTask(task.id)}
                                    onMouseLeave={() => setHoveredTask(null)}
                                >
                                    {/* Task Name & Completion Toggle */}
                                    <div style={{ width: NAME_COL_WIDTH }} className="absolute top-0 left-0 pt-3 px-3 z-20 flex items-start gap-3">
                                        
                                        {/* Interactive Toggle Button */}
                                        <div 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isDependencyLocked && onTaskToggle) onTaskToggle(task.id);
                                            }}
                                            className={`
                                                flex items-center justify-center w-5 h-5 rounded-md shadow-sm border text-[9px] font-bold transition-all duration-200 flex-shrink-0 cursor-pointer mt-0.5 select-none
                                                ${task.isCompleted 
                                                    ? 'bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-700 dark:border-emerald-400 hover:bg-emerald-700' 
                                                    : isDependencyLocked
                                                        ? 'bg-slate-100 text-slate-300 border-slate-200 dark:bg-slate-800/50 dark:text-slate-600 dark:border-slate-700 cursor-not-allowed opacity-60' 
                                                        : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}
                                            `}
                                            title={isDependencyLocked ? "Locked by dependency" : "Toggle Completion"}
                                        >
                                            {task.isCompleted ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                </svg>
                                            ) : (
                                                <span className="font-mono">{task.id}</span>
                                            )}
                                        </div>

                                        {/* Text Info */}
                                        {!isMobile && (
                                            <div className="flex flex-col min-w-0">
                                                <span 
                                                    className={`truncate text-xs font-semibold leading-tight transition-all cursor-pointer ${task.isCompleted ? 'text-slate-400 line-through' : (isDependencyLocked ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200 hover:text-indigo-600')}`}
                                                    title={task.task_name}
                                                    onClick={() => onTaskClick && onTaskClick(task)}
                                                >
                                                    {shortName}
                                                </span>
                                                <span className={`truncate text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5`}>
                                                    {task.phase}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Notes Column - Spans full height */}
                                    <div style={{ width: NOTES_COL_WIDTH }} className="absolute top-0 right-0 h-full flex items-start justify-center pt-2 border-l border-slate-100 dark:border-slate-700 z-20">
                                        <button 
                                            onClick={() => onTaskClick && onTaskClick(task)}
                                            className={`p-1.5 rounded-lg transition-all relative group/note ${hasNotes ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10'}`}
                                            title={hasNotes ? "View notes" : "Add note"}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                                <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z" clipRule="evenodd" />
                                                <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
                                            </svg>
                                            {hasNotes && (
                                                <span className="absolute top-0.5 right-0.5 flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500 border border-white dark:border-slate-900"></span>
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
                                        className={`flex-shrink-0 flex flex-col items-center justify-center text-[10px] border-r border-slate-100 dark:border-slate-800 leading-tight cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors relative group
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
                                // Subtle dashed lines for grid
                                return <div key={i} style={{ width: DAY_WIDTH }} className={`flex-shrink-0 border-r border-dashed border-slate-100 dark:border-slate-800/30 h-full ${isZeroWorkWeekend ? 'bg-slate-100 dark:bg-slate-950/50' : isWeekend ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''}`} />;
                            })}
                        </div>

                        {/* Row Backgrounds (For Highlighting) */}
                        <div className="absolute top-0 left-0 w-full z-0 pointer-events-none" style={{ marginTop: HEADER_HEIGHT }}>
                           {tasks.map(task => (
                               <div 
                                 key={task.id} 
                                 style={{ height: taskLayout.map.get(task.id)!.height }} 
                                 className={`w-full border-b border-slate-100/50 dark:border-slate-800/50 transition-colors ${hoveredTask === task.id ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
                               />
                           ))}
                        </div>

                        {/* Today Line */}
                        {showNowLine && (
                            <div className="absolute bottom-0 border-l-2 border-dashed border-amber-500 z-50 pointer-events-none" style={{ left: Math.max(nowOffsetDays * DAY_WIDTH, 0), top: HEADER_HEIGHT }}>
                                <div className="absolute -top-3 text-[9px] font-bold text-white bg-amber-600 dark:bg-amber-500 px-2 py-1 rounded shadow-md whitespace-nowrap ring-2 ring-white dark:ring-slate-900 z-50 transition-transform duration-300" style={{ left: 0, transform: nowOffsetDays * DAY_WIDTH < 25 ? 'none' : 'translateX(-50%)' }}>Today</div>
                            </div>
                        )}

                        {/* Dependency Lines - Visible ONLY on Hover */}
                        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0" style={{ marginTop: HEADER_HEIGHT }}>
                            <defs>
                                <marker id="arrowhead-highlight" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                                    <polygon points="0 0, 6 2, 0 4" fill={isDarkMode ? "#818cf8" : "#6366f1"} />
                                </marker>
                            </defs>
                            {tasks.map(task => 
                                task.predecessors.map(predId => {
                                    const pred = tasks.find(p => p.id === predId);
                                    if (!pred) return null;
                                    
                                    const tLayout = taskLayout.map.get(task.id);
                                    const pLayout = taskLayout.map.get(pred.id);
                                    
                                    if (!tLayout || !pLayout) return null;

                                    // Only show dependency line if connected to the hovered task
                                    const isHighlight = hoveredTask === task.id || hoveredTask === pred.id;
                                    if (!isHighlight) return null;

                                    const pOffset = Number(pred.startOffsetDays);
                                    const pDuration = Number(pred.durationDays);
                                    
                                    const tOffset = Number(task.startOffsetDays);

                                    const startX = (pOffset + pDuration + VISUAL_SHIFT_DAYS) * DAY_WIDTH;
                                    
                                    // FIX: Calculate startY based on the LAST chunk of the predecessor to match waterfall layout
                                    const lastChunkIndex = Math.max(0, pLayout.chunks.length - 1);
                                    const startY = pLayout.y + CONTENT_START_Y + (lastChunkIndex * SUB_ROW_HEIGHT) + 11; 
                                    
                                    const endX = (tOffset + VISUAL_SHIFT_DAYS) * DAY_WIDTH;
                                    // Successor always connects at the top/first chunk
                                    const endY = tLayout.y + CONTENT_START_Y + 11;
                                    
                                    const gap = endX - startX;
                                    const midX = startX + (gap > 20 ? 15 : gap/2);
                                    
                                    // Always styled as highlighted since we only show on hover
                                    const color = isDarkMode ? "#818cf8" : "#6366f1";
                                    const width = 2;
                                    const marker = "url(#arrowhead-highlight)";

                                    // Simple 3-segment path: Horizontal -> Vertical -> Horizontal
                                    return <path 
                                        key={`${pred.id}-${task.id}`} 
                                        d={`M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`} 
                                        fill="none" 
                                        stroke={color} 
                                        strokeWidth={width} 
                                        markerEnd={marker} 
                                        className="transition-all duration-300"
                                    />;
                                })
                            )}
                        </svg>

                        {/* Task Bars (Ghost + Broken Main) */}
                        <div className="absolute top-0 left-0 w-full z-10" style={{ marginTop: HEADER_HEIGHT }}>
                            {tasks.map((task) => {
                                const layout = taskLayout.map.get(task.id)!;
                                const realistic = realisticTasks?.find(t => t.id === task.id);
                                const maxVel = maxVelocityTasks?.find(t => t.id === task.id);
                                const baseline = baselineTasks?.find(t => t.id === task.id);
                                const baselineRealistic = baselineRealisticTasks?.find(t => t.id === task.id);
                                const baselineMaxVel = baselineMaxVelocityTasks?.find(t => t.id === task.id);
                                const isDone = task.isCompleted;
                                const isHovered = hoveredTask === task.id;
                                
                                const hasUnfinishedPredecessors = task.predecessors.some(predId => {
                                    const pred = tasks.find(t => t.id === predId);
                                    return pred && !pred.isCompleted;
                                });
                                const isDependencyLocked = !task.isCompleted && hasUnfinishedPredecessors;
                                
                                // Track accumulated visual progress for styling bar chunks
                                const hoursDone = task.hoursCompleted || 0;
                                let accumulatedHours = 0;

                                return (
                                    <div key={task.id} style={{ height: layout.height, width: '100%', position: 'relative' }} onMouseEnter={() => setHoveredTask(task.id)} onMouseLeave={() => setHoveredTask(null)}>
                                        
                                        {/* Mobile Name Label (Shown ON chart if mobile sidebar is collapsed) */}
                                        {isMobile && (
                                            <div 
                                                className="absolute z-40 text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap overflow-visible pointer-events-none"
                                                style={{ left: (task.startOffsetDays + VISUAL_SHIFT_DAYS) * DAY_WIDTH, top: CONTENT_START_Y - 14 }}
                                            >
                                                {task.task_name}
                                            </div>
                                        )}

                                        {/* SCENARIO: Realistic (Top sub-row edge) */}
                                        {baselineRealistic && <div className="absolute rounded-sm border border-emerald-300 dark:border-emerald-700/50 bg-emerald-100/30 dark:bg-emerald-900/10 pointer-events-none" style={{ left: (baselineRealistic.startOffsetDays + VISUAL_SHIFT_DAYS) * DAY_WIDTH, width: Math.max(baselineRealistic.durationDays * DAY_WIDTH, 4), height: 4, top: 4, borderStyle: 'dashed' }} />}
                                        {!isDone && realistic && <div className="absolute rounded-sm bg-emerald-400/80 dark:bg-emerald-500/80 pointer-events-none z-10" style={{ left: (realistic.startOffsetDays + VISUAL_SHIFT_DAYS) * DAY_WIDTH, width: Math.max(realistic.durationDays * DAY_WIDTH, 4), height: 6, top: 4 }} />}

                                        {/* SCENARIO: Baseline Shadow (Upper Middle sub-row) */}
                                        {baseline && <div className="absolute rounded-sm bg-slate-300 dark:bg-slate-600 border border-slate-400 dark:border-slate-500 pointer-events-none" style={{ left: (baseline.startOffsetDays + VISUAL_SHIFT_DAYS) * DAY_WIDTH, width: Math.max(baseline.durationDays * DAY_WIDTH, 4), height: 14, top: 10, opacity: 0.8, borderStyle: 'dashed' }} />}

                                        {/* MAIN TASK CHUNKS (Waterfall Sub-Rows) */}
                                        {layout.chunks.length > 0 ? layout.chunks.map(([dateStr, hours], index) => {
                                            const offset = Number(getDayOffset(dateStr));
                                            const dayCap = getDayCapacity(dateStr);
                                            
                                            const capacityDenom = Math.max(1, dayCap);
                                            const intensityRatio = Math.min(1, Number(hours) / capacityDenom);
                                            
                                            const blockWidth = Math.max(4, intensityRatio * (DAY_WIDTH - 4));
                                            const chunkTop = CONTENT_START_Y + (index * SUB_ROW_HEIGHT);
                                            
                                            const chunkEndHours = accumulatedHours + hours;
                                            const isChunkDone = hoursDone >= chunkEndHours;
                                            const isPartiallyDone = !isChunkDone && hoursDone > accumulatedHours;
                                            
                                            // Store current accum for the click handler closure
                                            const targetHoursIfClicked = chunkEndHours; 
                                            const prevAccum = accumulatedHours;
                                            accumulatedHours += hours;

                                            return (
                                                <div
                                                    key={dateStr}
                                                    className={`absolute rounded-md shadow-sm border flex items-center pl-1 z-20 group cursor-pointer transition-all duration-300 overflow-hidden ${getPhaseColor(task.phase)} ${isChunkDone ? 'opacity-50 saturate-0 border-dashed' : ''} ${isDone ? 'opacity-75 saturate-75' : ''} ${isHovered ? 'ring-2 ring-indigo-400 dark:ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 z-30' : ''}`}
                                                    style={{
                                                        left: (offset + VISUAL_SHIFT_DAYS) * DAY_WIDTH,
                                                        width: Math.max(blockWidth, 32), // Min width for clickability
                                                        height: 22,
                                                        top: chunkTop, // Waterfall stacking
                                                    }}
                                                    onClick={() => !isDependencyLocked && onChunkClick && onChunkClick(task.id, isChunkDone ? prevAccum : targetHoursIfClicked)}
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
                                                    <div className="absolute inset-0 bg-white/20 pointer-events-none"></div>
                                                    
                                                    {/* Interactive Button Logic MOVED HERE from Sidebar */}
                                                    <div className={`
                                                        flex items-center justify-center w-4 h-4 rounded shadow-sm border text-[8px] font-bold transition-all duration-200 flex-shrink-0 z-30 relative mr-1
                                                        ${isChunkDone 
                                                            ? 'bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-700 dark:border-emerald-400 hover:bg-emerald-700 dark:hover:bg-emerald-600' 
                                                            : isPartiallyDone
                                                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700'
                                                                : isDependencyLocked 
                                                                    ? 'bg-slate-100 text-slate-300 border-slate-200 dark:bg-slate-800/50 dark:text-slate-600 dark:border-slate-700 cursor-not-allowed opacity-70' 
                                                                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}
                                                    `}>
                                                         {isChunkDone ? (
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                                </svg>
                                                            ) : (
                                                                <span className="font-mono">{index + 1}</span>
                                                            )}
                                                    </div>

                                                    {/* Hours Text */}
                                                    {blockWidth > 24 && (
                                                        <span className="text-[9px] font-bold text-white z-30 relative drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] truncate">
                                                            {hours}h
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        }) : (
                                            /* Fallback */
                                            <div className={`absolute rounded-md shadow-sm border flex items-center justify-center z-20 ${getPhaseColor(task.phase)}`} style={{ left: (task.startOffsetDays + VISUAL_SHIFT_DAYS) * DAY_WIDTH, width: Math.max(task.durationDays * DAY_WIDTH, 4), height: 22, top: CONTENT_START_Y }}>
                                            </div>
                                        )}

                                        {/* SCENARIO: Max Velocity (Bottom of expanded row) */}
                                        {baselineMaxVel && <div className="absolute rounded-sm border border-rose-300 dark:border-rose-700/50 bg-rose-100/30 dark:bg-rose-900/10 pointer-events-none" style={{ left: (baselineMaxVel.startOffsetDays + VISUAL_SHIFT_DAYS) * DAY_WIDTH, width: Math.max(baselineMaxVel.durationDays * DAY_WIDTH, 4), height: 4, top: layout.height - 6, borderStyle: 'dashed' }} />}
                                        {!isDone && maxVel && <div className="absolute rounded-sm bg-rose-500/90 pointer-events-none z-10" style={{ left: (maxVel.startOffsetDays + VISUAL_SHIFT_DAYS) * DAY_WIDTH, width: Math.max(maxVel.durationDays * DAY_WIDTH, 4), height: 6, top: layout.height - 7 }} />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

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
                        <div><span className="block text-slate-500">Progress</span>{activeTooltip.task.hoursCompleted || 0}h / {activeTooltip.task.duration_hours}h</div>
                    </div>
                </div>
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900 mx-auto"></div>
            </div>,
            document.body
       )}
    </div>
  );
};