# Technical Specification: AGi Boss One v1 (doTrackit Module)

**Version:** 1.0
**Status:** Draft
**Context:** Porting the "doTrackit Planner" React functionality into the AGi Boss One ecosystem.

---

## 1. Executive Summary
The **AGi Boss One - Execution Planner** is a frontend module designed to ingest high-level "Smart Goals," break them down into dependency-aware tasks, and visualize the execution timeline based on variable user capacity (hours/day).

**Key Capabilities:**
1.  **Dynamic Scheduling:** auto-calculates start/end dates based on task duration, dependencies, and daily availability.
2.  **Workload Visualization:** Daily bar charts showing intensity vs. capacity.
3.  **Gantt View:** A scrollable, interactive timeline with dependency mapping.
4.  **AI Integration Point:** Structured JSON state allows an LLM to "refactor" the plan programmatically.

---

## 2. System Architecture

### 2.1 Stack Recommendation
*   **Framework:** React 19 (Next.js or Vite).
*   **Styling:** Tailwind CSS (consistent with current prototype).
*   **Visualization:** Recharts (for Bar/intensity charts).
*   **State Management:** React Context API (sufficient for Project Plan JSON) or Zustand.
*   **Icons:** Heroicons or Lucide React.

### 2.2 Core Modules
1.  **`PlanState`**: Holds the single source of truth (the JSON Object).
2.  **`SchedulerEngine`**: Pure TypeScript logic that transforms raw Tasks -> Processed Tasks with dates.
3.  **`Visualizers`**: The Gantt, Table, and Workload Chart components.

---

## 3. Data Model

The application relies on two data structures: the **Persisted State** (saved to DB/JSON) and the **Derived State** (calculated at runtime).

### 3.1 Persisted State (JSON)
*Matches `types.ts` `ProjectPlan` interface.*

```typescript
interface ProjectPlan {
  smart_goal: string; // The high-level objective
  tasks: Task[];      // Array of task objects
}

interface Task {
  id: string;             // Unique UUID or simple string
  phase: string;          // Grouping category (e.g., "Frontend", "Marketing")
  task_name: string;      // Display title
  duration_hours: number; // Estimated effort
  predecessors: string[]; // Array of Task IDs that must finish before this starts
}
```

### 3.2 Derived State (Runtime)
*Matches `types.ts` `ProcessedTask` interface. Output of the Scheduler Engine.*

```typescript
interface ProcessedTask extends Task {
  startDate: Date;        // Calculated absolute start
  endDate: Date;          // Calculated absolute end
  startOffsetDays: number;// Days from Project Start (for Gantt positioning)
  durationDays: number;   // Visual width in days (for Gantt)
  rowIndex: number;       // Vertical sort order
}
```

---

## 4. The Scheduler Engine Logic

The heart of the application is `utils/scheduler.ts`. This logic must be replicated exactly to ensure accurate dates.

**Algorithm:**
1.  **Inputs:** `Tasks[]`, `WeekdayCapacity` (int), `WeekendCapacity` (int).
2.  **Topological Sort / Dependency Resolution:**
    *   If Task B depends on Task A, `TaskB.Start = TaskA.End`.
    *   If Task C depends on A and B, `TaskC.Start = MAX(TaskA.End, TaskB.End)`.
3.  **Calendar Arithmetic (`addWorkingTime`):**
    *   Iterate hour-by-hour or day-by-day.
    *   If `CurrentDay` is Sat/Sun, use `WeekendCapacity`. Else use `WeekdayCapacity`.
    *   If `RemainingHours > DailyCapacity`, subtract capacity, move to next day 9:00 AM.
    *   If `RemainingHours <= DailyCapacity`, add hours to current time, finish task.

---

## 5. UI Component Specifications

### 5.1 Dashboard Header & Metrics
*   **Inputs:** Weekday Hours (input), Weekend Hours (input).
*   **Outputs:** Total Hours (sum), Project Finish Date (max endDate), Total Duration (days).
*   **Behavior:** Changing inputs triggers a re-run of the *Scheduler Engine*.

### 5.2 Project Table
*   **Columns:** ID, Task Name (grouped by Phase tags), Workload (Progress bar of % total effort), Schedule (Start/End dates).
*   **Styling:** Use `table-auto` with sticky headers if list is long.

### 5.3 Workload Chart (Intensity)
*   **Type:** Stacked Bar Chart (Recharts).
*   **X-Axis:** Date.
*   **Y-Axis:** Hours.
*   **Series:**
    1.  "Planned Work" (Height = sum of task hours active on that day).
    2.  "Capacity Limit" (Reference line or background fill).
*   **Logic:** Must calculate the intersection of Task Duration vs Calendar Day.

### 5.4 Gantt Chart (Complex)
*   **Layout:** Split-pane.
    *   *Left Pane:* Task List (Fixed width, e.g., 256px).
    *   *Right Pane:* Timeline (Scrollable).
*   **Scrolling:** **Crucial.** The container must handle horizontal scrolling for the timeline, but the vertical scroll must move both the Left and Right panes simultaneously.
*   **Rendering:**
    *   **Grid:** Vertical lines for days, distinct background for weekends.
    *   **Bars:** Absolute positioned `div`s based on `startOffsetDays * DAY_WIDTH`.
    *   **Connectors:** SVG layer overlay. Draw Bezier curves or angled lines from `Pred.End` to `Current.Start`.

---

## 6. AI Boss Integration (Future Proofing)

To enable "Hire an AI Boss" features, the app should expose the `ProjectPlan` JSON to an LLM agent.

**Prompt Strategy:**
1.  **Inject Context:** "Current Date is [Date]. User Mood is [Mood]."
2.  **Inject State:** Pass the full `ProjectPlan` JSON.
3.  **Instruction:** "Rearrange tasks to prioritize quick wins" or "Break down Task #4 into 3 subtasks."
4.  **Response:** The LLM returns a strictly formatted JSON patch or the full new JSON object.
5.  **Action:** The App validates the schema, then calls `setProjectData(newJson)`, triggering the Scheduler Engine to re-render the visual plan.

---

## 7. Migration Checklist

1.  [ ] Copy `types.ts` to shared model library.
2.  [ ] Port `utils/scheduler.ts` (ensure accurate Date handling).
3.  [ ] Install `recharts` and `lucide-react`.
4.  [ ] Implement `GanttChart.tsx` with the CSS specific overflow logic (Left fixed, Right scroll).
5.  [ ] Connect `WeekdayHours` / `WeekendHours` state to the Scheduler.
