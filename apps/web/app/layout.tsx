import './globals.css';
import './theme.css';
import type { Metadata, Viewport } from 'next';
import { Newsreader, Space_Grotesk } from 'next/font/google';
import { StructuredDataScript } from '@/components/structured-data-script';
import { Providers } from '@/components/providers';
import { PwaRegister } from '@/components/pwa-register';
import {
  createMetadataBase,
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE,
  DEFAULT_TITLE,
  getRobotsForPage,
  SITE_LOCALE,
  SITE_NAME,
  TITLE_TEMPLATE
} from '@/lib/seo';
import { buildOrganizationJsonLd, buildWebsiteJsonLd } from '@/lib/structured-data';
import { buildAbsoluteUrl } from '@/lib/url';

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
  metadataBase: createMetadataBase(),
  title: {
    default: DEFAULT_TITLE,
    template: TITLE_TEMPLATE
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: DEFAULT_KEYWORDS,
  authors: [{ name: SITE_NAME, url: buildAbsoluteUrl('/') }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  openGraph: {
    type: 'website',
    locale: SITE_LOCALE,
    url: buildAbsoluteUrl('/'),
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: buildAbsoluteUrl(DEFAULT_OG_IMAGE), alt: SITE_NAME }]
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [buildAbsoluteUrl(DEFAULT_OG_IMAGE)]
  },
  robots: getRobotsForPage(true),
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png'
  }
};

export const viewport: Viewport = {
  themeColor: '#ff4d8d'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/icon.png" sizes="any" />
      </head>
      <body className={`${display.variable} ${body.variable} font-body relative min-h-screen`}>
        <StructuredDataScript data={[buildOrganizationJsonLd(), buildWebsiteJsonLd()]} />
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

