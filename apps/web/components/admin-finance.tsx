'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export type FinanceReservationRow = {
  id: string;
  listingTitle: string;
  hostId: string;
  hostName: string;
  hostEmail: string;
  total: number;
  hostAmount: number;
  paid: number;
  due: number;
};

export type FinanceHostRow = {
  hostId: string;
  hostName: string;
  hostEmail: string;
  total: number;
  paid: number;
  due: number;
  bankAccount?: {
    holderName?: string;
    documentId?: string;
    bankName?: string;
    accountType?: string;
    cbuOrAlias?: string;
    currency?: string;
  } | null;
};

export const AdminFinance = ({
  reservations,
  hosts
}: {
  reservations: FinanceReservationRow[];
  hosts: FinanceHostRow[];
}) => {
  const [csrf, setCsrf] = useState('');

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const markPaid = async (reservationId: string) => {
    await fetch('/api/admin/payouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ reservationId })
    });
    window.location.reload();
  };

  return (
    <div className="space-y-8">
      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Resumen por host</h2>
        <div className="mt-5 space-y-3 text-sm">
          {hosts.map((h) => (
            <div key={h.hostEmail} className="surface-muted flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{h.hostName}</p>
                <p className="text-xs text-slate-500">{h.hostEmail}</p>
                <p className="text-slate-500">Pagado USD {h.paid.toFixed(2)}</p>
                <div className="mt-2 text-xs text-slate-600">
                  {h.bankAccount ? (
                    <div className="space-y-1">
                      <p>
                        <span className="font-semibold text-slate-700">Titular:</span>{' '}
                        {h.bankAccount.holderName || 'No informado'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Documento:</span>{' '}
                        {h.bankAccount.documentId || 'No informado'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Banco:</span>{' '}
                        {h.bankAccount.bankName || 'No informado'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Cuenta:</span>{' '}
                        {h.bankAccount.accountType || 'No informado'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">CBU/Alias:</span>{' '}
                        {h.bankAccount.cbuOrAlias || 'No informado'}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-700">Moneda:</span>{' '}
                        {h.bankAccount.currency || 'No informado'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-amber-700">No tiene datos bancarios cargados.</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p>Total USD {h.total.toFixed(2)}</p>
                <p className="text-slate-700">Pendiente USD {h.due.toFixed(2)}</p>
              </div>
            </div>
          ))}
          {hosts.length === 0 && <p className="text-sm text-slate-500">Sin datos financieros.</p>}
        </div>
      </div>

      <div className="surface-card">
        <h2 className="text-xl font-semibold text-slate-900">Reservas a liquidar</h2>
        <div className="mt-5 space-y-3 text-sm">
          {reservations.map((r) => (
            <div key={r.id} className="surface-muted flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{r.listingTitle}</p>
                <p className="text-slate-500">
                  Host: {r.hostName} · {r.hostEmail}
                </p>
              </div>
              <div className="text-right text-slate-600">
                <p>Total USD {r.total.toFixed(2)}</p>
                <p>Host USD {r.hostAmount.toFixed(2)}</p>
                <p>Pendiente USD {r.due.toFixed(2)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => markPaid(r.id)} disabled={r.due <= 0}>
                Marcar pagado
              </Button>
            </div>
          ))}
          {reservations.length === 0 && <p className="text-sm text-slate-500">No hay pendientes de pago.</p>}
        </div>
      </div>
    </div>
  );
};
