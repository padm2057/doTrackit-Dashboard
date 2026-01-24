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
  currentDate?: Date
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
  // We need a robust order for incomplete tasks to respect dependencies.
  // Completed tasks are processed separately first.
  
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
  
  // 1. Process COMPLETED Tasks First (Fixed Anchors)
  // They are anchored to their completionDate.
  // "When a task is done, it parks itself on that day... difference scheduled for the next day."
  const completedTasks = tasks.filter(t => t.isCompleted && t.completionDate)
    .sort((a, b) => new Date(a.completionDate!).getTime() - new Date(b.completionDate!).getTime());

  // 2. Process INCOMPLETE Tasks Second (Floating)
  // They respect dependencies (which might include completed tasks)
  const incompleteTasks = sortedTasks.filter(t => !t.isCompleted || !t.completionDate);

  // --- SHARED ALLOCATION LOGIC ---
  const scheduleTask = (task: Task, anchorDate: Date, isFixedStart: boolean) => {
      let remainingDuration = task.duration_hours;
      let currentCursor = new Date(anchorDate);
      
      // Ensure we start at 9am context for logic consistency
      currentCursor.setHours(9, 0, 0, 0);

      const distribution: Record<string, number> = {};
      
      // Optimization: Failsafe loop count
      let loops = 0;
      let actualStartDate: Date | null = null;
      let lastDate: Date = new Date(currentCursor);

      // If Incomplete (Floating), we must find the first day with ANY capacity
      // If Completed (Fixed), we force start on the anchor day, even if capacity is full (it spills immediately)
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

      loops = 0;
      while (remainingDuration > 0.001 && loops < 10000) {
          loops++;
          const dateKey = getDateKey(currentCursor);
          const limit = getDailyLimit(currentCursor);
          
          if (limit > 0) {
              const available = getRemainingCapacity(currentCursor);
              
              if (available > 0) {
                  const toAlloc = Math.min(remainingDuration, available);
                  consumeCapacity(currentCursor, toAlloc);
                  
                  remainingDuration -= toAlloc;
                  distribution[dateKey] = (distribution[dateKey] || 0) + toAlloc;
                  lastDate = new Date(currentCursor);
              }
          }
          
          if (remainingDuration > 0.001) {
              // Move to next day
              currentCursor.setDate(currentCursor.getDate() + 1);
              currentCursor.setHours(9, 0, 0, 0);
          }
      }

      const actualEndDate = new Date(lastDate);
      // Set time to end of work day approx
      actualEndDate.setHours(17, 0, 0, 0);

      const diffTime = actualStartDate.getTime() - projectStartDate.getTime();
      const startOffsetDays = diffTime / (1000 * 60 * 60 * 24);
      
      const durationDiff = actualEndDate.getTime() - actualStartDate.getTime();
      const durationDays = durationDiff / (1000 * 60 * 60 * 24); // Visual days span

      const processed: ProcessedTask = {
          ...task,
          startDate: actualStartDate,
          endDate: actualEndDate,
          startOffsetDays,
          durationDays: Math.max(0.2, durationDays), // Ensure at least small visibility
          rowIndex: 0,
          scheduleDistribution: distribution
      };
      
      taskMap.set(task.id, processed);
  };

  // --- EXECUTE PASS 1: COMPLETED ---
  completedTasks.forEach(task => {
      // Anchor: Completion Date provided by user/system
      const anchor = new Date(task.completionDate!);
      scheduleTask(task, anchor, true); // true = Fixed Start (Parks on that day)
  });

  // --- EXECUTE PASS 2: INCOMPLETE ---
  incompleteTasks.forEach(task => {
      // Anchor: Max(Dependencies End, Project Start, Now)
      let anchor = projectStartDate.getTime();
      
      task.predecessors.forEach(pid => {
          const pred = taskMap.get(pid);
          if (pred) {
              // Standard Finish-to-Start: Start after predecessor ends
              // Use predecessor's calculated EndDate.
              // Note: If pred finished on Tuesday (full day), we start Wednesday?
              // The `scheduleTask` logic for Floating tasks finds the *Next Available Slot*.
              // So passing Pred.EndDate is correct; if Pred used up Tuesday, logic will skip to Wednesday.
              if (pred.endDate.getTime() > anchor) {
                  anchor = pred.endDate.getTime();
              }
          }
      });

      // Live Mode: If today is later than logic dictates, push to today
      if (currentDate) {
          const today9am = new Date(currentDate);
          today9am.setHours(9,0,0,0);
          if (today9am.getTime() > anchor) {
              anchor = today9am.getTime();
          }
      }

      scheduleTask(task, new Date(anchor), false); // false = Floating (Find capacity)
  });

  // Assign Row Indices based on original sort
  // Use the original passed order or topological? Original array order is usually preferred for UI stability.
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
  weekendHours: number
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
  
  // Pad the chart a bit if empty
  if (startCursor.getTime() === endCursor.getTime()) {
      endCursor.setDate(endCursor.getDate() + 7);
  }

  const workloadMap = new Map<string, DailyWorkload>();

  // Pre-fill Timeline
  for (let d = new Date(startCursor); d <= endCursor; d.setDate(d.getDate() + 1)) {
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const limit = isWeekend ? weekendHours : weekdayHours;
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    workloadMap.set(dateKey, {
        date: dateKey,
        hours: 0,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tooltipLabel: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        isWeekend,
        limit
    });
  }

  // --- AGGREGATE USING EXACT DISTRIBUTION FROM SCHEDULER ---
  tasks.forEach(task => {
      if (task.scheduleDistribution) {
          Object.entries(task.scheduleDistribution).forEach(([dateKey, hours]) => {
              const dayEntry = workloadMap.get(dateKey);
              // If day exists in range (it should)
              if (dayEntry) {
                  dayEntry.hours += hours;
                  if (task.phase) {
                      dayEntry[task.phase] = (dayEntry[task.phase] || 0) + hours;
                  }
              } else {
                  // Task might have spilled beyond our initial min/max calc?
                  // Should handle strictly but for now ignore or extend?
                  // In typical use, min/max covers all.
              }
          });
      }
  });

  // Formatting
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