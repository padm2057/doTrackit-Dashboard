import React, { useState } from 'react';
import { ProcessedTask } from '../types';

interface ProjectTableProps {
  tasks: ProcessedTask[];
  onTaskToggle?: (taskId: string) => void;
}

export const ProjectTable: React.FC<ProjectTableProps> = ({ tasks, onTaskToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const totalHours = tasks.reduce((sum, t) => sum + t.duration_hours, 0);

  const getPhaseColor = (phase: string) => {
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
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer outline-none ${isOpen ? 'border-b border-slate-200 dark:border-slate-800' : ''}`}
      >
        <div className="flex items-center gap-3">
            {/* Added a subtle list icon to replace the chevron on the left, for aesthetics */}
            <div className="text-slate-400 dark:text-slate-500">
               <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M2.625 6.75a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0A.75.75 0 018.25 6h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75zM2.625 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zM7.5 12a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12A.75.75 0 017.5 12zm-4.875 5.25a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875 0a.75.75 0 01.75-.75h12a.75.75 0 010 1.5h-12a.75.75 0 01-.75-.75z" clipRule="evenodd" />
               </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Detailed Workload Breakdown</h3>
        </div>
        
        <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {tasks.length} Tasks Defined
            </span>
            <div className={`text-slate-500 dark:text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
            </div>
        </div>
      </button>

      {isOpen && (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-12">
                    ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Task & Phase
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
                const isLocked = !task.isCompleted && task.predecessors.some(pId => {
                    const p = tasks.find(t => t.id === pId);
                    return p && !p.isCompleted;
                });

                return (
                    <tr key={task.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td 
                        onClick={() => !isLocked && onTaskToggle && onTaskToggle(task.id)}
                        className={`px-6 py-4 whitespace-nowrap align-top`}
                        title={isLocked ? "Complete predecessors first" : "Click to toggle completion"}
                    >
                         <div className={`
                            flex items-center justify-center w-6 h-6 rounded-full border text-[10px] font-bold transition-all duration-200 cursor-pointer
                            ${task.isCompleted 
                                ? 'bg-black dark:bg-slate-200 text-white dark:text-slate-900 border-black dark:border-slate-200 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' 
                                : isLocked
                                    ? 'bg-slate-100 text-slate-300 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700 cursor-not-allowed'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-300 dark:border-slate-600 hover:border-indigo-500 hover:text-indigo-600'
                            }
                        `}>
                            {task.isCompleted ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                task.id
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
                    </td>
                    <td className="px-6 py-4 align-top">
                        <div className="w-full max-w-xs">
                            <div className="flex justify-between items-baseline mb-1">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{task.duration_hours}h</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">{percentage}% of total</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                <div 
                                    className="bg-indigo-500 h-2.5 rounded-full" 
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