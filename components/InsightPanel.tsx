import React, { useState } from 'react';
import { AnalysisResult } from '../utils/insightEngine';
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Task } from '../types';

interface InsightPanelProps {
  analysis: AnalysisResult;
  tasks: Task[];
  smartGoal: string;
  onApplyOptimizations: (newTasks: Task[]) => void;
  forceExpanded?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const InsightPanel: React.FC<InsightPanelProps> = ({ 
    analysis, 
    tasks, 
    smartGoal, 
    onApplyOptimizations, 
    forceExpanded = false,
    onMoveUp,
    onMoveDown
}) => {
  const [aiOpinion, setAiOpinion] = useState<string | null>(null);
  const [suggestedTasks, setSuggestedTasks] = useState<Task[] | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Combine internal state with external override for PDF export
  const isExpanded = isOpen || forceExpanded;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High': return 'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/30 dark:bg-red-900/20';
      case 'Medium': return 'text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-900/30 dark:bg-amber-900/20';
      default: return 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900/30 dark:bg-emerald-900/20';
    }
  };

  const handleDeepAnalysis = async () => {
    // ... (keep existing handleDeepAnalysis logic)
    setLoadingAi(true);
    setAiOpinion(null);
    setSuggestedTasks(null);
    setShowPreview(false);

    try {
        let apiKey = process.env.API_KEY;

        // Try to ensure key exists
        // @ts-ignore
        if (typeof window !== 'undefined' && window.aistudio) {
             // @ts-ignore
             const hasKey = await window.aistudio.hasSelectedApiKey().catch(() => false);
             if (!hasKey) {
                // @ts-ignore
                await window.aistudio.openSelectKey();
                apiKey = process.env.API_KEY;
             }
        }

        if (!apiKey) {
             // Force open if still missing
             // @ts-ignore
             if (window.aistudio?.openSelectKey) await window.aistudio.openSelectKey();
             apiKey = process.env.API_KEY;
        }

        if (!apiKey) {
            setAiOpinion("Error: API Key missing. Please select a key via the AI Studio button to continue.");
            setLoadingAi(false);
            return;
        }

        const ai = new GoogleGenAI({ apiKey });
        
        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                opinion: { 
                    type: Type.STRING, 
                    description: "A single, hard-hitting paragraph of advice (max 60 words). Be brutal but effective." 
                },
                optimized_tasks: {
                    type: Type.ARRAY,
                    description: "A rewritten list of tasks that fixes the issues found.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            phase: { type: Type.STRING },
                            task_name: { type: Type.STRING },
                            duration_hours: { type: Type.NUMBER },
                            predecessors: { 
                                type: Type.ARRAY, 
                                items: { type: Type.STRING } 
                            },
                            isCompleted: { type: Type.BOOLEAN }
                        },
                        required: ["id", "phase", "task_name", "duration_hours", "predecessors", "isCompleted"]
                    }
                }
            },
            required: ["opinion", "optimized_tasks"]
        };

        const minifiedTasks = tasks.map(t => ({
            id: t.id,
            phase: t.phase,
            task_name: t.task_name,
            duration_hours: t.duration_hours,
            predecessors: t.predecessors,
            isCompleted: t.isCompleted
        }));

        const prompt = `You are a Lead Project Architect. Refactor this project plan to ensure success.
        
        GOAL: ${smartGoal}
        
        CURRENT STATS:
        - Total Est: ${analysis.totalHours}h
        - Risk: ${analysis.riskLevel}
        - Issues: ${analysis.scheduleRisks.join('; ')}

        INSTRUCTIONS:
        1. Provide a "opinion" string: Hard-hitting advice.
        2. Provide "optimized_tasks" array:
           - BREAK DOWN any task > 8 hours into smaller sub-tasks (e.g. "Dev Dashboard" -> "Dev Dashboard Layout", "Dev Dashboard Widgets").
           - INSERT explicit "QA/Verify" tasks after major development phases if missing.
           - ADJUST duration_hours to be more realistic (add buffer).
           - PRESERVE the IDs of existing tasks if you just modify them. GENERATE new unique string IDs for new sub-tasks.
           - PRESERVE isCompleted status for existing tasks.
           - ENSURE dependency chain (predecessors) is logical.

        CURRENT TASKS JSON:
        ${JSON.stringify(minifiedTasks)}
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: schema
            }
        });

        const jsonText = response.text;
        if (jsonText) {
            const result = JSON.parse(jsonText);
            setAiOpinion(result.opinion);
            if (result.optimized_tasks && Array.isArray(result.optimized_tasks)) {
                const hydratedTasks = result.optimized_tasks.map((optTask: any) => {
                    const original = tasks.find(t => t.id === optTask.id);
                    if (original) {
                        return { 
                            ...original,
                            ...optTask, 
                            isCompleted: original.isCompleted
                        };
                    }
                    return optTask;
                });
                setSuggestedTasks(hydratedTasks);
            }
        } else {
            setAiOpinion("AI returned empty response.");
        }

    } catch (e: any) {
        console.error(e);
        if (e.message?.includes("Requested entity was not found") || e.message?.includes("API Key")) {
             // @ts-ignore
             if (typeof window !== 'undefined' && window.aistudio?.openSelectKey) {
                 // @ts-ignore
                 await window.aistudio.openSelectKey();
             }
             setAiOpinion("API Key session issue. Please try again.");
        } else {
             setAiOpinion("Connection to AI Boss failed: " + (e.message || "Unknown error"));
        }
    } finally {
        setLoadingAi(false);
    }
  };

  const handleAcceptChanges = () => {
      if (suggestedTasks) {
          onApplyOptimizations(suggestedTasks);
          setSuggestedTasks(null);
          setShowPreview(false);
          setAiOpinion(prev => (prev ? prev + " (Optimizations Applied ✓)" : "Optimizations Applied ✓"));
      }
  };

  const handleDiscardChanges = () => {
      setSuggestedTasks(null);
      setShowPreview(false);
      setAiOpinion(prev => (prev ? prev + " (Optimizations Discarded)" : "Optimizations Discarded"));
  };

  return (
    <div className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg shadow-sm dark:shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-200">
      {/* Accordion Header */}
      <div 
        className={`px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isExpanded ? 'border-b border-slate-200 dark:border-slate-700' : ''}`}
      >
        <div 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer flex-grow"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M16.5 6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v7.5a3 3 0 0 0 3 3v-6A4.5 4.5 0 0 1 10.5 6h6Z" />
            <path d="M18 7.5a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3h-7.5a3 3 0 0 1-3-3v-7.5a3 3 0 0 1 3-3H18Z" />
          </svg>
          CRITICAL ANALYSIS
        </div>
        
        <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getRiskColor(analysis.riskLevel)}`}>
            Verdict: {analysis.verdict}
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

            <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 20 20" 
                    fill="currentColor" 
                    className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
            </div>
        </div>
      </div>

      {isExpanded && (
        // ... (keep existing content)
        <div className="p-6 space-y-5">
            {/* Metric Comparison */}
            <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Your Estimate</div>
                <div className="text-2xl font-mono text-slate-900 dark:text-white font-bold">{analysis.totalHours}h</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">~{analysis.estimatedWeeks.toFixed(1)} Weeks</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-indigo-600 text-[9px] px-2 py-0.5 text-white font-bold rounded-bl">REALITY</div>
                <div className="text-[10px] uppercase tracking-wider text-indigo-600 dark:text-indigo-300 font-bold mb-1">Adjusted (+{analysis.bufferUsed}%)</div>
                <div className="text-2xl font-mono text-slate-900 dark:text-white font-bold">{analysis.adjustedHours}h</div>
                <div className="text-xs text-indigo-600 dark:text-indigo-300">~{analysis.adjustedWeeks.toFixed(1)} Weeks</div>
            </div>
            </div>

            {/* Risk List */}
            {analysis.scheduleRisks.length > 0 && (
            <div>
                <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">Detected Risks</h4>
                <ul className="space-y-2">
                {analysis.scheduleRisks.map((risk, idx) => (
                    <li key={idx} className="flex gap-2 text-sm text-slate-700 dark:text-slate-300 bg-red-50 dark:bg-red-900/10 p-2 rounded border border-red-100 dark:border-red-900/20">
                    <span className="text-red-500 mt-0.5">⚠️</span>
                    {risk}
                    </li>
                ))}
                </ul>
            </div>
            )}

            {/* AI Action Area */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2 space-y-4">
                
                {/* 1. Main Action Button (Hidden if AI has already spoken) */}
                {!aiOpinion && (
                    <button 
                        onClick={handleDeepAnalysis}
                        disabled={loadingAi}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm"
                    >
                        {loadingAi ? (
                            <>
                                <span className="w-2 h-2 bg-white rounded-full animate-bounce"></span>
                                Boss is Thinking...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Z" opacity="0.5"/>
                                    <path d="M12 6a1 1 0 0 0-1 1v4H7a1 1 0 0 0 0 2h4v4a1 1 0 0 0 2 0v-4h4a1 1 0 0 0 0-2h-4V7a1 1 0 0 0-1-1Z"/>
                                </svg>
                                Run Gemini Deep Dive
                            </>
                        )}
                    </button>
                )}

                {/* 2. AI Opinion Output */}
                {aiOpinion && (
                    <div className="animate-fade-in bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-500/30 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                            <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">AI Boss Opinion</div>
                        </div>
                        <p className="text-sm text-indigo-900 dark:text-indigo-100 italic leading-relaxed">"{aiOpinion}"</p>
                    </div>
                )}

                {/* 3. Review & Apply (Replaces simple button) */}
                {suggestedTasks && !showPreview && (
                    <div className="animate-fade-in-up">
                        <button 
                            onClick={() => setShowPreview(true)}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-bold uppercase tracking-wider transition-all flex justify-center items-center gap-2 shadow-md hover:shadow-lg"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                            </svg>
                            Review Suggested Fixes ({suggestedTasks.length} Tasks)
                        </button>
                    </div>
                )}

                {/* 4. Preview Window */}
                {suggestedTasks && showPreview && (
                    <div className="animate-fade-in bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-lg overflow-hidden mt-4">
                        <div className="px-4 py-3 bg-emerald-100/50 dark:bg-emerald-900/30 text-xs font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider flex justify-between items-center">
                            <span>Proposed Plan ({suggestedTasks.length} Tasks)</span>
                            <span className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">Review carefully</span>
                        </div>
                        
                        <div className="max-h-64 overflow-y-auto p-3 space-y-2">
                            {suggestedTasks.map((t, i) => (
                                <div key={i} className="flex justify-between items-start gap-3 p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded shadow-sm">
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{t.task_name}</span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{t.phase}</span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">{t.duration_hours}h</span>
                                        {/* Show simple change indicator if we can, but since IDs might match, simple is better */}
                                        <span className="text-[9px] text-slate-300 dark:text-slate-600">ID:{t.id.substring(0,4)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-3 border-t border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/30 dark:bg-emerald-900/20 flex gap-3">
                             <button 
                                onClick={handleDiscardChanges}
                                className="flex-1 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded transition-colors"
                             >
                                 Discard
                             </button>
                             <button 
                                onClick={handleAcceptChanges}
                                className="flex-1 py-2 text-xs font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-sm transition-colors"
                             >
                                 Confirm & Apply
                             </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};