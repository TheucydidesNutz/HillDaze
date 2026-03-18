import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Covaled Intelligence',
  description: 'AI-powered policy intelligence and strategic advisory platform.',
};

export default function IntelRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
