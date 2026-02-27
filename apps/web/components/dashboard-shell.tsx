'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type NavItem = { href: string; label: string };

const isActiveRoute = (pathname: string, href: string) => {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
};

export const DashboardShell = ({
  navItems,
  displayName,
  roleLabel,
  children
}: {
  navItems: NavItem[];
  displayName: string;
  roleLabel: string;
  children: React.ReactNode;
}) => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const activeMap = useMemo(() => {
    const map = new Map<string, boolean>();
    navItems.forEach((item) => map.set(item.href, isActiveRoute(pathname, item.href)));
    return map;
  }, [pathname, navItems]);

  return (
    <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-slate-200/70 bg-white/80 p-6 backdrop-blur md:block">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            HOSTEA
          </Link>
          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Pro
          </span>
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200/70 bg-white/70 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Cuenta</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{displayName}</p>
          <p className="text-xs text-slate-500">{roleLabel}</p>
        </div>
        <nav className="mt-6 space-y-1 text-sm">
          {navItems.map((item) => {
            const active = activeMap.get(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-full px-4 py-2 transition ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{item.label}</span>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    active ? 'bg-white/80' : 'bg-slate-200'
                  }`}
                />
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 text-slate-700 transition hover:bg-slate-100 md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Panel</p>
                <h1 className="text-xl font-semibold text-slate-900">HOSTEA Studio</h1>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <Link
                href="/"
                className="flex-1 rounded-full border border-slate-200/70 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50 sm:flex-none"
              >
                Ir al sitio
              </Link>
              <Link
                href="/auth/sign-in"
                className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-800 sm:flex-none"
              >
                Cambiar cuenta
              </Link>
            </div>
          </div>
        </header>
        <main className="px-4 pb-16 pt-8 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      <div
        className={`fixed inset-0 z-40 md:hidden ${
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        <button
          type="button"
          aria-label="Cerrar menu"
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            mobileOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={`absolute inset-y-0 left-0 w-72 rounded-r-2xl bg-white p-5 shadow-2xl transition-transform ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight" onClick={() => setMobileOpen(false)}>
              HOSTEA
            </Link>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-100"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Cuenta</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="text-xs text-slate-500">{roleLabel}</p>
          </div>

          <nav className="mt-5 space-y-1 text-sm">
            {navItems.map((item) => {
              const active = activeMap.get(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-full px-4 py-2 transition ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
      </div>
    </div>
  );
};
