export default function SuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="rounded-3xl bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-semibold">Pago confirmado</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Tu reserva ya está confirmada. Revisá tu panel para ver los detalles.
        </p>
        <div className="mt-6">
          <a
            href="/dashboard/client"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Ir al panel
          </a>
        </div>
      </div>
    </div>
  );
}
