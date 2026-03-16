import type { Metadata } from 'next';
import { getRobotsForPage } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Publicar',
  robots: getRobotsForPage(false)
};

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return children;
}

