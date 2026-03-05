import Link from 'next/link';
import Image from 'next/image';
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
    <header className="flex items-center justify-between px-4 py-6 sm:px-8">
      <Link href="/" className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-900">
        <Image src="/brand/hostea-logo.jpeg" alt="Hostea" width={36} height={36} className="h-9 w-9 rounded-xl" />
        <span>HOSTEA</span>
      </Link>
      <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
        <Link href="/search" className="flex items-center gap-2 hover:text-slate-900">
          <Home className="float-slow h-4 w-4 text-[var(--brand-2)]" />
          Explorar
        </Link>
        <Link href="/dashboard" className="flex items-center gap-2 hover:text-slate-900">
          <Briefcase className="float-mid h-4 w-4 text-[var(--brand-2)]" />
          Panel
        </Link>
        <Link href="/legal/terms" className="flex items-center gap-2 hover:text-slate-900">
          <Sparkles className="float-fast h-4 w-4 text-[var(--brand-2)]" />
          Legal
        </Link>
      </nav>
      <div className="flex items-center gap-2 sm:gap-3">
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
        <Link href="/host/onboarding">
          <Button size="sm">Publicar</Button>
        </Link>
      </div>
    </header>
  );
};
