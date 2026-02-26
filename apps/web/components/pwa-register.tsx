'use client';

import { useEffect } from 'react';

export const PwaRegister = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/service-worker.js').catch(() => undefined);
  }, []);

  return null;
};

