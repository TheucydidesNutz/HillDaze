import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Covaled Analysis',
  description: 'Person profiling and communication intelligence',
};

export default function AnalysisRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
