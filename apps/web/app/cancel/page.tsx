import { Suspense } from 'react';
import { CancelClient } from './cancel-client';

export default function CancelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
          <div className="rounded-3xl bg-white p-8 shadow-soft">
            <h1 className="text-2xl font-semibold">Pago cancelado</h1>
            <p className="mt-2 text-sm text-neutral-500">Procesando cancelacion...</p>
          </div>
        </div>
      }
    >
      <CancelClient />
    </Suspense>
  );
}
