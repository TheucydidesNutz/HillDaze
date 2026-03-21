'use client';

import { AnalysisUploadProvider } from '@/components/analysis/AnalysisUploadContext';
import { AnalysisUploadIndicator } from '@/components/analysis/AnalysisUploadIndicator';

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AnalysisUploadProvider>
      {children}
      <AnalysisUploadIndicator />
    </AnalysisUploadProvider>
  );
}
