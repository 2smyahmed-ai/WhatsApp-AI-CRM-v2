'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MessagesChartProps {
  data: Array<{
    date: string;
    incoming: number;
    outgoing: number;
  }>;
}

export default function MessagesChart({ data }: MessagesChartProps) {
  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.2)]">
      <h3 className="mb-4 text-lg font-medium text-white">Messages Over Time</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(value) => new Date(value).toLocaleDateString()}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="incoming"
              stroke="#0055ff"
              strokeWidth={2}
              name="Incoming"
            />
            <Line
              type="monotone"
              dataKey="outgoing"
              stroke="#10B981"
              strokeWidth={2}
              name="Outgoing"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
