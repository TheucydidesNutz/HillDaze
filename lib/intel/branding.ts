import type { BrandingConfig } from './types';

export function getBrandingStyles(branding: BrandingConfig): React.CSSProperties {
  return {
    '--intel-bg': branding.background_color,
    '--intel-text': branding.text_color,
    '--intel-primary': branding.primary_color,
  } as React.CSSProperties;
}
