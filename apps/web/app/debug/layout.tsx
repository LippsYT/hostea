import type { Metadata } from 'next';
import { getRobotsForPage } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Debug',
  robots: getRobotsForPage(false)
};

export default function DebugLayout({ children }: { children: React.ReactNode }) {
  return children;
}

