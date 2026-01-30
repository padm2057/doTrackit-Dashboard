import React, { useState, useEffect } from 'react';

interface CalendarWidgetProps {
  nonWorkingDays: string[];
  onToggleDay: (dateStr: string) => void;
  isReadOnly?: boolean;
  startDate?: Date;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ 
  nonWorkingDays, 
  onToggleDay, 
  isReadOnly = false,
  startDate,
  onMoveUp,
  onMoveDown
}) => {
  const [currentMonth, setCurrentMonth] = useState(startDate ? new Date(startDate) : new Date());
  const [isOpen, setIsOpen] = useState(true);

  // Sync with prop changes
  useEffect(() => {
      if (startDate) {
          setCurrentMonth(new Date(startDate));
      }
  }, [startDate]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => new Date(year, month, i + 1));
  };

  const days = getDaysInMonth(currentMonth);
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay(); // 0 = Sun
  
  // Format YYYY-MM-DD
  const toDateKey = (d: Date) => {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  const handlePrevMonth = (e: React.MouseEvent) => {
      e.stopPropagation();
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
      e.stopPropagation();
      setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 transition-all duration-200 h-auto flex flex-col w-full break-inside-avoid">
      {/* Header */}
      <div 
        className={`px-6 py-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isOpen ? 'border-b border-slate-200 dark:border-slate-800' : ''}`}
      >
        <div 
            onClick={() => setIsOpen(!isOpen)}
            className="flex-grow cursor-pointer"
        >
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            Working Calendar
            {isReadOnly && (
               <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">LOCKED</span>
            )}
          </h3>
          {!isOpen && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Manage non-working days.</p>}
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

      {/* Content */}
      {isOpen && (
        <div className="p-6 animate-fade-in">
            {/* Calendar Month Nav */}
            <div className="flex justify-between items-center mb-4">
                <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-500">
                        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                    </svg>
                </button>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 select-none">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-500">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="w-full">
                <div className="grid grid-cols-7 mb-2 text-center">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{d}</div>
                    ))}
                </div>
                <div className={`grid grid-cols-7 gap-1.5 ${isReadOnly ? 'opacity-60 pointer-events-none grayscale-[0.5]' : ''}`}>
                    {/* Empty slots for start of month */}
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-8" />
                    ))}
                    
                    {/* Days */}
                    {days.map(d => {
                        const dateKey = toDateKey(d);
                        const isBlocked = nonWorkingDays.includes(dateKey);
                        const isToday = toDateKey(new Date()) === dateKey;
                        // Check if this date is the project start date
                        const isStartDate = startDate && toDateKey(startDate) === dateKey;
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                        return (
                            <div 
                                key={dateKey}
                                onClick={() => !isReadOnly && onToggleDay(dateKey)}
                                className={`
                                    relative flex items-center justify-center rounded-md transition-all duration-200
                                    aspect-square h-8 sm:h-auto text-xs font-medium group border
                                    ${isBlocked 
                                        ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800 text-rose-400 decoration-rose-400' 
                                        : isStartDate
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-100 dark:ring-indigo-900'
                                            : isToday
                                                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700'
                                                : isWeekend
                                                    ? 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
                                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-sm'
                                    }
                                    ${isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'}
                                `}
                                title={isReadOnly ? "Locked" : (isBlocked ? "Set as Working Day" : isStartDate ? "Project Start Date" : "Set as Non-Working Day")}
                            >
                                {d.getDate()}
                                {isBlocked && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="w-2/3 h-px bg-rose-400 rotate-45"></div>
                                    </div>
                                )}
                                {isStartDate && !isBlocked && (
                                    <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full"></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className="mt-4 text-[10px] text-center text-slate-400">
                {isReadOnly ? "Unlock Goal to edit calendar." : "Click a date to toggle working status."}
            </div>
        </div>
      )}
    </div>
  );
};