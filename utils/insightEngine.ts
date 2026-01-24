import { Task, ProcessedTask } from '../types';

export interface AnalysisResult {
  verdict: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  totalHours: number;
  adjustedHours: number;
  weeklyCapacity: number;
  estimatedWeeks: number;
  adjustedWeeks: number;
  longTasks: Task[];
  hasBuffer: boolean;
  scheduleRisks: string[];
  bufferUsed: number; // Added to track input buffer
}

export const analyzeProjectPlan = (
  tasks: Task[],
  weekdayHours: number,
  weekendHours: number,
  bufferPercent: number = 30 // Default 30% if not provided
): AnalysisResult => {
  const totalHours = tasks.reduce((sum, t) => sum + t.duration_hours, 0);
  const weeklyCapacity = (weekdayHours * 5) + (weekendHours * 2);
  
  // 1. Calculate Timelines
  const estimatedWeeks = weeklyCapacity > 0 ? totalHours / weeklyCapacity : 0;
  
  // Friction Multiplier (Planning Fallacy)
  const adjustedHours = Math.round(totalHours * (1 + (bufferPercent / 100)));
  const adjustedWeeks = weeklyCapacity > 0 ? adjustedHours / weeklyCapacity : 0;

  // 2. Identify Risks
  const longTasks = tasks.filter(t => t.duration_hours >= 8);
  
  const bufferKeywords = ['buffer', 'qa', 'testing', 'review', 'fix', 'verification'];
  const bufferTasks = tasks.filter(t => 
    bufferKeywords.some(k => t.task_name.toLowerCase().includes(k) || t.phase.toLowerCase().includes(k))
  );
  const bufferRatio = bufferTasks.reduce((sum, t) => sum + t.duration_hours, 0) / totalHours;
  // If user sets a high buffer manually (>15%), we consider them to have buffer even if explicit tasks don't exist
  const hasBuffer = bufferRatio > 0.1 || bufferPercent >= 15;

  // 3. Construct Verdict & Risks
  const scheduleRisks: string[] = [];
  let riskScore = 0;

  if (longTasks.length > 0) {
    scheduleRisks.push(`The "8-Hour Trap": ${longTasks.length} tasks are estimated at 8h+. These often spill over.`);
    riskScore += longTasks.length;
  }

  if (!hasBuffer) {
    scheduleRisks.push('Missing "Glue" & Buffer: Low safety margin set for QA/Fixes.');
    riskScore += 3;
  }

  if (weekdayHours > 8) {
    scheduleRisks.push('Burnout Warning: Weekday intensity > 8h is unsustainable for deep work.');
    riskScore += 2;
  }

  if (weekendHours > 4) {
    scheduleRisks.push('No Recovery: High weekend load will degrade cognitive performance by Week 2.');
    riskScore += 2;
  }

  let verdict = "Solid Plan";
  let riskLevel: AnalysisResult['riskLevel'] = 'Low';

  if (riskScore >= 5) {
    verdict = "Optimistic and High Risk";
    riskLevel = "High";
  } else if (riskScore >= 2) {
    verdict = "Aggressive but Feasible";
    riskLevel = "Medium";
  }

  return {
    verdict,
    riskLevel,
    totalHours,
    adjustedHours,
    weeklyCapacity,
    estimatedWeeks,
    adjustedWeeks,
    longTasks,
    hasBuffer,
    scheduleRisks,
    bufferUsed: bufferPercent
  };
};