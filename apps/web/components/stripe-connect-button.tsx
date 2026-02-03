'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export const StripeConnectButton = () => {
  const [csrf, setCsrf] = useState('');

  useEffect(() => {
    fetch('/api/security/csrf').then(async (res) => {
      const data = await res.json();
      setCsrf(data.token);
    });
  }, []);

  const connect = async () => {
    const res = await fetch('/api/stripe/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf
      }
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error || 'No se pudo iniciar Stripe Connect');
    }
  };

  return (
    <Button variant="outline" onClick={connect}>
      Activar Stripe Connect
    </Button>
  );
};
