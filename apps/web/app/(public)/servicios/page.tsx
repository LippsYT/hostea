import Link from 'next/link';
import { Wrench, ShieldCheck, Banknote, Headset } from 'lucide-react';
import { Button } from '@/components/ui/button';

const services = [
  {
    title: 'Gestion de cobros',
    description: 'Pagos seguros con seguimiento de estados y conciliacion.',
    icon: Banknote
  },
  {
    title: 'Soporte operativo',
    description: 'Mesa de ayuda para anfitriones y clientes.',
    icon: Headset
  },
  {
    title: 'Seguridad y cumplimiento',
    description: 'Herramientas para KYC, reglas y monitoreo de actividad.',
    icon: ShieldCheck
  },
  {
    title: 'Automatizaciones',
    description: 'Calendario, mensajeria y flujos de aprobacion integrados.',
    icon: Wrench
  }
];

export default function ServicesPage() {
  return (
    <section className="px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-8 shadow-soft">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">HOSTEA</p>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900 md:text-5xl">Servicios</h1>
          <p className="mt-4 max-w-3xl text-base text-slate-600 md:text-lg">
            Soluciones para anfitriones: gestion, operaciones, soporte y seguridad para vender
            alojamientos y actividades desde una sola plataforma.
          </p>
          <div className="mt-6">
            <Link href="/dashboard">
              <Button>Ir al panel</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <article
              key={service.title}
              className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-soft"
            >
              <div className="flex items-center gap-3">
                <span className="brand-gradient-bg inline-flex h-10 w-10 items-center justify-center rounded-xl text-white">
                  <service.icon className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-semibold text-slate-900">{service.title}</h2>
              </div>
              <p className="mt-3 text-sm text-slate-600">{service.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
