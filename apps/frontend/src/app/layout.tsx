import type { Metadata } from 'next';
import '@/styles/globals.css';
import { RootToaster } from './root-toaster';

export const metadata: Metadata = {
  title: 'MASSVISION Reap3r - Enterprise Hypervision',
  description: 'Enterprise-grade Hypervision & Remote Operations Platform',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <RootToaster />
      </body>
    </html>
  );
}
