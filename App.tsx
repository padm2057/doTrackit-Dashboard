import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ProjectPlan, DailyLog, Task, CalendarNote, ProcessedTask, TaskNote } from './types';
import { DEFAULT_PROJECT_PLAN } from './constants';
import { ProjectTable } from './components/ProjectTable';
import { ProjectChart } from './components/ProjectChart';
import { WorkloadChart } from './components/WorkloadChart';
import { CapacitySimulatorChart } from './components/CapacitySimulatorChart';
import { GanttChart } from './components/GanttChart';
import { JsonEditor } from './components/JsonEditor';
import { InsightPanel } from './components/InsightPanel'; 
import { ChatBot } from './components/ChatBot';
import { LiveAudioBot } from './components/LiveAudioBot';
import { CloudSyncModal } from './components/CloudSyncModal';
import { DateNoteModal } from './components/DateNoteModal';
import { TaskNoteModal } from './components/TaskNoteModal';
import { FeedbackModal } from './components/FeedbackModal';
import { calculateProjectSchedule, calculateDailyWorkload } from './utils/scheduler';
import { analyzeProjectPlan } from './utils/insightEngine'; 
import { getSupabase, hasSupabaseConfig } from './utils/supabaseClient';
import { ImageGenerator } from './components/ImageGenerator'; // Assumed component

// CONFIGURATION: The hour (0-23) that marks the start of a new "Business Day".
// Actions before this hour count towards the previous calendar day.
const BUSINESS_DAY_CUTOFF_HOUR = 2; 

const App: React.FC = () => {
  // --- PERSISTENCE HELPER ---
  const loadState = <T,>(key: string, defaultVal: T): T => {
    if (typeof window === 'undefined') return defaultVal;
    try {
        const saved = localStorage.getItem(key);
        if (saved !== null) return JSON.parse(saved);
    } catch (e) {
        console.error(`Failed to load ${key}`, e);
    }
    return defaultVal;
  };

  // --- STATE INITIALIZATION WITH PERSISTENCE ---
  const [projectData, setProjectData] = useState<ProjectPlan>(() => loadState('dt_project_data', DEFAULT_PROJECT_PLAN));
  
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  
  // Note Modal State (Calendar)
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedNoteDate, setSelectedNoteDate] = useState<Date | null>(null);

  // Note Modal State (Task)
  const [isTaskNoteModalOpen, setIsTaskNoteModalOpen] = useState(false);
  const [selectedTaskForNote, setSelectedTaskForNote] = useState<ProcessedTask | null>(null);

  // Feedback Modal State
  const [feedback, setFeedback] = useState<{isOpen: boolean, title: string, message: string, type: 'error' | 'info' | 'success'}>({
      isOpen: false,
      title: '',
      message: '',
      type: 'info'
  });

  const [weekdayHours, setWeekdayHours] = useState<number>(() => loadState('dt_config_weekday', 6));
  const [weekendHours, setWeekendHours] = useState<number>(() => loadState('dt_config_weekend', 2));
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('dt_theme_dark');
        if (saved !== null) return JSON.parse(saved);
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [bufferPercent, setBufferPercent] = useState<number>(() => loadState('dt_config_buffer', 30));
  
  // LOCK STATE
  const [isLocked, setIsLocked] = useState(() => loadState('dt_state_locked', false));
  
  // LIVE TIMER
  const [now, setNow] = useState(new Date());

  // MOBILE PREVIEW STATE
  const [isMobilePreview, setIsMobilePreview] = useState(false);

  // Refs to prevent duplicate auto-saves within the same minute
  const lastSystemSaveDate = useRef<string>('');
  
  // Ref to track if we just received a remote update (to prevent echo-save)
  const isRemoteUpdate = useRef(false);
  const isFirstRender = useRef(true);
  
  // --- PERSISTENCE EFFECTS (Local Storage) ---
  useEffect(() => {
    localStorage.setItem('dt_project_data', JSON.stringify(projectData));
  }, [projectData]);

  useEffect(() => {
    localStorage.setItem('dt_config_weekday', JSON.stringify(weekdayHours));
  }, [weekdayHours]);

  useEffect(() => {
    localStorage.setItem('dt_config_weekend', JSON.stringify(weekendHours));
  }, [weekendHours]);

  useEffect(() => {
    localStorage.setItem('dt_config_buffer', JSON.stringify(bufferPercent));
  }, [bufferPercent]);

  useEffect(() => {
    localStorage.setItem('dt_state_locked', JSON.stringify(isLocked));
  }, [isLocked]);

  useEffect(() => {
    localStorage.setItem('dt_theme_dark', JSON.stringify(isDarkMode));
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // --- CLOUD SYNC & REALTIME ---

  // 1. Auto-Load Latest Project on Start
  useEffect(() => {
    const initCloud = async () => {
        const client = getSupabase();
        if (client) {
            try {
                 const { data, error } = await client
                    .from('projects')
                    .select('data')
                    .order('updated_at', { ascending: false })
                    .limit(1)
                    .single();
                 
                 if (data && data.data) {
                     console.log("Loaded latest project from cloud.");
                     // Mark as remote so we don't immediately save back
                     isRemoteUpdate.current = true;
                     setProjectData(data.data as ProjectPlan);
                 }
            } catch (e) {
                // Silent fail on auto-load
            }
        }
    };
    initCloud();
  }, []);

  // 2. Realtime Subscription (Cross-Device Sync)
  useEffect(() => {
    const client = getSupabase();
    if (!client || !projectData.id) return;

    console.log("Subscribing to realtime updates for:", projectData.id);
    const channel = client
      .channel(`project-sync-${projectData.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${projectData.id}`,
        },
        (payload) => {
          if (payload.new && payload.new.data) {
             const newData = payload.new.data as ProjectPlan;
             // Compare IDs or simple hash to check equality if needed
             // For now, simply trust the latest push from server
             console.log("Received realtime update.");
             isRemoteUpdate.current = true;
             setProjectData(newData);
          }
        }
      )
      .subscribe();

    return () => {
        client.removeChannel(channel);
    };
  }, [projectData.id]);

  // 3. Debounced Cloud Auto-Save
  useEffect(() => {
    if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
    }

    // If this change came from the cloud, don't echo it back
    if (isRemoteUpdate.current) {
        isRemoteUpdate.current = false;
        return;
    }

    const handler = setTimeout(async () => {
        const client = getSupabase();
        if (client && projectData.id) {
            try {
                const { error } = await client.from('projects').upsert({
                    id: projectData.id,
                    name: projectData.smart_goal.substring(0, 50),
                    data: projectData,
                    updated_at: new Date().toISOString()
                });
                if (!error) {
                    console.log("Auto-saved to cloud.");
                }
            } catch (e) {
                console.error("Auto-save failed", e);
            }
        }
    }, 3000); // 3-second debounce

    return () => clearTimeout(handler);
  }, [projectData]);


  // Helper for input value (YYYY-MM-DD)
  const getInputValue = (date: Date) => {
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  // --- GENERALIZED BUSINESS DAY LOGIC ---
  const getBusinessDate = (date: Date): Date => {
      const d = new Date(date);
      // If the time is between 00:00 and CUTOFF, we roll back to the previous calendar day.
      if (d.getHours() < BUSINESS_DAY_CUTOFF_HOUR) {
          d.setDate(d.getDate() - 1);
      }
      return d;
  };

  // --- NIGHTLY SYSTEM STATUS SAVE ---
  const autoSaveSystemStatus = async (currentData: ProjectPlan) => {
      const client = getSupabase();
      if (!client) return;

      try {
          const payload = {
              project_id: currentData.id,
              data: currentData,
              created_at: new Date().toISOString()
          };

          const { error } = await client.from('system_status').insert(payload);
          if (error) {
              console.error("System Status Auto-save failed:", error);
          } else {
              console.log("System Status snapshot saved to Supabase (Chronological Storage).");
          }
      } catch (e) {
          console.error("System Status Auto-save exception:", e);
      }
  };

  // --- AUTOMATED LOGIC (Using Generalized Business Date) ---
  useEffect(() => {
    const checkAndSnapshotDailyLog = () => {
        const currentTime = new Date();
        
        // 1. NIGHTLY SYSTEM STATUS CHECK (At 12:00 AM sharp)
        if (currentTime.getHours() === 0 && currentTime.getMinutes() === 0) {
            const dateStr = currentTime.toDateString();
            if (lastSystemSaveDate.current !== dateStr) {
                // Only save if locked and config exists
                if (isLocked && hasSupabaseConfig()) {
                    autoSaveSystemStatus(projectData);
                    lastSystemSaveDate.current = dateStr;
                }
            }
        }

        // 2. DAILY PERFORMANCE LOGIC
        const currentBusinessDate = getBusinessDate(currentTime);
        const reportingDate = new Date(currentBusinessDate);
        reportingDate.setDate(reportingDate.getDate() - 1); 
        
        const reportingDateStr = getInputValue(reportingDate);
        const existingLogs = projectData.daily_logs || [];
        const hasLog = existingLogs.some(log => log.date === reportingDateStr);

        if (!hasLog) {
            const cutoffTime = new Date(reportingDate);
            cutoffTime.setDate(cutoffTime.getDate() + 1);
            cutoffTime.setHours(BUSINESS_DAY_CUTOFF_HOUR, 0, 0, 0);

            const completedTasks = projectData.tasks.filter(t => {
                if (!t.isCompleted || !t.completionDate) return false;
                const tDate = new Date(t.completionDate);
                return tDate <= cutoffTime;
            });

            const count = completedTasks.length;
            const focusHours = completedTasks.reduce((acc, t) => acc + t.duration_hours, 0);
            
            // Momentum Score Formula: MIN(100, (Tasks*10 + FocusTimeMins/5))
            const momentum = Math.min(100, (count * 10) + ((focusHours * 60) / 5));

            const newLog: DailyLog = {
                date: reportingDateStr,
                completed_count: count,
                total_focus_hours: focusHours,
                momentum_score: Math.round(momentum),
                timestamp: new Date().toISOString()
            };

            setProjectData(prev => ({
                ...prev,
                daily_logs: [...(prev.daily_logs || []), newLog]
            }));
        }
    };

    // Run check immediately on mount, then every minute
    checkAndSnapshotDailyLog();
    const timer = setInterval(() => {
        setNow(new Date()); 
        checkAndSnapshotDailyLog();
    }, 60000);
    
    return () => clearInterval(timer);
  }, [projectData, projectData.daily_logs, projectData.tasks, isLocked]);

  // Helper to parse the stored string or default to today
  const getProjectDate = () => {
      if (projectData.project_start_date) {
          const [y, m, d] = projectData.project_start_date.split('-').map(Number);
          return new Date(y, m - 1, d);
      }
      return new Date();
  };

  const projectStartDate = useMemo(() => getProjectDate(), [projectData.project_start_date]);
  
  // State to trigger condensed views for PDF
  const [isPdfExport, setIsPdfExport] = useState(false);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Date formatting helpers
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatShortDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  // SCHEDULE CALCULATIONS
  const baselineTasksSource = useMemo(() => {
    return projectData.tasks.map(t => ({...t, isCompleted: false}));
  }, [projectData.tasks]);

  const baselineTasks = useMemo(() => {
    return calculateProjectSchedule(baselineTasksSource, weekdayHours, weekendHours, projectStartDate, undefined);
  }, [baselineTasksSource, weekdayHours, weekendHours, projectStartDate]);

  const baselineRealisticTasks = useMemo(() => {
    const realisticTasksSource = baselineTasksSource.map(t => ({
        ...t,
        duration_hours: t.duration_hours * (1 + (bufferPercent / 100))
    }));
    return calculateProjectSchedule(realisticTasksSource, weekdayHours, weekendHours, projectStartDate, undefined);
  }, [baselineTasksSource, weekdayHours, weekendHours, bufferPercent, projectStartDate]);

  const baselineMaxVelocityTasks = useMemo(() => {
    return calculateProjectSchedule(baselineTasksSource, 10, 5, projectStartDate, undefined);
  }, [baselineTasksSource, projectStartDate]);

  const processedTasks = useMemo(() => {
    return calculateProjectSchedule(projectData.tasks, weekdayHours, weekendHours, projectStartDate, now);
  }, [projectData.tasks, weekdayHours, weekendHours, projectStartDate, now]);

  const processedRealisticTasks = useMemo(() => {
    const realisticTasksSource = projectData.tasks.map(t => ({
        ...t,
        duration_hours: t.duration_hours * (1 + (bufferPercent / 100))
    }));
    const live = calculateProjectSchedule(realisticTasksSource, weekdayHours, weekendHours, projectStartDate, now);
    return live.map(t => {
        if (t.isCompleted) {
            const shadow = baselineRealisticTasks.find(b => b.id === t.id);
            if (shadow) {
                return {
                    ...t,
                    startDate: shadow.startDate,
                    endDate: shadow.endDate,
                    startOffsetDays: shadow.startOffsetDays,
                    durationDays: shadow.durationDays
                };
            }
        }
        return t;
    });
  }, [projectData.tasks, weekdayHours, weekendHours, bufferPercent, projectStartDate, now, baselineRealisticTasks]);

  const processedMaxVelocityTasks = useMemo(() => {
    const live = calculateProjectSchedule(projectData.tasks, 10, 5, projectStartDate, now);
    return live.map(t => {
        if (t.isCompleted) {
            const shadow = baselineMaxVelocityTasks.find(b => b.id === t.id);
            if (shadow) {
                return {
                    ...t,
                    startDate: shadow.startDate,
                    endDate: shadow.endDate,
                    startOffsetDays: shadow.startOffsetDays,
                    durationDays: shadow.durationDays
                };
            }
        }
        return t;
    });
  }, [projectData.tasks, projectStartDate, now, baselineMaxVelocityTasks]);


  const handleTaskToggle = (taskId: string) => {
    setProjectData(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => {
            if (t.id === taskId) {
                const newStatus = !t.isCompleted;
                let completionDateStr: string | undefined = undefined;

                if (newStatus) {
                    const visualTask = processedTasks.find(pt => pt.id === taskId);
                    
                    if (visualTask) {
                        // Use business date for 'Now' to handle late night sessions correctly
                        const now = new Date();
                        const businessNow = getBusinessDate(now); 

                        const taskStart = new Date(visualTask.startDate);
                        
                        // Compare dates (YYYY-MM-DD) without time component
                        const todayZero = new Date(businessNow.getFullYear(), businessNow.getMonth(), businessNow.getDate());
                        const taskZero = new Date(taskStart.getFullYear(), taskStart.getMonth(), taskStart.getDate());

                        if (taskZero > todayZero) {
                             // Future task: Snap to Today (executed early)
                             completionDateStr = now.toISOString(); 
                        } else {
                             // Past/Present task: Freeze at scheduled start (historical accuracy)
                             completionDateStr = visualTask.startDate.toISOString();
                        }
                    } else {
                        // Fallback
                        completionDateStr = new Date().toISOString();
                    }
                }
                return { 
                    ...t, 
                    isCompleted: newStatus,
                    completionDate: completionDateStr,
                    forcedDate: undefined // Clear forced date if marked completed
                };
            }
            return t;
        })
    }));
  };

  const handleForceTaskToToday = (taskId: string) => {
      setProjectData(prev => ({
          ...prev,
          tasks: prev.tasks.map(t => {
              if (t.id === taskId) {
                  const updates: Partial<Task> = {
                      forcedDate: getInputValue(new Date()) // Set to YYYY-MM-DD
                  };
                  // If task is completed, ensure its completion anchor also moves to today
                  if (t.isCompleted) {
                      updates.completionDate = new Date().toISOString();
                  }
                  return { ...t, ...updates };
              }
              return t;
          })
      }));
  };
  
  const handleRevertForcedTask = (taskId: string) => {
      setProjectData(prev => ({
          ...prev,
          tasks: prev.tasks.map(t => {
              if (t.id === taskId) {
                  return { ...t, forcedDate: undefined };
              }
              return t;
          })
      }));
  };

  // --- CALENDAR NOTES HANDLERS ---
  const handleDateClick = (date: Date) => {
      setSelectedNoteDate(date);
      setIsNoteModalOpen(true);
  };

  const handleSaveNote = (content: string) => {
      if (!selectedNoteDate) return;

      const dateKey = getInputValue(selectedNoteDate);
      const newNote: CalendarNote = {
          id: crypto.randomUUID(),
          date: dateKey,
          content: content,
          timestamp: new Date().toISOString()
      };

      setProjectData(prev => ({
          ...prev,
          calendar_notes: [...(prev.calendar_notes || []), newNote]
      }));
  };
  
  // Filter notes for the currently selected date in modal
  const currentModalNotes = useMemo(() => {
      if (!selectedNoteDate || !projectData.calendar_notes) return [];
      const dateKey = getInputValue(selectedNoteDate);
      return projectData.calendar_notes.filter(n => n.date === dateKey);
  }, [selectedNoteDate, projectData.calendar_notes]);

  // --- TASK NOTES HANDLERS ---
  const handleTaskClick = (task: ProcessedTask) => {
      setSelectedTaskForNote(task);
      setIsTaskNoteModalOpen(true);
  };

  const handleSaveTaskNote = (content: string) => {
      if (!selectedTaskForNote) return;

      const newNote: TaskNote = {
          id: crypto.randomUUID(),
          taskId: selectedTaskForNote.id,
          content: content,
          timestamp: new Date().toISOString()
      };

      setProjectData(prev => ({
          ...prev,
          task_notes: [...(prev.task_notes || []), newNote]
      }));
  };

  const currentTaskNotes = useMemo(() => {
      if (!selectedTaskForNote || !projectData.task_notes) return [];
      return projectData.task_notes.filter(n => n.taskId === selectedTaskForNote.id);
  }, [selectedTaskForNote, projectData.task_notes]);


  const dailyWorkload = useMemo(() => {
    return calculateDailyWorkload(processedTasks, weekdayHours, weekendHours);
  }, [processedTasks, weekdayHours, weekendHours]);

  const analysis = useMemo(() => {
    return analyzeProjectPlan(projectData.tasks, weekdayHours, weekendHours, bufferPercent);
  }, [projectData.tasks, weekdayHours, weekendHours, bufferPercent]);

  const calculatedTotalHours = projectData.tasks.reduce((acc, t) => acc + t.duration_hours, 0);
  
  const finishDate = processedTasks.length > 0 
    ? processedTasks.reduce((max, t) => t.endDate > max ? t.endDate : max, new Date(0)) 
    : new Date();

  const totalDurationDays = Math.ceil((finishDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24));

  const realisticFinishDate = processedRealisticTasks.length > 0 
    ? processedRealisticTasks.reduce((max, t) => t.endDate > max ? t.endDate : max, new Date(0)) 
    : new Date();
    
  const realisticDurationDays = Math.ceil((realisticFinishDate.getTime() - projectStartDate.getTime()) / (1000 * 60 * 60 * 24));

  // --- Export Handlers ---

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(projectData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dotrackit-plan-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportMenuOpen(false);
  };

  const handleExportCSV = () => {
    const headers = ["ID", "Phase", "Task Name", "Duration (Hours)", "Start Date", "End Date", "Predecessors", "Completed", "Completion Date"];
    const rows = processedTasks.map(t => [
      t.id,
      `"${t.phase.replace(/"/g, '""')}"`,
      `"${t.task_name.replace(/"/g, '""')}"`,
      t.duration_hours,
      t.startDate.toLocaleDateString(),
      t.endDate.toLocaleDateString(),
      `"${t.predecessors.join(',')}"`,
      t.isCompleted ? "Yes" : "No",
      t.completionDate ? new Date(t.completionDate).toLocaleDateString() : ""
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dotrackit-schedule-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportMenuOpen(false);
  };

  const handleExportPDF = () => {
    setIsExportMenuOpen(false);
    
    // @ts-ignore
    if (!window.html2pdf) {
        alert('PDF generator is loading. Please try again in a moment.');
        return;
    }

    // 1. Capture current theme state
    const wasDarkMode = isDarkMode;
    
    // 2. Force Light Mode for clean printing
    if (wasDarkMode) {
        setIsDarkMode(false);
    }
    
    // 3. Enable PDF View Mode
    setIsPdfExport(true);
    const element = document.querySelector('main');
    if (!element) return;
    element.classList.add('pdf-export-mode');

    // 4. Wait for DOM & Re-renders (800ms to be safe for Recharts animation clearing)
    setTimeout(() => {
        const opt = {
            margin: [5, 5, 5, 5], 
            filename: `dotrackit-report-${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                windowWidth: 800, // Matches our strict CSS width
                width: 800,
                x: 0 // Force start from origin
            },
            jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        };
        
        // @ts-ignore
        window.html2pdf().set(opt).from(element).save().then(() => {
            // Cleanup
            element.classList.remove('pdf-export-mode');
            setIsPdfExport(false);
            if (wasDarkMode) setIsDarkMode(true); // Restore theme
        }).catch((err: any) => {
            console.error("PDF Export failed", err);
            element.classList.remove('pdf-export-mode');
            setIsPdfExport(false);
            if (wasDarkMode) setIsDarkMode(true); // Restore theme
            alert("Failed to generate PDF. Please try the Print option.");
        });
    }, 800); 
  };

  const handlePrint = () => {
    setIsExportMenuOpen(false);
    setTimeout(() => {
        window.print();
    }, 100);
  };

  return (
    <div className="min-h-screen pb-12 print:pb-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Navigation / Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-40 print:hidden dark:bg-slate-900 dark:border-b dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-500 p-1.5 rounded text-white">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight truncate max-w-[150px] sm:max-w-none">doTrackit <span className="text-indigo-400 font-light hidden sm:inline">Dashboard</span></h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
             {/* Cloud Sync Button */}
             <button 
                onClick={() => setIsCloudModalOpen(true)}
                className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                title="Save/Load from Cloud"
             >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M5.5 17a4.5 4.5 0 01-1.44-8.765 4.5 4.5 0 018.302-3.046 3.5 3.5 0 014.504 4.272A4 4 0 0115 17H5.5zm3.75-2.75a.75.75 0 001.5 0V9.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0l-3.25 3.5a.75.75 0 101.1 1.02l1.95-2.1v4.59z" clipRule="evenodd" />
                </svg>
                <span className="hidden md:inline">Cloud Sync</span>
             </button>

             {/* API Key Button - Prominently Displayed */}
             <button 
                onClick={async () => {
                    // Check for key manager in window
                    // @ts-ignore
                    if (typeof window !== 'undefined' && window.aistudio && window.aistudio.openSelectKey) {
                        // @ts-ignore
                        await window.aistudio.openSelectKey();
                    } else {
                        // Logic for when Manager is missing
                        if (process.env.API_KEY) {
                            setFeedback({
                                isOpen: true,
                                title: "API Key Active",
                                message: "Your API Key is currently managed via environment variables. The dynamic key selector is only available in the AI Studio development environment.",
                                type: 'success'
                            });
                        } else {
                            setFeedback({
                                isOpen: true,
                                title: "Key Manager Not Detected",
                                message: "This feature requires the app to be run in a supported environment (like Google AI Studio/Project IDX) to manage keys securely. In production, please configure the API_KEY environment variable.",
                                type: 'error'
                            });
                        }
                    }
                }}
                className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded text-sm font-bold bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors"
                title="Manage Gemini API Key"
             >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M15.75 1.5a6.75 6.75 0 00-6.651 7.906c.067.39-.032.717-.221.906l-6.5 6.499a3 3 0 00-.878 2.121v2.818c0 .414.336.75.75.75h2.818a3 3 0 002.122-.878l6.499-6.5c.189-.189.517-.288.906-.22a6.75 6.75 0 101.155-12.451zM15.75 3a4.5 4.5 0 110 9 4.5 4.5 0 010-9zm-6.562 10.962l-4.638 4.638c-.375.375-.588.884-.588 1.415v1.485h1.485c.531 0 1.04-.213 1.415-.588l4.638-4.638a9.016 9.016 0 00-2.312-2.312z" clipRule="evenodd" />
                </svg>
                <span className="hidden md:inline">API Key</span>
             </button>

             {/* Mobile Preview Toggle - Enhanced Visibility */}
             <button
                onClick={() => setIsMobilePreview(!isMobilePreview)}
                className={`flex items-center gap-2 px-2 md:px-3 py-1.5 rounded text-sm font-bold transition-colors border ${isMobilePreview ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border-slate-700'}`}
                title={isMobilePreview ? "Exit Mobile Preview" : "Mobile Preview"}
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
                <span className="hidden md:inline">Mobile</span>
            </button>

             {/* Theme Toggle */}
             <button 
                onClick={toggleTheme}
                className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors mr-1"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
                {isDarkMode ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                    </svg>
                )}
            </button>

             {/* Lock Goal Button */}
             <button 
                onClick={() => setIsLocked(!isLocked)}
                className={`flex items-center gap-2 px-2 md:px-3 py-1.5 rounded text-sm font-bold transition-all border ${
                    isLocked 
                    ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-600 shadow-[0_0_12px_rgba(225,29,72,0.4)]' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title={isLocked ? "Unlock Goal to Edit Parameters" : "Lock Goal parameters for execution"}
            >
                {isLocked ? (
                   <>
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                    </svg>
                     <span className="hidden md:inline">Unlock</span>
                   </>
                ) : (
                    <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                    </svg>
                    <span className="hidden md:inline">Lock Goal</span>
                    </>
                )}
            </button>

            {/* Primary Report Button (Download) */}
            <button 
                onClick={handleExportPDF}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-2 md:px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm ring-1 ring-inset ring-indigo-500"
                title="Download One-Page Report"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a1.875 1.875 0 01-1.875-1.875V5.25A3.75 3.75 0 009 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75 2.25a.75.75 0 000 1.5H12a.75.75 0 000-1.5H8.25z" clipRule="evenodd" />
                  <path d="M12.971 1.816A5.23 5.23 0 0114.25 5.25v1.875c0 .207.168.375.375.375H16.5a5.23 5.23 0 013.434 1.279 9.768 9.768 0 00-6.963-6.963z" />
                </svg>
                <span className="hidden md:inline">Generate Report</span>
            </button>

            <div className="relative">
                <button 
                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                    className="text-sm font-medium bg-slate-800 hover:bg-slate-700 px-2 md:px-3 py-1.5 rounded border border-slate-700 transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="hidden md:inline">Export</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-3 h-3 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                </button>
                
                {isExportMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsExportMenuOpen(false)}></div>
                        <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-20 overflow-hidden">
                            <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700">
                                Download Options
                            </div>
                            <button onClick={handleExportJSON} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors">
                                <span className="font-mono text-[10px] font-bold text-slate-500 border border-slate-200 bg-slate-100 rounded px-1 min-w-[36px] text-center">JSON</span> 
                                <span>Source Data</span>
                            </button>
                            <button onClick={handleExportCSV} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors">
                                <span className="font-mono text-[10px] font-bold text-slate-500 border border-slate-200 bg-slate-100 rounded px-1 min-w-[36px] text-center">CSV</span> 
                                <span>Table View</span>
                            </button>
                            <button onClick={handleExportPDF} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors">
                                <span className="font-mono text-[10px] font-bold text-slate-500 border border-slate-200 bg-slate-100 rounded px-1 min-w-[36px] text-center">PDF</span> 
                                <span>One-Page Report</span>
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                            <button onClick={handlePrint} className="w-full text-left px-4 py-2.5 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 flex items-center gap-2 font-medium transition-colors">
                                 Print Page
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Edit Data Button - Hidden if Locked */}
            {!isLocked && (
                <button 
                    onClick={() => setIsEditorOpen(true)}
                    className="text-sm font-medium bg-slate-800 hover:bg-slate-700 px-2 md:px-3 py-1.5 rounded border border-slate-700 transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 md:hidden">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    <span className="hidden md:inline">Edit Data</span>
                </button>
            )}
          </div>
        </div>
      </header>

      <main className={`mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print:py-4 transition-all duration-300 ${isMobilePreview ? 'max-w-[390px] border-x border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-950 min-h-screen' : 'max-w-7xl'}`}>
        
        {/* PDF Header - Only visible during export */}
        <div className="pdf-header">
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Execution Plan Report</h1>
                <p className="text-slate-500 text-sm font-medium mt-1">Generated by doTrackit Intelligence</p>
            </div>
            <div className="text-right">
                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Date</div>
                <div className="text-xl font-mono font-bold text-indigo-600">
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
            </div>
        </div>

        {/* 
            Summary Grid for PDF Export
            In normal view: Block layout
            In PDF view: Side-by-Side Grid layout
        */}
        <div className="pdf-summary-grid flex flex-col gap-8">
            
            {/* Goal Card (Left in PDF) */}
            <section className={`bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-6 print:border-none print:shadow-none print:p-0 h-full relative overflow-hidden ${isLocked ? 'ring-2 ring-rose-500/20' : ''}`}>
            
            {isLocked && (
                <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl shadow-sm uppercase tracking-wider z-10">
                    Execution Mode
                </div>
            )}

            {/* Top: Text */}
            <div className="w-full border-b pb-6 border-slate-100 dark:border-slate-800 flex-1">
                <h2 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-3">Current Smart Goal</h2>
                <p className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 leading-tight goal-text">
                {projectData.smart_goal}
                </p>
            </div>
            
            {/* Bottom: Stats Panel */}
            <div className="w-full bg-slate-50 dark:bg-slate-800/50 px-6 py-5 rounded-xl border border-slate-100 dark:border-slate-800 print:bg-transparent print:border print:border-slate-300 print:px-6">
                <div className={`flex flex-col ${!isMobilePreview ? 'sm:flex-row' : ''} items-start gap-8`}>
                    
                    {/* Metrics Grid */}
                    <div className={`grid grid-cols-2 ${!isMobilePreview ? 'sm:grid-cols-4' : ''} gap-x-8 gap-y-4 w-full`}>
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
                            {/* Empty spacer to align with other columns description text if needed, but not requested */}
                             <div className="text-[10px] font-bold text-transparent mt-0.5">Spacer</div>
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
            </section>
            
            {/* Insight Panel (Right in PDF) */}
            <div className="h-full">
                <InsightPanel analysis={analysis} forceExpanded={isPdfExport} />
            </div>
        </div>
        
        {/* Workload Table (Hidden in PDF) */}
        <div className="space-y-8 pdf-hide">
            <ProjectTable 
                tasks={processedTasks} 
                onTaskToggle={handleTaskToggle} 
                onForceTask={handleForceTaskToToday}
                onRevertForceTask={handleRevertForcedTask}
            />
        </div>

        {/* Page Break (Hidden in PDF, visible in Print) */}
        <div className="pdf-page-break hidden print:block"></div>
        
        {/* Visualizer Image Generator */}
        <ImageGenerator initialPrompt={projectData.smart_goal} />

        <div className={`pdf-charts-grid grid grid-cols-1 ${!isMobilePreview ? 'lg:grid-cols-3' : ''} gap-6 print:block print:space-y-8`}>
            <div className="break-inside-avoid">
                <CapacitySimulatorChart 
                    tasks={projectData.tasks} 
                    currentWeekday={weekdayHours} 
                    currentWeekend={weekendHours} 
                    isDarkMode={isDarkMode}
                    bufferPercent={bufferPercent}
                    onBufferChange={setBufferPercent}
                    startDate={projectStartDate}
                    readOnly={isLocked}
                />
            </div>
            <div className="break-inside-avoid">
                <WorkloadChart 
                    data={dailyWorkload} 
                    isDarkMode={isDarkMode}
                    weekdayHours={weekdayHours}
                    setWeekdayHours={setWeekdayHours}
                    weekendHours={weekendHours}
                    setWeekendHours={setWeekendHours}
                    readOnly={isLocked}
                />
            </div>
            <div className="break-inside-avoid">
                <ProjectChart tasks={projectData.tasks} isDarkMode={isDarkMode} />
            </div>
        </div>
        
        {/* Page Break (Hidden in PDF, visible in Print) */}
        <div className="pdf-break-before pdf-page-break hidden print:block"></div>

        {/* Timeline (Gantt) - Always Visible, Condensed in PDF */}
        <section className="print:break-inside-avoid">
           <GanttChart 
            tasks={processedTasks} 
            baselineTasks={baselineTasks}
            baselineRealisticTasks={baselineRealisticTasks}
            baselineMaxVelocityTasks={baselineMaxVelocityTasks}
            realisticTasks={processedRealisticTasks}
            maxVelocityTasks={processedMaxVelocityTasks}
            weekendHours={weekendHours}
            weekdayHours={weekdayHours} 
            isDarkMode={isDarkMode}
            isPdfExport={isPdfExport}
            bufferPercent={bufferPercent}
            projectStartDate={projectStartDate}
            currentDate={now}
            onTaskToggle={handleTaskToggle}
            isExecutionMode={isLocked}
            calendarNotes={projectData.calendar_notes}
            taskNotes={projectData.task_notes}
            onDateClick={handleDateClick}
            onTaskClick={handleTaskClick}
            forceMobile={isMobilePreview}
          />
        </section>

      </main>

      <JsonEditor initialData={projectData} onUpdate={setProjectData} isOpen={isEditorOpen} setIsOpen={setIsEditorOpen} />
      <CloudSyncModal 
        isOpen={isCloudModalOpen} 
        onClose={() => setIsCloudModalOpen(false)} 
        projectData={projectData}
        onLoadProject={(data) => setProjectData(data)}
      />
      <DateNoteModal 
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        date={selectedNoteDate}
        existingNotes={currentModalNotes}
        onSave={handleSaveNote}
      />
      <TaskNoteModal 
        isOpen={isTaskNoteModalOpen}
        onClose={() => setIsTaskNoteModalOpen(false)}
        task={selectedTaskForNote}
        existingNotes={currentTaskNotes}
        onSave={handleSaveTaskNote}
      />
      <FeedbackModal 
        isOpen={feedback.isOpen} 
        onClose={() => setFeedback(prev => ({...prev, isOpen: false}))}
        title={feedback.title}
        message={feedback.message}
        type={feedback.type}
      />
      <ChatBot projectPlan={projectData} processedTasks={processedTasks} />
      <LiveAudioBot 
        projectPlan={projectData} 
        processedTasks={processedTasks} 
        onTaskToggle={handleTaskToggle}
      />
    </div>
  );
};

export default App;