import type { Metadata } from 'next';
import { getRobotsForPage } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Acceso',
  robots: getRobotsForPage(false)
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}

