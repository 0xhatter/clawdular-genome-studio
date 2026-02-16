import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Clawdular Genome Studio',
  description: 'The Evolutionary Modular Synthesizer for AI Skills',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden bg-bg-primary text-text-primary font-mono">
        {children}
      </body>
    </html>
  );
}
