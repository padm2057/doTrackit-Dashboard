import { Task, ProcessedTask } from '../types';

// Helper interface for the global capacity ledger
interface DayLedger {
  [dateStr: string]: number; // 'YYYY-MM-DD': hours_used
}

export const calculateProjectSchedule = (
  tasks: Task[], 
  weekdayHours: number, 
  weekendHours: number,
  projectStartTime?: Date,
  currentDate?: Date,
  nonWorkingDays: string[] = []
): ProcessedTask[] => {
  const taskMap = new Map<string, ProcessedTask>();
  const capacityLedger: DayLedger = {};
  
  // Use provided start date or default to today
  const projectStartDate = projectStartTime ? new Date(projectStartTime) : new Date();
  projectStartDate.setHours(9, 0, 0, 0); 

  // --- HELPERS ---

  const getDateKey = (d: Date) => {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  const getDailyLimit = (d: Date): number => {
      const key = getDateKey(d);
      // Explicit non-working day check
      if (nonWorkingDays.includes(key)) {
          return 0;
      }

      const day = d.getDay();
      const isWeekend = day === 0 || day === 6;
      return isWeekend ? weekendHours : weekdayHours;
  };

  const getRemainingCapacity = (d: Date): number => {
      const key = getDateKey(d);
      const limit = getDailyLimit(d);
      const used = capacityLedger[key] || 0;
      return Math.max(0, limit - used);
  };

  const consumeCapacity = (d: Date, hours: number) => {
      const key = getDateKey(d);
      const current = capacityLedger[key] || 0;
      capacityLedger[key] = current + hours;
  };

  // --- TOPOLOGICAL SORT FOR INCOMPLETE TASKS ---
  const getTopologicalOrder = (allTasks: Task[]): Task[] => {
      const visited = new Set<string>();
      const sorted: Task[] = [];
      const visit = (taskId: string) => {
          if (visited.has(taskId)) return;
          visited.add(taskId);
          const t = allTasks.find(x => x.id === taskId);
          if (t) {
              t.predecessors.forEach(p => visit(p));
              sorted.push(t);
          }
      };
      allTasks.forEach(t => visit(t.id));
      return sorted;
  };

  const sortedTasks = getTopologicalOrder(tasks);
  
  // 1. Process COMPLETED Tasks (Fixed Anchors)
  const completedTasks = tasks.filter(t => t.isCompleted && t.completionDate)
    .sort((a, b) => new Date(a.completionDate!).getTime() - new Date(b.completionDate!).getTime());

  // 2. Process FORCED PENDING Tasks (Fixed Start, Ignore Capacity on Day 1)
  const forcedTasks = sortedTasks.filter(t => !t.isCompleted && t.forcedDate);

  // 3. Process FLOATING PENDING Tasks (Respect Dependencies & Capacity)
  const floatingTasks = sortedTasks.filter(t => !t.isCompleted && !t.forcedDate);

  // --- SHARED ALLOCATION LOGIC ---
  const scheduleTask = (task: Task, anchorDate: Date, isFixedStart: boolean, allowOverload: boolean = false) => {
      let remainingDuration = task.duration_hours;
      let currentCursor = new Date(anchorDate);
      
      // Ensure we start at 9am context for logic consistency
      currentCursor.setHours(9, 0, 0, 0);

      const distribution: Record<string, number> = {};
      
      // Optimization: Failsafe loop count
      let loops = 0;
      let actualStartDate: Date | null = null;
      let lastDate: Date = new Date(currentCursor);

      // If Floating, find first available capacity
      if (!isFixedStart) {
          while (loops < 1000) {
              const cap = getRemainingCapacity(currentCursor);
              if (cap > 0.001) break;
              currentCursor.setDate(currentCursor.getDate() + 1);
              currentCursor.setHours(9,0,0,0);
              loops++;
          }
      }

      // Record the visual start date
      actualStartDate = new Date(currentCursor);
      const startKey = getDateKey(actualStartDate);

      loops = 0;
      while (remainingDuration > 0.001 && loops < 10000) {
          loops++;
          const dateKey = getDateKey(currentCursor);
          const limit = getDailyLimit(currentCursor);
          
          // Determine available capacity
          let available = 0;
          
          // Strategy: If allowOverload is true (Completed/Forced), we prioritize continuity.
          if (allowOverload) {
              if (limit > 0) {
                  // Business Day: Take full daily limit
                  available = limit;
              } else {
                  // Off Day (e.g. Weekend or Blocked): Only allow if it is the explicit Start Date
                  if (dateKey === startKey) {
                      const fallbackCap = weekdayHours > 0 ? weekdayHours : 8;
                      available = fallbackCap;
                  } else {
                      available = 0; // Skip off-day
                  }
              }
          } else {
             // Normal Floating Task: Respect remaining capacity
             if (limit > 0) {
                 available = getRemainingCapacity(currentCursor);
             }
          }
          
          if (available > 0) {
              const toAlloc = Math.min(remainingDuration, available);
              
              // LOGIC UPDATE: For Completed tasks, only consume capacity on the Start Day.
              if (!task.isCompleted || (task.isCompleted && dateKey === startKey)) {
                  consumeCapacity(currentCursor, toAlloc);
              }
              
              remainingDuration -= toAlloc;
              distribution[dateKey] = (distribution[dateKey] || 0) + toAlloc;
              lastDate = new Date(currentCursor);
          }
          
          if (remainingDuration > 0.001) {
              // Move to next day
              currentCursor.setDate(currentCursor.getDate() + 1);
              currentCursor.setHours(9, 0, 0, 0);
          }
      }

      const actualEndDate = new Date(lastDate);
      actualEndDate.setHours(17, 0, 0, 0);

      const diffTime = actualStartDate.getTime() - projectStartDate.getTime();
      const startOffsetDays = diffTime / (1000 * 60 * 60 * 24);
      
      const durationDiff = actualEndDate.getTime() - actualStartDate.getTime();
      const durationDays = durationDiff / (1000 * 60 * 60 * 24);

      const processed: ProcessedTask = {
          ...task,
          startDate: actualStartDate,
          endDate: actualEndDate,
          startOffsetDays,
          durationDays: Math.max(0.2, durationDays),
          rowIndex: 0,
          scheduleDistribution: distribution
      };
      
      taskMap.set(task.id, processed);
  };

  // --- PASS 1: COMPLETED ---
  // Completed tasks are anchors.
  completedTasks.forEach(task => {
      const anchor = new Date(task.completionDate!);
      scheduleTask(task, anchor, true, true); 
  });

  // --- PASS 2: FORCED PENDING ---
  forcedTasks.forEach(task => {
      const [y, m, d] = task.forcedDate!.split('-').map(Number);
      const anchor = new Date(y, m - 1, d);
      scheduleTask(task, anchor, true, true);
  });

  // --- PASS 3: FLOATING PENDING ---
  floatingTasks.forEach(task => {
      let anchor = projectStartDate.getTime();
      
      task.predecessors.forEach(pid => {
          const pred = taskMap.get(pid);
          if (pred) {
              let pEnd = pred.endDate.getTime();
              
              // LOGIC UPDATE: If predecessor is completed, push successor to the NEXT calendar day relative to completion.
              if (pred.isCompleted) {
                  const nextDay = new Date(pred.startDate);
                  nextDay.setDate(nextDay.getDate() + 1);
                  nextDay.setHours(9, 0, 0, 0);
                  pEnd = nextDay.getTime();
              }

              if (pEnd > anchor) {
                  anchor = pEnd;
              }
          }
      });

      // Live Mode check
      if (currentDate) {
          const today9am = new Date(currentDate);
          today9am.setHours(9,0,0,0);
          if (today9am.getTime() > anchor) {
              anchor = today9am.getTime();
          }
      }

      scheduleTask(task, new Date(anchor), false); 
  });

  const result = Array.from(taskMap.values());
  const final = result.map(p => {
      const idx = tasks.findIndex(t => t.id === p.id);
      return { ...p, rowIndex: idx };
  });

  return final.sort((a, b) => a.rowIndex - b.rowIndex);
};

export interface DailyWorkload {
  date: string;
  hours: number;
  label: string;
  tooltipLabel: string;
  isWeekend: boolean;
  limit: number;
  [key: string]: any; 
}

export const calculateDailyWorkload = (
  tasks: ProcessedTask[], 
  weekdayHours: number, 
  weekendHours: number,
  nonWorkingDays: string[] = []
): DailyWorkload[] => {
  if (tasks.length === 0) return [];

  let minDate = new Date(tasks[0].startDate);
  let maxDate = new Date(tasks[0].endDate);
  
  tasks.forEach(t => {
    if (t.startDate < minDate) minDate = new Date(t.startDate);
    if (t.endDate > maxDate) maxDate = new Date(t.endDate);
  });

  const startCursor = new Date(minDate);
  startCursor.setHours(0, 0, 0, 0);
  
  const endCursor = new Date(maxDate);
  endCursor.setHours(23, 59, 59, 999);
  
  if (startCursor.getTime() === endCursor.getTime()) {
      endCursor.setDate(endCursor.getDate() + 7);
  }

  const workloadMap = new Map<string, DailyWorkload>();

  for (let d = new Date(startCursor); d <= endCursor; d.setDate(d.getDate() + 1)) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    // Check blocked status
    const isBlocked = nonWorkingDays.includes(dateKey);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    
    // Limit is 0 if blocked, otherwise normal
    const limit = isBlocked ? 0 : (isWeekend ? weekendHours : weekdayHours);
    
    workloadMap.set(dateKey, {
        date: dateKey,
        hours: 0,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tooltipLabel: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        isWeekend,
        limit
    });
  }

  tasks.forEach(task => {
      if (task.scheduleDistribution) {
          Object.entries(task.scheduleDistribution).forEach(([dateKey, hours]) => {
              const dayEntry = workloadMap.get(dateKey);
              if (dayEntry) {
                  dayEntry.hours += hours;
                  if (task.phase) {
                      dayEntry[task.phase] = (dayEntry[task.phase] || 0) + hours;
                  }
              }
          });
      }
  });

  workloadMap.forEach(entry => {
    entry.hours = Number(entry.hours.toFixed(2));
    Object.keys(entry).forEach(key => {
        if (typeof entry[key] === 'number' && key !== 'hours' && key !== 'limit') {
             entry[key] = Number((entry[key] as number).toFixed(2));
        }
    });
  });

  return Array.from(workloadMap.values()).sort((a,b) => a.date.localeCompare(b.date));
};