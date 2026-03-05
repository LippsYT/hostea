import './globals.css';
import './theme.css';
import type { Metadata, Viewport } from 'next';
import { Newsreader, Space_Grotesk } from 'next/font/google';
import { Providers } from '@/components/providers';
import { PwaRegister } from '@/components/pwa-register';

const display = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '600'],
  adjustFontFallback: false
});
const body = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600'],
  adjustFontFallback: false
});

export const metadata: Metadata = {
  title: 'HOSTEA | Hospedajes premium',
  description: 'Plataforma tipo Airbnb para reservas, pagos y gestion de propiedades.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon.png?v=1', type: 'image/png', sizes: '32x32' },
      { url: '/brand/hostea_nav_32.png?v=1', type: 'image/png', sizes: '32x32' }
    ],
    shortcut: ['/icon.png?v=1'],
    apple: [{ url: '/brand/hostea_nav_32.png?v=1', type: 'image/png' }]
  }
};

export const viewport: Viewport = {
  themeColor: '#ff4d8d'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${display.variable} ${body.variable} font-body relative min-h-screen`}>
        <div aria-hidden className="hostea-bg">
          <div className="hostea-blob-1" />
          <div className="hostea-blob-2" />
          <div className="hostea-blob-3" />
        </div>
        <div className="relative z-10">
          <Providers>
            <PwaRegister />
            {children}
          </Providers>
        </div>
      </body>
    </html>
  );
}
