import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { StoreHydration } from '@/components/layout/StoreHydration';
import './globals.css';

// The ₦ glyph is in the latin-ext subset, not latin.
const geist = Geist({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-geist',
});
const geistMono = Geist_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: { default: 'Revenue Platform', template: '%s · Revenue Platform' },
  description: 'Revenue tracking and reconciliation for MTN product teams.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <StoreHydration />
        {children}
      </body>
    </html>
  );
}
