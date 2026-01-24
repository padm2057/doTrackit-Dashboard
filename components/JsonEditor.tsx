import React, { useState, useEffect } from 'react';
import { ProjectPlan } from '../types';

interface JsonEditorProps {
  initialData: ProjectPlan;
  onUpdate: (data: ProjectPlan) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const JsonEditor: React.FC<JsonEditorProps> = ({ initialData, onUpdate, isOpen, setIsOpen }) => {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJsonText(JSON.stringify(initialData, null, 2));
  }, [initialData]);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText);
      // Basic validation
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        throw new Error("Invalid JSON: Missing 'tasks' array.");
      }
      onUpdate(parsed);
      setError(null);
      setIsOpen(false);
    } catch (err: any) {
      setError(err.message || "Invalid JSON format");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-[95vw] max-w-7xl flex flex-col h-[90vh] border border-slate-200 dark:border-slate-800">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Edit Project JSON</h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 p-6 overflow-hidden bg-slate-50 dark:bg-slate-950">
          <textarea
            className="w-full h-full p-4 font-mono text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center rounded-b-xl">
          <div className="text-red-600 text-sm font-medium">{error}</div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                setJsonText(JSON.stringify(initialData, null, 2));
                setError(null);
              }}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Reset
            </button>
            <button 
              onClick={handleApply}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
            >
              Update Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};