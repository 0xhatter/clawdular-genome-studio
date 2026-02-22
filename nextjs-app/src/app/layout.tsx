import type { Metadata } from 'next';
import { Press_Start_2P } from 'next/font/google';
import '@/styles/globals.css';

const pressStart2P = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-press-start',
});

export const metadata: Metadata = {
  title: 'Clawdular Genome Studio',
  description: 'The Skill DNA Sequencer for AI Automation Workflows',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${pressStart2P.variable} h-screen overflow-hidden bg-bg-primary text-text-primary font-mono`}>
        {children}
      </body>
    </html>
  );
}
