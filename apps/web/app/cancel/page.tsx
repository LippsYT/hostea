import { Suspense } from 'react';
import { CancelClient } from './cancel-client';
import { buildPageMetadata } from '@/lib/seo';

export const metadata = buildPageMetadata({
  title: 'Pago cancelado',
  description: 'El flujo de pago fue cancelado.',
  path: '/cancel',
  indexable: false
});

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
