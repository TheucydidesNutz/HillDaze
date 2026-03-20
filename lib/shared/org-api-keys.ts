import { supabaseAdmin } from '@/lib/supabase';

export interface OrgApiKey {
  id: string;
  org_id: string;
  service_name: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get an active API key for a specific service and org.
 * Returns the full key for server-side use.
 * Returns null if no key is configured or key is inactive.
 */
export async function getOrgApiKey(
  orgId: string,
  serviceName: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('org_api_keys')
    .select('api_key, is_active')
    .eq('org_id', orgId)
    .eq('service_name', serviceName)
    .single();

  if (!data || !data.is_active) return null;
  return data.api_key;
}

/**
 * Get all API keys for an org (masked for frontend display).
 * Only returns last 4 characters of the key.
 */
export async function getOrgApiKeysMasked(
  orgId: string
): Promise<Array<{ id: string; service_name: string; is_active: boolean; masked_key: string; created_at: string; updated_at: string }>> {
  const { data } = await supabaseAdmin
    .from('org_api_keys')
    .select('id, service_name, api_key, is_active, created_at, updated_at')
    .eq('org_id', orgId)
    .order('service_name');

  return (data || []).map(k => ({
    id: k.id,
    service_name: k.service_name,
    is_active: k.is_active,
    masked_key: '••••••••' + k.api_key.slice(-4),
    created_at: k.created_at,
    updated_at: k.updated_at,
  }));
}

/**
 * Set (upsert) an API key for a service.
 */
export async function setOrgApiKey(
  orgId: string,
  serviceName: string,
  apiKey: string
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('org_api_keys')
    .upsert(
      { org_id: orgId, service_name: serviceName, api_key: apiKey, is_active: true },
      { onConflict: 'org_id,service_name' }
    );
  return !error;
}

/**
 * Remove an API key.
 */
export async function removeOrgApiKey(keyId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('org_api_keys')
    .delete()
    .eq('id', keyId);
  return !error;
}

/**
 * Toggle active status.
 */
export async function toggleOrgApiKey(keyId: string, isActive: boolean): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('org_api_keys')
    .update({ is_active: isActive })
    .eq('id', keyId);
  return !error;
}

/**
 * Service registry — all supported services with metadata.
 */
export const SUPPORTED_SERVICES = [
  {
    service_name: 'congress_gov',
    display_name: 'Congress.gov API',
    description: 'Bills, votes, members, Congressional Record. Free API key from api.congress.gov.',
    category: 'government',
    is_free: true,
    signup_url: 'https://api.congress.gov/sign-up/',
    used_by: ['analysis', 'intel'],
  },
  {
    service_name: 'opensecrets',
    display_name: 'OpenSecrets API',
    description: 'Campaign finance, donations, PAC data. Free API key from opensecrets.org.',
    category: 'government',
    is_free: true,
    signup_url: 'https://www.opensecrets.org/api/admin/index.php?function=signup',
    used_by: ['analysis'],
  },
  {
    service_name: 'courtlistener',
    display_name: 'CourtListener API',
    description: 'Legal opinions, court filings, judge records. Free API token from courtlistener.com.',
    category: 'legal',
    is_free: true,
    signup_url: 'https://www.courtlistener.com/sign-in/',
    used_by: ['analysis'],
  },
  {
    service_name: 'pacer',
    display_name: 'PACER',
    description: 'Federal court electronic records. $0.10 per page, fees may apply.',
    category: 'legal',
    is_free: false,
    signup_url: 'https://pacer.uscourts.gov/register-account',
    used_by: ['analysis'],
  },
  {
    service_name: 'listen_notes',
    display_name: 'Listen Notes API',
    description: 'Podcast search and episode data. Free tier available.',
    category: 'media',
    is_free: true,
    signup_url: 'https://www.listennotes.com/api/',
    used_by: ['analysis'],
  },
] as const;
