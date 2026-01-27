import React, { useState } from 'react';
import { AnalysisResult } from '../utils/insightEngine';
import { GoogleGenAI } from "@google/genai";

interface InsightPanelProps {
  analysis: AnalysisResult;
  forceExpanded?: boolean;
}

export const InsightPanel: React.FC<InsightPanelProps> = ({ analysis, forceExpanded = false }) => {
  const [aiOpinion, setAiOpinion] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

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
    setLoadingAi(true);
    try {
        // Handle API Key Selection
        // @ts-ignore
        if (typeof window !== 'undefined' && window.aistudio) {
             // @ts-ignore
             const hasKey = await window.aistudio.hasSelectedApiKey();
             if (!hasKey) {
                // @ts-ignore
                await window.aistudio.openSelectKey();
             }
        }

        let apiKey = process.env.API_KEY;
        if (!apiKey) {
             // @ts-ignore
             if (typeof window !== 'undefined' && window.aistudio && window.aistudio.openSelectKey) {
                  // @ts-ignore
                  await window.aistudio.openSelectKey();
                  apiKey = process.env.API_KEY;
             }
        }

        if (!apiKey) {
            throw new Error("API Key not found in environment.");
        }

        const ai = new GoogleGenAI({ apiKey });
        const prompt = `Act as a brutal but fair Senior Project Manager. Analyze this project status:
        
        Estimate: ${analysis.totalHours} hours (~${analysis.estimatedWeeks.toFixed(1)} wks)
        Realistic: ${analysis.adjustedHours} hours (~${analysis.adjustedWeeks.toFixed(1)} wks)
        Risk Level: ${analysis.riskLevel}
        Known Issues: ${analysis.scheduleRisks.join('; ')}
        Buffer Presence: ${analysis.hasBuffer ? 'Yes' : 'No'}

        Provide a single, hard-hitting paragraph of advice (max 60 words). Don't be polite, be effective.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt
        });

        setAiOpinion(response.text || "No insights available.");
    } catch (e: any) {
        console.error(e);
        if (e.message && e.message.includes("Requested entity was not found")) {
             // @ts-ignore
             if (typeof window !== 'undefined' && window.aistudio && window.aistudio.openSelectKey) {
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

  return (
    <div className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-lg shadow-sm dark:shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-200">
      {/* Accordion Header */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isExpanded ? 'border-b border-slate-200 dark:border-slate-700' : ''}`}
      >
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold">
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

      {isExpanded && (
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

            {/* AI Action */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                {!aiOpinion && (
                    <button 
                        onClick={handleDeepAnalysis}
                        disabled={loadingAi}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 flex justify-center items-center gap-2 shadow-sm"
                    >
                        {loadingAi ? (
                            <>
                                <span className="w-2 h-2 bg-white rounded-full animate-bounce"></span>
                                Analyzing...
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

                {aiOpinion && (
                    <div className="animate-fade-in bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-500/30 p-3 rounded-lg">
                        <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">AI Boss Opinion</div>
                        <p className="text-sm text-indigo-900 dark:text-indigo-100 italic">"{aiOpinion}"</p>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};
