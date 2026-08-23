import type { Metadata, Viewport } from 'next';
import { Figtree, Noto_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ErrorBoundary } from '@/components/ui/error-boundary';

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const notoSans = Noto_Sans({
  subsets: ['latin'],
  variable: '--font-noto',
  weight: ['300', '400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Jeevandata — Smart Clinic Intake',
    template: '%s | Jeevandata',
  },
  description:
    'AI-powered smart clinic intake system with face recognition and conversational voice intake',
  keywords: ['clinic', 'intake', 'AI', 'face recognition', 'healthcare', 'telemedicine'],
  authors: [{ name: 'Jeevandata' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Jeevandata',
  },
  formatDetection: {
    telephone: true,
    address: false,
    email: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'Jeevandata',
    title: 'Jeevandata — Smart Clinic Intake',
    description:
      'AI-powered smart clinic intake system with face recognition and conversational voice intake',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0F1E' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${notoSans.variable}`} suppressHydrationWarning>
      <head>
        {/* ─── Flash Prevention: applies dark class before paint ──── */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('jeevandata-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (theme !== 'light' && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="bg-background min-h-screen font-sans antialiased">
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
