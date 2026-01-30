import React, { useState } from 'react';
import { ProcessedTask, Task } from '../types';

interface ProjectTableProps {
  tasks: ProcessedTask[];
  onTaskToggle?: (taskId: string) => void;
  onForceTask?: (taskId: string) => void;
  onRevertForceTask?: (taskId: string) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  isLocked?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const ProjectTable: React.FC<ProjectTableProps> = ({ 
    tasks, 
    onTaskToggle, 
    onForceTask, 
    onRevertForceTask, 
    onUpdateTask, 
    isLocked = false,
    onMoveUp,
    onMoveDown
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const totalHours = tasks.reduce((sum, t) => sum + t.duration_hours, 0);

  // Find the first pending task ID to enable the "Move to Today" button only for it
  const firstPendingId = tasks.find(t => !t.isCompleted)?.id;

  const getPhaseColor = (phase: string) => {
    // ... (keep existing logic)
    if (phase.includes('Design')) return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
    if (phase.includes('Frontend')) return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
    if (phase.includes('Backend') || phase.includes('Business')) return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800';
    // Swapped QA and User
    if (phase.includes('Verification') || phase.includes('QA')) return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800';
    if (phase.includes('Deployment')) return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
    if (phase.includes('User')) return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
    return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  };

  const formatDate = (date: Date) => {
    // ... (keep existing logic)
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      hour12: true
    });
  };

  const formatCompletionDate = (isoStr?: string) => {
      if (!isoStr) return null;
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-300">
      <div 
        className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${isOpen ? 'border-b border-slate-200 dark:border-slate-800' : ''}`}
      >
        <div 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-3 cursor-pointer flex-grow"
        >
            {/* Added a subtle list icon to replace the chevron on the left, for aesthetics */}
            <div className="text-slate-400 dark:text-slate-500">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M2.625 6.75a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0A.75.75 0 018.25 6h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75zM2.625 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zM7.5 12a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12A.75.75 0 017.5 12zm-4.875 5.25a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75z" clipRule="evenodd" />
               </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Detailed Workload Breakdown</h3>
        </div>
        
        <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:inline">
            {tasks.length} Tasks Defined
            </span>
            
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
                className={`text-slate-500 dark:text-slate-400 transition-transform duration-200 cursor-pointer ${isOpen ? 'rotate-180' : ''}`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
            </div>
        </div>
      </div>

      {isOpen && (
        <div className="overflow-x-auto">
            {/* Table Content */}
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            {/* ... (keep existing table structure) */}
            <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-12">
                    ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Task & Phase
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-32">
                    Action
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-1/4">
                    Workload
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Schedule
                </th>
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                {tasks.map((task) => {
                const percentage = Math.round((task.duration_hours / totalHours) * 100);
                
                // Calculate dependency lock for table view
                const isLockedDependency = !task.isCompleted && task.predecessors.some(pId => {
                    const p = tasks.find(t => t.id === pId);
                    return p && !p.isCompleted;
                });
                
                const isPending = !task.isCompleted;
                const isForced = !!task.forcedDate;
                const isNextTask = task.id === firstPendingId;

                return (
                    <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td 
                        onClick={() => !isLockedDependency && onTaskToggle && onTaskToggle(task.id)}
                        className={`px-6 py-4 whitespace-nowrap align-top`}
                        title={isLockedDependency ? "Complete predecessors first" : "Click to toggle completion"}
                    >
                         <div className={`
                            flex items-center justify-center w-6 h-6 rounded-md shadow-sm border text-[10px] font-bold transition-all duration-200 cursor-pointer
                            ${task.isCompleted 
                                ? 'bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-700 dark:border-emerald-400 hover:bg-emerald-700' 
                                : isLockedDependency
                                    ? 'bg-slate-100 text-slate-300 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700 cursor-not-allowed'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            }
                        `}>
                            {task.isCompleted ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <span className="font-mono">{task.id}</span>
                            )}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300 align-top">
                        <div className="font-bold text-slate-800 dark:text-slate-100 mb-1">{task.task_name}</div>
                        <span className={`px-2 py-0.5 inline-flex text-[10px] leading-4 font-semibold rounded-full border ${getPhaseColor(task.phase)}`}>
                        {task.phase}
                        </span>
                        <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                        Deps: {task.predecessors.length > 0 ? task.predecessors.join(', ') : 'None'}
                        </div>
                        {task.completionDate && task.isCompleted && (
                            <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                ✓ Done: {formatCompletionDate(task.completionDate)}
                            </div>
                        )}
                        {task.forcedDate && !task.isCompleted && (
                            <div className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-bold uppercase">
                                🔥 Forced: Today
                            </div>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-top">
                         {isPending && isForced && onRevertForceTask && (
                             <button
                                onClick={() => onRevertForceTask(task.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
                                title="Remove forced date constraint"
                             >
                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M2.5 10a7.5 7.5 0 1110.963 6.633.75.75 0 00-1.096-.92 6 6 0 10-8.73-4.526l.894.894a.75.75 0 001.06-1.06l-2.25-2.25a.75.75 0 00-1.06 0l-2.25 2.25a.75.75 0 001.06 1.06l.894-.894z" clipRule="evenodd" />
                                 </svg>
                                 Unforce
                             </button>
                         )}
                         {isPending && !isForced && isNextTask && onForceTask && (
                             <button
                                onClick={() => onForceTask(task.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 rounded text-xs font-bold uppercase tracking-wider hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors shadow-sm"
                                title="Force start this task today, ignoring capacity."
                             >
                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                                 </svg>
                                 Do Today
                             </button>
                         )}
                         {task.isCompleted && onForceTask && (
                             <button
                                onClick={() => onForceTask(task.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/30 rounded text-xs font-bold uppercase tracking-wider hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors shadow-sm"
                                title="Update completion date to now."
                             >
                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                                 </svg>
                                 Redo Today
                             </button>
                         )}
                    </td>
                    <td className="px-6 py-4 align-top">
                        <div className="w-full max-w-xs">
                            <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-1 group">
                                    <input 
                                        type="number" 
                                        min="0"
                                        max="24"
                                        step="1"
                                        className="w-14 bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 focus:border-indigo-500 focus:ring-0 text-sm font-bold text-slate-700 dark:text-slate-200 text-right outline-none transition-colors py-0 disabled:opacity-50"
                                        value={task.duration_hours}
                                        disabled={task.isCompleted || isLocked}
                                        onChange={(e) => {
                                            let val = parseFloat(e.target.value);
                                            // Handle empty input or invalid input gracefully
                                            if (isNaN(val)) return;
                                            
                                            // Clamp value to 0-24
                                            if (val > 24) val = 24;
                                            if (val < 0) val = 0;

                                            if (onUpdateTask) {
                                                onUpdateTask(task.id, { duration_hours: val });
                                            }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        title={task.isCompleted ? "Task completed" : isLocked ? "Unlock goal to edit duration" : "Edit estimated duration (max 24h)"}
                                    />
                                    <span className="text-xs text-slate-400 font-bold">h</span>
                                </div>
                                <span className="text-xs text-slate-500 dark:text-slate-400">{percentage}% of total</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                <div 
                                    className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300" 
                                    style={{ width: `${Math.max(percentage, 5)}%` }}
                                ></div>
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400 align-top">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="w-8 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-bold">Start</span>
                                <span className="font-mono">{formatDate(task.startDate)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-8 text-slate-400 dark:text-slate-500 uppercase text-[10px] font-bold">End</span>
                                <span className="font-mono">{formatDate(task.endDate)}</span>
                            </div>
                        </div>
                    </td>
                    </tr>
                );
                })}
            </tbody>
            </table>
        </div>
      )}
    </div>
  );
};