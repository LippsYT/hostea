'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PushSubscribeCard } from '@/components/push-subscribe-card';

export const ClientProfile = ({
  initialName,
  initialPhone,
  kycStatus,
  roles
}: {
  initialName: string;
  initialPhone: string | null;
  kycStatus: string | null;
  roles: string[];
}) => {
  const [csrf, setCsrf] = useState('');
  const [name, setName] = useState(initialName || '');
  const [phone, setPhone] = useState(initialPhone || '');
  const [docFrontUrl, setDocFrontUrl] = useState('');
  const [docBackUrl, setDocBackUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const saveProfile = async () => {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ name, phone })
    });
    alert('Perfil actualizado');
  };

  const submitKyc = async () => {
    await fetch('/api/kyc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify({ docFrontUrl, docBackUrl, selfieUrl })
    });
    alert('KYC enviado');
  };

  const canHostPush = roles.includes('HOST') || roles.includes('ADMIN');
  const canClientPush = roles.includes('CLIENT') || roles.includes('ADMIN');

  return (
    <div className="space-y-6">
      <div className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Perfil</h2>
            <p className="text-sm text-slate-500">Datos personales y contacto.</p>
          </div>
          <Button size="sm" onClick={saveProfile}>Guardar</Button>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Telefono" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>

      <div className="surface-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">KYC</h2>
            <p className="text-sm text-slate-500">Estado actual: {kycStatus || 'SIN ENVIO'}</p>
          </div>
          <Button size="sm" onClick={submitKyc}>Enviar KYC</Button>
        </div>
        <div className="mt-6 grid gap-3">
          <Input placeholder="URL doc frente" value={docFrontUrl} onChange={(e) => setDocFrontUrl(e.target.value)} />
          <Input placeholder="URL doc dorso" value={docBackUrl} onChange={(e) => setDocBackUrl(e.target.value)} />
          <Input placeholder="URL selfie" value={selfieUrl} onChange={(e) => setSelfieUrl(e.target.value)} />
        </div>
      </div>

      {canHostPush && (
        <PushSubscribeCard
          role="host"
          title="Notificaciones del panel host"
          subtitle="Recibe push por consultas, mensajes, reservas y ofertas."
        />
      )}

      {canClientPush && (
        <PushSubscribeCard
          role="client"
          title="Notificaciones de tus reservas"
          subtitle="Recibe push por mensajes del anfitrion y actualizaciones de reserva."
        />
      )}
    </div>
  );
};
