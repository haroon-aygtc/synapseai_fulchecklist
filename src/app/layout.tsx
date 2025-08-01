import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth/auth-context';
import { Toaster } from '@/components/ui/toaster';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SynapseAI - Enterprise AI Orchestration Platform',
  description: 'Production-grade platform for building, deploying, and managing AI agents with real-time orchestration capabilities.',
  keywords: 'AI, orchestration, agents, enterprise, automation, workflows',
  authors: [{ name: 'SynapseAI Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
  openGraph: {
    title: 'SynapseAI - Enterprise AI Orchestration Platform',
    description: 'Production-grade platform for building, deploying, and managing AI agents with real-time orchestration capabilities.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SynapseAI - Enterprise AI Orchestration Platform',
    description: 'Production-grade platform for building, deploying, and managing AI agents with real-time orchestration capabilities.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script src="https://api.tempo.build/proxy-asset?url=https://storage.googleapis.com/tempo-public-assets/error-handling.js" />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}