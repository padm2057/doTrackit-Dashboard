import React, { useState, useEffect, useRef } from 'react';
import { TaskNote, ProcessedTask } from '../types';

interface TaskNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: ProcessedTask | null;
  existingNotes: TaskNote[];
  onSave: (note: string) => void;
}

export const TaskNoteModal: React.FC<TaskNoteModalProps> = ({ 
  isOpen, 
  onClose, 
  task, 
  existingNotes, 
  onSave 
}) => {
  const [noteContent, setNoteContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNoteContent('');
      // Focus textarea after a brief delay to allow render
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const handleSubmit = () => {
    if (noteContent.trim()) {
      onSave(noteContent);
      setNoteContent('');
    }
  };

  // Sort notes by timestamp descending (newest first)
  const sortedNotes = [...existingNotes].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const getPhaseColor = (phase: string) => {
    if (phase.includes('Design')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    if (phase.includes('Frontend')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    if (phase.includes('Backend') || phase.includes('Business')) return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
    if (phase.includes('Verification') || phase.includes('QA')) return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
    if (phase.includes('Deployment')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start bg-slate-50 dark:bg-slate-950 rounded-t-xl">
          <div className="pr-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 line-clamp-1" title={task.task_name}>{task.task_name}</h2>
            <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getPhaseColor(task.phase)}`}>
                    {task.phase}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">ID: {task.id}</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Input Area */}
          <div className="space-y-3">
             <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Add Task Note</label>
             <textarea
                ref={textareaRef}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Log details about this specific task..."
                className="w-full min-h-[100px] p-3 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-y text-slate-800 dark:text-slate-200"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleSubmit();
                    }
                }}
             />
             <div className="flex justify-end">
                 <button
                    onClick={handleSubmit}
                    disabled={!noteContent.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                    Save Note
                 </button>
             </div>
          </div>

          {/* History List */}
          {sortedNotes.length > 0 && (
              <div className="space-y-3">
                  <div className="flex items-center gap-2">
                     <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Note History</span>
                     <div className="h-px bg-slate-200 dark:bg-slate-700 flex-1"></div>
                  </div>
                  
                  <div className="space-y-3">
                      {sortedNotes.map((note) => (
                          <div key={note.id} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 group relative">
                              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{note.content}</p>
                              <div className="mt-2 text-[10px] text-slate-400 flex justify-between items-center">
                                  <span>{new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}, {new Date(note.timestamp).toLocaleDateString()}</span>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};
