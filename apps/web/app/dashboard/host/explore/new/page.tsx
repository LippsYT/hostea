import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEffectiveRoles } from '@/lib/server-roles';
import { redirect } from 'next/navigation';

const categories = [
  'Tours',
  'Gastronomia',
  'Cultura',
  'Naturaleza',
  'Deportes',
  'Clases',
  'Excursiones'
];

export default async function HostExploreNewPage() {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as any)?.id as string | undefined;
  const roles = await getEffectiveRoles(sessionUserId, (session?.user as any)?.roles);
  if (!roles.includes('HOST') && !roles.includes('ADMIN')) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="section-subtitle">Explorar</p>
        <h1 className="section-title">Crear actividad</h1>
      </div>

      <div className="surface-card">
        <h2 className="text-lg font-semibold text-slate-900">Informacion basica</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm" placeholder="Titulo de la actividad" />
          <select className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm">
            <option value="">Categoria</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <input className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm" placeholder="Ciudad o ubicacion" />
          <input className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm" placeholder="Duracion (ej: 3 horas)" />
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Seccion en habilitacion: conecta este formulario al backend para publicar actividades.
        </p>
      </div>
    </div>
  );
}
