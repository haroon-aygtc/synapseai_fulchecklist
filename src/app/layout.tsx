import { ThemeProvider } from '@/components/theme-provider';
import Script from "next/script";
import { ApixProvider } from '@/lib/apix';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ApixProvider autoConnect={true}>
            {children}
          </ApixProvider>
        </ThemeProvider>
        <Script src="https://api.tempo.build/proxy-asset?url=https://storage.googleapis.com/tempo-public-assets/error-handling.js" />
      </body>
    </html>
  );
}