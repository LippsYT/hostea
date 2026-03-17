'use client';

import {
  buildHumanAgeRules,
  buildOccupancySummary,
  type AgeRules,
  type OccupancyValue
} from '@/lib/occupancy';

type OccupancySelectorProps = {
  value: OccupancyValue;
  onChange: (value: OccupancyValue) => void;
  label?: string;
  helperText?: string;
  className?: string;
  summaryClassName?: string;
  ageRules?: AgeRules;
};

const clampCount = (value: number) => Math.max(0, Math.floor(value));

export function OccupancySelector({
  value,
  onChange,
  label = 'Personas',
  helperText,
  className = '',
  summaryClassName = '',
  ageRules
}: OccupancySelectorProps) {
  const ageLabels = buildHumanAgeRules(ageRules);
  const rows: Array<{
    key: keyof OccupancyValue;
    label: string;
    description: string;
    min: number;
  }> = [
    { key: 'adults', label: 'Adultos', description: ageLabels.adults.replace('Adultos: ', ''), min: 1 },
    { key: 'children', label: 'Ninos', description: ageLabels.children.replace('Ninos: ', ''), min: 0 },
    { key: 'infants', label: 'Infantes', description: ageLabels.infants.replace('Infantes: ', ''), min: 0 }
  ];

  const updateCount = (key: keyof OccupancyValue, delta: number) => {
    const next = {
      ...value,
      [key]: clampCount(value[key] + delta)
    };
    if (key === 'adults' && next.adults < 1) {
      next.adults = 1;
    }
    onChange(next);
  };

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className={`mt-1 text-sm text-slate-900 ${summaryClassName}`.trim()}>
            {buildOccupancySummary(value)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">{row.label}</p>
              <p className="text-xs text-slate-500">{row.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-sm text-slate-600 transition hover:border-slate-400"
                onClick={() => updateCount(row.key, -1)}
                disabled={value[row.key] <= row.min}
              >
                -
              </button>
              <span className="w-8 text-center text-sm font-semibold text-slate-900">
                {value[row.key]}
              </span>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-sm text-slate-600 transition hover:border-slate-400"
                onClick={() => updateCount(row.key, 1)}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-500">
        {helperText || `${ageLabels.adults}. ${ageLabels.children}. ${ageLabels.infants}.`}
      </p>
    </div>
  );
}
