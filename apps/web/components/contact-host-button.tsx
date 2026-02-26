'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export const ContactHostButton = ({ listingId }: { listingId: string }) => {
  const [loading, setLoading] = useState(false);

  const onContact = async () => {
    try {
      setLoading(true);
      const csrfRes = await fetch('/api/security/csrf');
      const csrfData = await csrfRes.json().catch(() => ({}));
      const token = csrfData?.token || '';

      const res = await fetch('/api/messages/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({ listingId })
      });

      if (res.status === 401) {
        window.location.href = '/auth/sign-in';
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data?.thread?.id) {
        window.location.href = `/dashboard/client/messages?threadId=${data.thread.id}`;
        return;
      }

      alert(data?.error || 'No se pudo abrir el chat con el anfitrion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" className="w-full" onClick={onContact} disabled={loading}>
      {loading ? 'Abriendo chat...' : 'Contactar anfitrion'}
    </Button>
  );
};
