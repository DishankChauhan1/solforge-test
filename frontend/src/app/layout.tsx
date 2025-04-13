import { Inter } from 'next/font/google';
import { ClientLayout } from '@/components/ClientLayout';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'SolForge - Open Source Bounties',
  description: 'Accelerate open source development with crypto bounties',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
} 