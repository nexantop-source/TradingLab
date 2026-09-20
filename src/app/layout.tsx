import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { THEME_INIT_SCRIPT } from '@tl/ui/theme-bootstrap';
import { LEGAL_ENTITY_DESCRIPTOR } from '@tl/types/compliance';
import { AdPrivacyBanner } from '@/components/ads/AdPrivacy';
import { PwaRuntime } from '@/components/pwa/PwaRuntime';
import { APP_MODE_INIT_SCRIPT } from '@/components/pwa/appMode';
import './globals.css';
import './investment.css';
import './instrument-icons.css';
import './marketing-visuals.css';
import './mobile-app.css';
import './native-app.css';
import './native-home.css';
import './native-gestures.css';
import './welcome-scenes.css';
import './live-chart.css';
import './simple-terminal.css';
import './app-refinement.css';
import './auth-refresh.css';
import './checkout-refresh.css';

const sans = localFont({
  src: '../../identidad visual/fuentes/instrument-sans-latin.woff2',
  variable: '--font-instrument-sans',
  weight: '400 700',
  display: 'swap',
});

const serif = localFont({
  src: [
    {
      path: '../../identidad visual/fuentes/instrument-serif-regular-latin.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../identidad visual/fuentes/instrument-serif-italic-latin.woff2',
      weight: '400',
      style: 'italic',
    },
  ],
  variable: '--font-instrument-serif',
  display: 'swap',
});

const mono = localFont({
  src: '../../identidad visual/fuentes/jetbrains-mono-latin.woff2',
  variable: '--font-jetbrains-mono',
  weight: '100 800',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'TradingLab',
    template: '%s · TradingLab',
  },
  description:
    'Practica con USD 10.000 virtuales, estudia Forex, criptomonedas, acciones y otros mercados, y mejora cada decisión con análisis educativo impulsado por inteligencia artificial. Plataforma exclusivamente educativa y de simulación.',
  applicationName: 'TradingLab',
  keywords: [
    'educación financiera',
    'simulador de trading',
    'aprender forex',
    'análisis técnico',
    'gestión del riesgo',
    'cuenta demo educativa',
  ],
  authors: [{ name: 'TradingLab' }],
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    siteName: 'TradingLab',
    title: 'Aprende a decidir antes de arriesgar',
    description: `${LEGAL_ENTITY_DESCRIPTOR}. Simulación con dinero virtual, academia estructurada y análisis educativo con IA.`,
  },
  robots: { index: true, follow: true },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/app-icon/192', apple: '/app-icon/180' },
  appleWebApp: { capable: true, title: 'TradingLab', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#070A12' },
    { media: '(prefers-color-scheme: light)', color: '#F7F9FC' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-theme="light" data-theme-preference="system" suppressHydrationWarning>
      <head>
        {/* Aplica el tema antes del primer pintado para evitar el destello. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: APP_MODE_INIT_SCRIPT }} />
      </head>
      <body className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
        <a href="#contenido" className="skip-link">
          Saltar al contenido principal
        </a>
        {children}
        <PwaRuntime />
        <AdPrivacyBanner />
      </body>
    </html>
  );
}
