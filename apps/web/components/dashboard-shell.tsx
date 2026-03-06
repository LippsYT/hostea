'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';

type NavItem = { key: string; href: string; label: string };

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

  const activeKey = useMemo(() => {
    const sorted = [...navItems].sort((a, b) => b.href.length - a.href.length);
    const matched = sorted.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    );
    return matched?.key || null;
  }, [pathname, navItems]);

  const handleSignOut = () => {
    void signOut({ callbackUrl: '/' });
  };

  return (
    <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-slate-200/70 bg-white/80 p-6 backdrop-blur md:block">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-900">
            <Image src="/brand/hostea-logo.jpeg" alt="Hostea" width={28} height={28} className="h-7 w-7 rounded-lg" />
            <span>HOSTEA</span>
          </Link>
          <span className="rounded-full bg-fuchsia-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-700">
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
            const active = item.key === activeKey;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center justify-between rounded-full px-4 py-2 transition ${
                  active
                    ? 'brand-gradient-bg text-white'
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
        <div className="mt-6 border-t border-slate-200/70 pt-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-between rounded-full px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <span>Cerrar sesion</span>
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
          </button>
        </div>
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
                className="brand-gradient-bg flex-1 rounded-full px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-white sm:flex-none"
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
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900" onClick={() => setMobileOpen(false)}>
              <Image src="/brand/hostea-logo.jpeg" alt="Hostea" width={24} height={24} className="h-6 w-6 rounded-md" />
              <span>HOSTEA</span>
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
              const active = item.key === activeKey;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`block rounded-full px-4 py-2 transition ${
                    active
                      ? 'brand-gradient-bg text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-5 border-t border-slate-200/70 pt-4">
            <button
              type="button"
              onClick={handleSignOut}
              className="block w-full rounded-full px-4 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              Cerrar sesion
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
