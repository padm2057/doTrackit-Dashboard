# Data Schema (Source of Truth)

This document strictly defines the database schema for the doTrackit platform (Airtable/PostgreSQL).

## Table 1: Goals
- **Name** (Text): Project title.
- **Status** (Select): Active, Paused, Completed.
- **Why?** (Text): User motivation.
- **Tasks** (Link): One-to-many link to Tasks table.
- **Progress** (Rollup): Average % of completed tasks.

## Table 2: Tasks
- **Task Name** (Text)
- **Status** (Select): To Do, In Progress, Done, Blocked.
- **Due Date** (Date+Time)
- **Goal** (Link): Linked to one Goal.
- **Est. Duration (Mins)** (Number)
- **Actual Duration (Mins)** (Number)
- **Difficulty** (Rating 1-5)
- **Completion Date** (Date+Time)
- **Daily Log** (Link): Linked to Daily_Logs.
- **Deviation_Calc** (Formula): `Actual - Est`
- **Planning_Accuracy_Ratio** (Formula): `Actual / Est`
- **Is_Overdue** (Formula): Checks if `Status != Done` and `Date < Today`.

## Table 3: Daily_Logs
- **Date** (Date)
- **Tasks Linked** (Link): Many tasks.
- **Tasks Completed** (Count)
- **Total Focus Time** (Rollup): Sum of Actual Duration.
- **Mood** (Select): High Energy, Neutral, Brain Fog, Burned Out.
- **Momentum Score** (Formula): calculated as `MIN(100, (Tasks*10 + FocusTime/5))`.
