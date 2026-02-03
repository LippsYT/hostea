'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const AdminSettingsForm = ({ initial }: { initial: Record<string, any> }) => {
  const [csrf, setCsrf] = useState('');
  const [values, setValues] = useState({
    commissionPercent: initial.commissionPercent ?? 0.15,
    usdToArsRate: initial.usdToArsRate ?? 980,
    cancelWindowHours: initial.cancelWindowHours ?? 48,
    partialRefundPercent: initial.partialRefundPercent ?? 0.5
  });

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const onSave = async () => {
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify(values)
    });
    alert('Configuracion actualizada');
  };

  return (
    <div className="surface-card">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Configuracion general</h3>
          <p className="text-sm text-slate-500">Comision, reembolsos y parametros de negocio.</p>
        </div>
        <Button size="sm" onClick={onSave}>Guardar cambios</Button>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="surface-muted">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comision (%)</label>
          <Input
            type="number"
            value={values.commissionPercent}
            onChange={(e) => setValues((v) => ({ ...v, commissionPercent: Number(e.target.value) }))}
          />
        </div>
        <div className="surface-muted">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">USD a ARS</label>
          <Input
            type="number"
            value={values.usdToArsRate}
            onChange={(e) => setValues((v) => ({ ...v, usdToArsRate: Number(e.target.value) }))}
          />
        </div>
        <div className="surface-muted">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ventana cancelacion (hs)</label>
          <Input
            type="number"
            value={values.cancelWindowHours}
            onChange={(e) => setValues((v) => ({ ...v, cancelWindowHours: Number(e.target.value) }))}
          />
        </div>
        <div className="surface-muted">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reembolso parcial (%)</label>
          <Input
            type="number"
            value={values.partialRefundPercent}
            onChange={(e) => setValues((v) => ({ ...v, partialRefundPercent: Number(e.target.value) }))}
          />
        </div>
      </div>
    </div>
  );
};
