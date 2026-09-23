import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chonk Gallery - Google Drive Sync & Video Gallery',
  description: 'Shared video & asset gallery synchronized live with Google Drive workspace.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
