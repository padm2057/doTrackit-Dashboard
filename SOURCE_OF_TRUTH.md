# doTrackit Dashboard - Source of Truth (SoT)

**Version:** 1.0.0
**Last Updated:** Jan 2025
**Type:** Single Page Application (React)

## 1. Core Philosophy: Execution Intelligence
Unlike standard task managers, doTrackit is a **behavioral analytics engine**. It calculates momentum, compares estimated vs. actual execution capability ("The Planning Fallacy"), and uses AI to simulate different delivery speeds (Realistic vs. Max Velocity).

---

## 2. Technical Architecture

### Stack
*   **Frontend:** React 19 (ESM based).
*   **Styling:** Tailwind CSS (Dark Mode supported).
*   **Visualization:** Recharts (Bar, Stacked Bar).
*   **AI Layer:** `@google/genai` SDK (Gemini 3 Pro, Gemini 2.5 Flash).
*   **Persistence:** Local React State + Supabase (Optional Cloud Sync).
*   **Export:** `html2pdf.js` for PDF reports, CSV generation.

### Component Hierarchy
*   `App.tsx` (Root State Container)
    *   `ProjectTable` (Detailed list view)
    *   `ProjectChart` (Resource allocation visualization)
    *   `WorkloadChart` (Daily intensity vs. capacity)
    *   `CapacitySimulatorChart` (Scenario comparison)
    *   `GanttChart` (Timeline & Dependencies)
    *   `InsightPanel` (Risk analysis & AI Opinion)
    *   `ImageGenerator` (Visual motivation)
    *   `ChatBot` (Text-based AI assistant)
    *   `LiveAudioBot` (Voice-based AI assistant)
    *   `JsonEditor` (Raw data manipulation)
    *   `CloudSyncModal` (Supabase integration)

---

## 3. Data Model (TypeScript Interfaces)

The application state is driven by a single JSON object (`ProjectPlan`).

### 3.1 ProjectPlan (Root)
```typescript
interface ProjectPlan {
  id?: string;                        // UUID
  smart_goal: string;                 // The high-level objective statement
  total_estimated_duration_hours: number; 
  project_start_date?: string;        // ISO "YYYY-MM-DD"
  tasks: Task[];                      // List of all tasks
  daily_logs?: DailyLog[];            // Historical performance tracking
}
```

### 3.2 Task (Node)
Tasks are flat but linked via `predecessors`.
```typescript
interface Task {
  id: string;             // Unique identifier (string)
  phase: string;          // Grouping (e.g., "Frontend", "Marketing")
  task_name: string;      // Description
  duration_hours: number; // Estimated effort
  predecessors: string[]; // Array of IDs that must complete first
  isCompleted?: boolean;  // Status
  completionDate?: string;// ISO timestamp of completion
}
```

### 3.3 Derived State (Runtime Calculated)
The `scheduler.ts` engine transforms `Task` into `ProcessedTask`.
```typescript
interface ProcessedTask extends Task {
  startDate: Date;        // Calculated absolute start
  endDate: Date;          // Calculated absolute end
  startOffsetDays: number;// Days from Project Start
  durationDays: number;   // Visual width in days
  scheduleDistribution?: Record<string, number>; // Specific hours allocated per date "YYYY-MM-DD": hours
}
```

---

## 4. Core Logic Engines

### 4.1 Scheduler Engine (`utils/scheduler.ts`)
The scheduler is **deterministic** and runs on every state change.
1.  **Topological Sort:** Orders tasks based on dependency graph.
2.  **Capacity Leveling:** Iterates through dates.
    *   Respects `weekdayHours` vs. `weekendHours` capacity.
    *   Fills available capacity buckets (Day Ledger).
    *   Spills excess hours to the next valid working day.
3.  **Anchoring:**
    *   **Completed Tasks:** Fixed to their `completionDate`.
    *   **Pending Tasks:** Float based on `MAX(Predecessor End, Project Start, Today)`.

### 4.2 Business Day Logic
*   **Cutoff Hour:** 2:00 AM.
*   **Logic:** Actions performed before 2:00 AM count towards the *previous* calendar day for consistency in daily logging.

### 4.3 Insight Engine (`utils/insightEngine.ts`)
Analyzes the plan for structural risks.
*   **Risk Factors:**
    *   **"8-Hour Trap":** Tasks > 8h are flagged as high risk.
    *   **Burnout:** Weekday intensity > 8h/day.
    *   **No Recovery:** Weekend intensity > 4h/day.
    *   **Missing Buffer:** Lack of QA/Verification tasks.
*   **Friction Calculation:** Computes `AdjustedHours` = `TotalHours * (1 + Buffer%)`.

---

## 5. AI Capabilities

### 5.1 Chat Boss (Text)
*   **Model:** `gemini-3-pro-preview`
*   **Context:** Receives full JSON schedule.
*   **Role:** Project Manager. Answers questions about dates, dependencies, and critical path.

### 5.2 Live Boss (Audio)
*   **Model:** `gemini-2.5-flash-native-audio-preview-12-2025`
*   **Modality:** Real-time bi-directional audio (WebSockets).
*   **Tools:** `markTaskComplete(taskId)` allows voice-controlled state updates.
*   **Latency:** Optimized for near-instant conversation.

### 5.3 Vision Board
*   **Model:** `gemini-3-pro-image-preview`
*   **Input:** Project `smart_goal`.
*   **Output:** High-fidelity visualization of the completed project.

---

## 6. Persistence & Sync

### 6.1 Local
*   React State is the immediate source of truth.
*   No auto-persistence to LocalStorage (session only unless Cloud Sync is used).

### 6.2 Cloud (Supabase)
*   **Table:** `projects`
    *   `id` (text, pk)
    *   `name` (text)
    *   `data` (jsonb) - Stores the full `ProjectPlan`
    *   `updated_at` (timestamptz)
*   **Table:** `system_status` (Archival)
    *   Stores nightly snapshots of the plan for historical analysis.

