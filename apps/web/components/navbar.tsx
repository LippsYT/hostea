import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Button } from './ui/button';
import { Sparkles, Home, Briefcase } from 'lucide-react';

export const Navbar = async () => {
  const session = await getServerSession(authOptions);
  const userName = (session?.user as any)?.name || (session?.user as any)?.email || '';
  const initials = userName
    ? userName
        .split(' ')
        .map((part: string) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <header className="flex items-center justify-between px-8 py-6">
      <Link href="/" className="text-2xl font-semibold tracking-tight">
        HOSTEA
      </Link>
      <nav className="hidden items-center gap-6 text-sm text-neutral-600 md:flex">
        <Link href="/search" className="flex items-center gap-2">
          <Home className="h-4 w-4 text-neutral-500 float-slow" />
          Explorar
        </Link>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-neutral-500 float-mid" />
          Panel
        </Link>
        <Link href="/legal/terms" className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neutral-500 float-fast" />
          Legal
        </Link>
      </nav>
      <div className="flex items-center gap-3">
        {session ? (
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {initials}
            </span>
            <span className="hidden sm:block">Mi perfil</span>
          </Link>
        ) : (
          <Link href="/auth/sign-in" className="text-sm">
            Ingresar
          </Link>
        )}
        <Button size="sm">Publicar</Button>
      </div>
    </header>
  );
};
