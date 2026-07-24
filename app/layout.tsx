import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import '../styles/globals.css'
import { Providers } from '@/providers/Providers'
import { CookieBanner } from '@/components/legal/CookieBanner'
import { InstallAppBanner } from '@/components/pwa/InstallAppBanner'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const SITE_URL = 'https://precyplus.com.br'
const SITE_DESCRIPTION = 'Sistema de Gestão e Precificação para Pequenos Negócios.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Precy+',
    template: '%s | Precy+',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'Precy+',
  keywords: ['precificação', 'gestão', 'artesanato', 'papelaria', 'financeiro'],
  authors: [{ name: 'Precy+' }],
  creator: 'Precy+',
  // favicon e apple-touch-icon são gerados pela convenção nativa do Next
  // (app/icon.tsx e app/apple-icon.tsx) — não declarar `icons` aqui para
  // não conflitar com as tags que o próprio Next já injeta.
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Precy+',
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: 'Precy+',
    description: SITE_DESCRIPTION,
    type: 'website',
    locale: 'pt_BR',
    url: SITE_URL,
    siteName: 'Precy+',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Precy+',
    description: SITE_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF7F4' },
    { media: '(prefers-color-scheme: dark)', color: '#1C1714' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
        <CookieBanner />
        <InstallAppBanner />
      </body>
    </html>
  )
}
