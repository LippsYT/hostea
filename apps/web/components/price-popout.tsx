'use client';

import { useEffect, useState } from 'react';

export const PricePopout = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = typeof window !== 'undefined' ? localStorage.getItem('hostea_price_popout') : '1';
    if (!seen) {
      setOpen(true);
    }
  }, []);

  const close = () => {
    localStorage.setItem('hostea_price_popout', '1');
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={close}
            className="text-sm text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50">
            <svg
              className="h-10 w-10 text-rose-500 float-mid"
              viewBox="0 0 64 64"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M10 28L38 8a8 8 0 0 1 9.6 1.1l6.3 6.3a8 8 0 0 1 1.1 9.6L36 53a6 6 0 0 1-7.7 2.2L14 49.9a6 6 0 0 1-3.9-7.6z" />
              <circle cx="44" cy="20" r="4" fill="white" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-900">
            El precio que ves incluye todas las tarifas
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Impuestos, limpieza y comisiones ya están contempladas.
          </p>
          <button
            type="button"
            onClick={close}
            className="mt-6 w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
