'use client';

import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatMoney, getPeriodLabel } from '@/lib/finance-report';

const tickFormatter = (value: string) => {
  const [year, month] = value.split('-');
  return `${month}/${year?.slice(2)}`;
};

export type FinanceChartPoint = {
  period: string;
  gross: number;
  adjustments: number;
  commission: number;
  hostNet: number;
};

export const FinanceChart = ({ data, metric }: { data: FinanceChartPoint[]; metric: keyof FinanceChartPoint }) => {
  const labelMap: Record<string, string> = {
    gross: 'Ingresos brutos',
    hostNet: 'Neto host',
    commission: 'Comisión',
    adjustments: 'Ajustes'
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tickFormatter={tickFormatter} stroke="#94a3b8" fontSize={12} />
          <YAxis
            stroke="#94a3b8"
            fontSize={12}
            tickFormatter={(value) => formatMoney(Number(value), 'USD')}
          />
          <Tooltip
            formatter={(value: number) => formatMoney(Number(value), 'USD')}
            labelFormatter={(label: string) => getPeriodLabel(label)}
          />
          <Line
            type="monotone"
            dataKey={metric}
            name={labelMap[String(metric)]}
            stroke="#0f172a"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
