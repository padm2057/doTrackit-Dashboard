import React, { useState } from 'react';
import { ProjectPlan } from '../types';
import { AnalysisResult } from '../utils/insightEngine';

interface GoalCardProps {
  projectData: ProjectPlan;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectPlan>>;
  isLocked: boolean;
  analysis: AnalysisResult;
  calculatedTotalHours: number;
  projectStartDate: Date;
  finishDate: Date;
  totalDurationDays: number;
  realisticFinishDate: Date;
  realisticDurationDays: number;
  formatShortDate: (date: Date) => string;
  getInputValue: (date: Date) => string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({
  projectData,
  setProjectData,
  isLocked,
  analysis,
  calculatedTotalHours,
  projectStartDate,
  finishDate,
  totalDurationDays,
  realisticFinishDate,
  realisticDurationDays,
  formatShortDate,
  getInputValue,
  onMoveUp,
  onMoveDown
}) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 print:border-none print:shadow-none transition-all duration-300 ${isLocked ? 'ring-2 ring-rose-500/20' : ''}`}>
        {/* Accordion Header */}
        <div 
            className={`px-6 py-4 flex justify-between items-start hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isOpen ? 'border-b border-slate-200 dark:border-slate-800' : ''}`}
        >
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="flex flex-col gap-1 cursor-pointer flex-grow"
            >
                    <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Current Smart Goal</h2>
                    {isLocked && (
                        <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase tracking-wider">
                            Execution Mode
                        </span>
                    )}
                    </div>
                    {!isOpen && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 font-medium">{projectData.smart_goal}</p>
                    )}
            </div>
            
            <div className="flex items-center gap-2">
                {/* Reorder Controls */}
                {(onMoveUp || onMoveDown) && (
                    <div className="flex flex-col gap-0.5 mr-2 opacity-50 hover:opacity-100 transition-opacity">
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
            <div className="p-6 flex flex-col gap-6 animate-fade-in">
                {/* Top: Text */}
                <div className="w-full border-b pb-6 border-slate-100 dark:border-slate-800 flex-1">
                    <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 leading-tight goal-text">
                    {projectData.smart_goal}
                    </p>
                </div>
                
                {/* Bottom: Stats Panel */}
                <div className="w-full bg-slate-50 dark:bg-slate-800/50 px-6 py-5 rounded-xl border border-slate-100 dark:border-slate-800 print:bg-transparent print:border print:border-slate-300 print:px-6">
                    <div className="flex flex-col sm:flex-row items-start gap-8">
                        
                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4 w-full">
                            {/* Effort */}
                            <div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Effort</div>
                                <div className="text-xl font-mono font-bold text-slate-900 dark:text-slate-100">{calculatedTotalHours}h</div>
                                <div className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 mt-0.5">Real: {analysis.adjustedHours}h</div>
                            </div>
                            
                            {/* Start Date - Interactive */}
                            <div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                    Start Date
                                </div>
                                <div className="relative group">
                                    {/* Formatted Display Date */}
                                    <div className={`text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight border-b border-dashed border-slate-300 dark:border-slate-700 ${!isLocked ? 'group-hover:border-indigo-500' : ''}`}>
                                        {formatShortDate(projectStartDate)}
                                    </div>

                                    {/* Hidden Input Overlay */}
                                    <input 
                                        type="date"
                                        disabled={isLocked}
                                        value={getInputValue(projectStartDate)}
                                        onChange={(e) => setProjectData(prev => ({...prev, project_start_date: e.target.value}))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                                    />

                                    {/* Edit Icon (Visual Hint) */}
                                    {!isLocked && (
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-400">
                                                <path d="M5.25 2.25a.75.75 0 00-1.5 0v1.5h-1.5a3 3 0 00-3 3v9a3 3 0 003 3h13.5a3 3 0 003-3v-9a3 3 0 00-3-3h-1.5v-1.5a.75.75 0 00-1.5 0v1.5h-6v-1.5z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Planned Finish */}
                            <div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-0.5">Planned Finish</div>
                                <div className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{formatShortDate(finishDate)}</div>
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">{totalDurationDays} days</div>
                            </div>

                            {/* Realistic Finish */}
                            <div>
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mb-0.5">Realistic Finish</div>
                                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 leading-tight">{formatShortDate(realisticFinishDate)}</div>
                                <div className="text-[10px] font-bold text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">{realisticDurationDays} days</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </section>
  );
};