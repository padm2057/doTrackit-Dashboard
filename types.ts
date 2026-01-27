
export interface Task {
  id: string;
  phase: string;
  task_name: string;
  duration_hours: number;
  predecessors: string[];
  isCompleted?: boolean;
  completionDate?: string; // ISO Date string of when it was marked done (adjusted for 2am rule)
  forcedDate?: string; // ISO Date string (YYYY-MM-DD) to force start this task
}

export interface ProcessedTask extends Task {
  startDate: Date;
  endDate: Date;
  startOffsetDays: number;
  durationDays: number;
  rowIndex: number;
  // Map of "YYYY-MM-DD" -> hours allocated. Used for precise workload charting.
  scheduleDistribution?: Record<string, number>; 
}

export interface DailyLog {
  date: string; // YYYY-MM-DD representing the day being logged
  completed_count: number;
  total_focus_hours: number;
  momentum_score: number; // calculated as MIN(100, (Tasks*10 + FocusTimeMins/5))
  timestamp: string; // ISO string of when the snapshot was actually taken
}

export interface CalendarNote {
  id: string;
  date: string; // YYYY-MM-DD the note is attached to
  content: string;
  timestamp: string; // ISO string of when the note was created
}

export interface ProjectPlan {
  id?: string; // Database ID (UUID)
  smart_goal: string;
  total_estimated_duration_hours: number;
  project_start_date?: string; // ISO Date string YYYY-MM-DD
  tasks: Task[];
  daily_logs?: DailyLog[];
  calendar_notes?: CalendarNote[];
}