import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Area',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
