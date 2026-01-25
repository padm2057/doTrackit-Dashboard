import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Task } from '../types';

interface ProjectChartProps {
  tasks: Task[];
  isDarkMode?: boolean;
}

export const ProjectChart: React.FC<ProjectChartProps> = ({ tasks, isDarkMode = false }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Delay rendering of the chart until mounted to ensure container has dimensions
    setIsMounted(true);
  }, []);

  // Map data to show "ID. FirstWord" on the axis
  const data = tasks.map(t => {
    // Get the first word, remove potential trailing punctuation like colon/comma
    const firstWord = t.task_name.split(' ')[0].replace(/[:,\.]/g, '');
    return {
        ...t,
        shortName: `${t.id}. ${firstWord}`
    };
  });

  const getPhaseColor = (phase: string) => {
    if (phase.includes('Design')) return '#a855f7'; // purple-500
    if (phase.includes('Frontend')) return '#3b82f6'; // blue-500
    if (phase.includes('Backend') || phase.includes('Business')) return '#6366f1'; // indigo-500
    // Swapped QA and User
    if (phase.includes('Verification') || phase.includes('QA')) return '#f43f5e'; // rose-500 (Was Amber)
    if (phase.includes('Deployment')) return '#10b981'; // emerald-500
    if (phase.includes('User')) return '#f59e0b'; // amber-500 (Was Rose)
    return isDarkMode ? '#94a3b8' : '#64748b'; // slate-400 : slate-500
  };

  const axisColor = isDarkMode ? '#94a3b8' : '#64748b';
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 h-80 flex flex-col w-full">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Resource Allocation (Hours)</h3>
      <div className="flex-1 min-h-0 min-w-0 relative">
        <div className="absolute inset-0">
          {isMounted ? (
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
                <BarChart
                layout="vertical"
                data={data}
                margin={{
                    top: 5,
                    right: 30,
                    left: 10,
                    bottom: 5,
                }}
                >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} stroke={gridColor} />
                <XAxis type="number" stroke={axisColor} fontSize={12} />
                <YAxis 
                    dataKey="shortName" 
                    type="category" 
                    width={90} 
                    stroke={axisColor} 
                    fontSize={11}
                    tick={{fontSize: 11, fill: axisColor, fontWeight: 500}}
                    interval={0}
                />
                <Tooltip 
                    cursor={{fill: isDarkMode ? '#1e293b' : '#f1f5f9'}}
                    contentStyle={{ 
                        borderRadius: '8px', 
                        border: isDarkMode ? '1px solid #334155' : 'none', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                        color: isDarkMode ? '#f1f5f9' : '#1e293b'
                    }}
                    itemStyle={{ color: isDarkMode ? '#e2e8f0' : '#1e293b', fontWeight: 600 }}
                    formatter={(value: number, name: string, props: any) => {
                        // Display the full task name in the tooltip for context
                        return [`${value}h`, props.payload.task_name];
                    }}
                />
                <Bar dataKey="duration_hours" radius={[0, 4, 4, 0]} name="Duration">
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getPhaseColor(entry.phase)} />
                    ))}
                </Bar>
                </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};