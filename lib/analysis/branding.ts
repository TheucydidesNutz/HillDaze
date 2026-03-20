import type { BrandingConfig } from '@/lib/intel/types';

export function getAnalysisBrandingStyles(branding: BrandingConfig): React.CSSProperties {
  return {
    '--analysis-bg': branding.background_color,
    '--analysis-text': branding.text_color,
    '--analysis-primary': branding.primary_color,
  } as React.CSSProperties;
}
