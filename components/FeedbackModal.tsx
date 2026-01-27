import React from 'react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'error' | 'info' | 'success';
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, title, message, type = 'info' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 overflow-hidden transform transition-all scale-100">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-full flex-shrink-0 ${
                type === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
                type === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' :
                'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
            }`}>
               {type === 'error' && (
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                   </svg>
               )}
               {(type === 'info' || type === 'success') && (
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                   </svg>
               )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-950 px-6 py-3 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded hover:opacity-90 transition-opacity"
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  );
};