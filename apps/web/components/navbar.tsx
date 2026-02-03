import Link from 'next/link';
import { Button } from './ui/button';

export const Navbar = () => (
  <header className="flex items-center justify-between px-8 py-6">
    <Link href="/" className="text-2xl font-semibold tracking-tight">
      HOSTEA
    </Link>
    <nav className="flex items-center gap-6 text-sm text-neutral-600">
      <Link href="/search">Explorar</Link>
      <Link href="/dashboard">Panel</Link>
      <Link href="/legal/terms">Legal</Link>
    </nav>
    <div className="flex items-center gap-3">
      <Link href="/auth/sign-in" className="text-sm">Ingresar</Link>
      <Button size="sm">Publicar</Button>
    </div>
  </header>
);
