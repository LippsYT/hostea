'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const AdminSettingsForm = ({ initial }: { initial: Record<string, any> }) => {
  const [csrf, setCsrf] = useState('');
  const [values, setValues] = useState({
    hostCommissionPercent: initial.hostCommissionPercent ?? initial.commissionPercent ?? 0.08,
    guestServicePercent: initial.guestServicePercent ?? 0.07,
    processingPercent: initial.processingPercent ?? 0,
    processingFixed: initial.processingFixed ?? 0,
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
    const payload = {
      ...values,
      // Compatibilidad legacy
      commissionPercent: values.hostCommissionPercent
    };
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      },
      body: JSON.stringify(payload)
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
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comision anfitrion (%)</label>
          <Input
            type="number"
            value={values.hostCommissionPercent}
            onChange={(e) =>
              setValues((v) => ({ ...v, hostCommissionPercent: Number(e.target.value) }))
            }
          />
        </div>
        <div className="surface-muted">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tarifa huesped (%)</label>
          <Input
            type="number"
            value={values.guestServicePercent}
            onChange={(e) =>
              setValues((v) => ({ ...v, guestServicePercent: Number(e.target.value) }))
            }
          />
        </div>
        <div className="surface-muted">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cargos proc. (%)</label>
          <Input
            type="number"
            value={values.processingPercent}
            onChange={(e) =>
              setValues((v) => ({ ...v, processingPercent: Number(e.target.value) }))
            }
          />
        </div>
        <div className="surface-muted">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cargos proc. fijo (USD)</label>
          <Input
            type="number"
            value={values.processingFixed}
            onChange={(e) =>
              setValues((v) => ({ ...v, processingFixed: Number(e.target.value) }))
            }
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
