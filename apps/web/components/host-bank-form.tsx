'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type BankAccount = {
  holderName: string;
  documentId: string;
  bankName: string;
  accountType: 'CA' | 'CC';
  cbuOrAlias: string;
  currency: 'ARS' | 'USD';
};

const empty: BankAccount = {
  holderName: '',
  documentId: '',
  bankName: '',
  accountType: 'CA',
  cbuOrAlias: '',
  currency: 'ARS'
};

export const HostBankForm = () => {
  const [csrf, setCsrf] = useState('');
  const [saving, setSaving] = useState(false);
  const [bank, setBank] = useState<BankAccount>(empty);

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
    fetch('/api/host/bank-account')
      .then((res) => res.json())
      .then((data) => {
        if (data.bankAccount) {
          setBank({ ...empty, ...data.bankAccount });
        }
      })
      .catch(() => undefined);
  }, []);

  const onSave = async () => {
    setSaving(true);
    const res = await fetch('/api/host/bank-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(bank)
    });
    setSaving(false);
    if (!res.ok) {
      alert('No se pudo guardar la cuenta bancaria');
    }
  };

  return (
    <div className="surface-card">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Datos para cobro</h2>
          <p className="text-sm text-slate-500">Necesarios para liquidar tus ingresos.</p>
        </div>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Titular</p>
          <Input value={bank.holderName} onChange={(e) => setBank((b) => ({ ...b, holderName: e.target.value }))} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">DNI / CUIT</p>
          <Input value={bank.documentId} onChange={(e) => setBank((b) => ({ ...b, documentId: e.target.value }))} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Banco</p>
          <Input value={bank.bankName} onChange={(e) => setBank((b) => ({ ...b, bankName: e.target.value }))} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de cuenta</p>
          <select
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
            value={bank.accountType}
            onChange={(e) => setBank((b) => ({ ...b, accountType: e.target.value as BankAccount['accountType'] }))}
          >
            <option value="CA">Caja de ahorro</option>
            <option value="CC">Cuenta corriente</option>
          </select>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">CBU / Alias</p>
          <Input value={bank.cbuOrAlias} onChange={(e) => setBank((b) => ({ ...b, cbuOrAlias: e.target.value }))} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Moneda preferida</p>
          <select
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
            value={bank.currency}
            onChange={(e) => setBank((b) => ({ ...b, currency: e.target.value as BankAccount['currency'] }))}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>
    </div>
  );
};
