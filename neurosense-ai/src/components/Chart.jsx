import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

export default function Chart({ data, type = 'line', xKey = 'name', dataKeys = [], colors = ['#0ea5e9', '#14b8a6', '#8b5cf6'] }) {
  if (!data || data.length === 0) return <div className="h-full w-full flex items-center justify-center text-slate-400">No data available</div>;

  return (
    <ResponsiveContainer width="100%" height="100%" className="transition-colors">
      {type === 'line' ? (
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" vertical={false} />
          <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ 
              borderRadius: '12px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              backgroundColor: 'white',
              color: '#1e293b'
            }}
            itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
            cursor={{ stroke: '#94a3b8', strokeWidth: 1 }}
            // Tailwind doesn't easily apply to Recharts internals, so we use some inline styles
            // But for dark mode, we can use a custom content or just basic overrides
            wrapperClassName="dark:!bg-slate-900 dark:!border-slate-800"
          />
          {dataKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />}
          {dataKeys.map((key, index) => (
            <Line 
              key={key} 
              type="monotone" 
              dataKey={key} 
              stroke={colors[index % colors.length]} 
              strokeWidth={3}
              activeDot={{ r: 6, strokeWidth: 0 }}
              dot={{ r: 3, strokeWidth: 2, fill: 'white' }}
            />
          ))}
        </LineChart>
      ) : (
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={32}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-100 dark:text-slate-800" vertical={false} />
          <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip 
            cursor={{ fill: 'currentColor', className: 'text-slate-50 dark:text-slate-800/50' }} 
            contentStyle={{ 
              borderRadius: '12px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              backgroundColor: 'white',
              color: '#1e293b'
            }}
            wrapperClassName="dark:!bg-slate-900 dark:!border-slate-800"
          />
          {dataKeys.map((key, index) => (
            <Bar 
              key={key} 
              dataKey={key} 
              fill={colors[index % colors.length]} 
              radius={[4, 4, 0, 0]} 
            />
          ))}
        </BarChart>
      )}
    </ResponsiveContainer>
  );
}
