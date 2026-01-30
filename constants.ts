
import { ProjectPlan } from './types';

// Generate today's date string for default
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const todayStr = `${year}-${month}-${day}`;

// Simple UUID generator for the default plan
const simpleId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export const DEFAULT_PROJECT_PLAN: ProjectPlan = {
  "id": simpleId(),
  "smart_goal": "Launch 'Hire an AI Boss' MVP by Jan 20, 2026, securing 5 free beta users and 1 paid user ($20/mo).",
  "total_estimated_duration_hours": 54,
  "project_start_date": todayStr,
  "non_working_days": [],
  "daily_logs": [],
  "tasks": [
    {
      "id": "1",
      "phase": "Design & Copy Strategy",
      "task_name": "Draft Landing Page Copy (Value Prop) & Sketch UI Wireframes",
      "duration_hours": 6,
      "predecessors": [],
      "isCompleted": false,
      "hoursCompleted": 0
    },
    {
      "id": "2",
      "phase": "Frontend Implementation",
      "task_name": "Develop Public Landing Page (HTML/CSS/React)",
      "duration_hours": 8,
      "predecessors": ["1"],
      "isCompleted": false,
      "hoursCompleted": 0
    },
    {
      "id": "3",
      "phase": "Frontend Implementation",
      "task_name": "Develop App Dashboard & User Settings Views",
      "duration_hours": 12,
      "predecessors": ["2"],
      "isCompleted": false,
      "hoursCompleted": 0
    },
    {
      "id": "4",
      "phase": "Business Logic Integration",
      "task_name": "Connect Frontend to Existing Backend API (Auth & Data)",
      "duration_hours": 8,
      "predecessors": ["3"],
      "isCompleted": false,
      "hoursCompleted": 0
    },
    {
      "id": "5",
      "phase": "Business Logic Integration",
      "task_name": "Implement Stripe Payment Gateway (Checkout & Webhooks)",
      "duration_hours": 6,
      "predecessors": ["4"],
      "isCompleted": false,
      "hoursCompleted": 0
    },
    {
      "id": "6",
      "phase": "Verification (QA)",
      "task_name": "End-to-End Testing (User Signup -> Payment -> Core Value)",
      "duration_hours": 4,
      "predecessors": ["5"],
      "isCompleted": false,
      "hoursCompleted": 0
    },
    {
      "id": "7",
      "phase": "Deployment",
      "task_name": "Production Deploy (Hosting, DNS, SSL setup)",
      "duration_hours": 2,
      "predecessors": ["6"],
      "isCompleted": false,
      "hoursCompleted": 0
    },
    {
      "id": "8",
      "phase": "User Acquisition",
      "task_name": "Outreach Campaign: Secure 5 Beta + 1 Paid User",
      "duration_hours": 8,
      "predecessors": ["7"],
      "isCompleted": false,
      "hoursCompleted": 0
    }
  ]
};