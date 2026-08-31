import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FlowDesk — Freelancer Operating System',
  description: 'FlowDesk is a premium Freelancer Operating System with crystal glass UI architecture.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body
        className="bg-[#09090b] text-white min-h-screen font-sans selection:bg-white selection:text-zinc-950 antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
