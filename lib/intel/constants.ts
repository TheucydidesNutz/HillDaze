import type { BrandingConfig } from './types';

export const INTEL_ROLES = ['super_admin', 'admin', 'user', 'viewer'] as const;

export const DEFAULT_BRANDING: BrandingConfig = {
  logo_url: null,
  background_color: '#1a1a2e',
  text_color: '#e0e0e0',
  primary_color: '#3b82f6',
  tagline: null,
};

export const ROLE_PERMISSIONS = {
  super_admin: ['all'],
  admin: ['chat', 'upload_docs', 'view_all', 'request_drafts', 'approve_proposals', 'manage_feeds', 'manage_branding'],
  user: ['chat', 'upload_docs', 'view_all', 'request_drafts'],
  viewer: ['view_all'],
} as const;

export const DEFAULT_ORG_SETTINGS = {
  notification_prefs: {},
  default_model: 'claude-sonnet-4-6',
  max_daily_api_calls: 100,
  auto_monthly_report: false,
};

export const SOUL_DOCUMENT_TEMPLATE = `# Organization Constitution

## Mission
[Define your organization's core mission and purpose]

## Priority Policy Areas
1. [Primary focus area]
2. [Secondary focus area]
3. [Tertiary focus area]

## Tone & Voice
[Describe your desired communication style]

## In-Scope Topics
- [Topic 1]
- [Topic 2]

## Out-of-Scope Topics
- [Topic 1]

## Strategic Objectives
1. [Short-term objective]
2. [Medium-term objective]
3. [Long-term objective]

## Current Campaigns
- [Active campaign 1]
`;
