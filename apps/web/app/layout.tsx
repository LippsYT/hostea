import './globals.css';
import type { Metadata } from 'next';
import { Newsreader, Space_Grotesk } from 'next/font/google';
import { Providers } from '@/components/providers';

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
  description: 'Plataforma tipo Airbnb para reservas, pagos y gestion de propiedades.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${display.variable} ${body.variable} font-body`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
