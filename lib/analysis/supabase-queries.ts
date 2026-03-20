import { supabaseAdmin } from '@/lib/supabase';
import type {
  AnalysisProfile,
  AnalysisProfileWithCounts,
  AnalysisSoulDocument,
  AnalysisMonitoringConfig,
  AnalysisDataItem,
  AnalysisConversation,
  AnalysisFocusedFolder,
  AnalysisSourceRegistry,
} from './types';

// ── Profile Queries ─────────────────────────────────────────────────

export async function createProfile(input: {
  org_id: string;
  full_name: string;
  position_type: string;
  party?: string;
  state?: string;
  district?: string;
  court?: string;
  organization?: string;
  aliases?: string[];
  profile_type?: string;
  parent_profile_id?: string;
  title?: string;
}): Promise<AnalysisProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('analysis_profiles')
    .insert({
      org_id: input.org_id,
      full_name: input.full_name,
      position_type: input.position_type,
      party: input.party || null,
      state: input.state || null,
      district: input.district || null,
      court: input.court || null,
      organization: input.organization || null,
      aliases: input.aliases || [],
      profile_type: input.profile_type || 'primary',
      parent_profile_id: input.parent_profile_id || null,
      title: input.title || null,
    })
    .select()
    .single();
  if (error) {
    console.error('[createProfile] error:', error.message);
    return null;
  }
  return data as AnalysisProfile;
}

export async function getProfile(profileId: string): Promise<AnalysisProfile | null> {
  const { data } = await supabaseAdmin
    .from('analysis_profiles')
    .select('*')
    .eq('id', profileId)
    .single();
  return data as AnalysisProfile | null;
}

export async function getOrgProfiles(orgId: string): Promise<AnalysisProfileWithCounts[]> {
  const { data: profiles } = await supabaseAdmin
    .from('analysis_profiles')
    .select('*')
    .eq('org_id', orgId)
    .eq('profile_type', 'primary')
    .order('updated_at', { ascending: false });

  if (!profiles || profiles.length === 0) return [];

  const profileIds = profiles.map(p => p.id);

  // Get data item counts
  const { data: itemCounts } = await supabaseAdmin
    .from('analysis_data_items')
    .select('profile_id')
    .in('profile_id', profileIds);

  // Get unverified counts
  const { data: unverifiedCounts } = await supabaseAdmin
    .from('analysis_data_items')
    .select('profile_id')
    .in('profile_id', profileIds)
    .eq('verification_status', 'unverified');

  const itemCountMap = new Map<string, number>();
  const unverifiedCountMap = new Map<string, number>();

  (itemCounts || []).forEach(item => {
    itemCountMap.set(item.profile_id, (itemCountMap.get(item.profile_id) || 0) + 1);
  });
  (unverifiedCounts || []).forEach(item => {
    unverifiedCountMap.set(item.profile_id, (unverifiedCountMap.get(item.profile_id) || 0) + 1);
  });

  return (profiles as AnalysisProfile[]).map(p => ({
    ...p,
    data_item_count: itemCountMap.get(p.id) || 0,
    unverified_count: unverifiedCountMap.get(p.id) || 0,
  }));
}

export async function updateProfile(
  profileId: string,
  updates: Partial<Pick<AnalysisProfile, 'full_name' | 'title' | 'party' | 'state' | 'district' | 'court' | 'organization' | 'aliases' | 'avatar_url' | 'research_status'>>
): Promise<AnalysisProfile | null> {
  const { data } = await supabaseAdmin
    .from('analysis_profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', profileId)
    .select()
    .single();
  return data as AnalysisProfile | null;
}

// ── Soul Document Queries ───────────────────────────────────────────

export async function createSoulDocument(profileId: string, orgId: string): Promise<AnalysisSoulDocument | null> {
  const { data } = await supabaseAdmin
    .from('analysis_soul_documents')
    .insert({
      profile_id: profileId,
      org_id: orgId,
      content: {},
      version: 1,
    })
    .select()
    .single();
  return data as AnalysisSoulDocument | null;
}

export async function getSoulDocument(profileId: string): Promise<AnalysisSoulDocument | null> {
  const { data } = await supabaseAdmin
    .from('analysis_soul_documents')
    .select('*')
    .eq('profile_id', profileId)
    .single();
  return data as AnalysisSoulDocument | null;
}

// ── Monitoring Config Queries ───────────────────────────────────────

export async function createMonitoringConfig(profileId: string, orgId: string): Promise<AnalysisMonitoringConfig | null> {
  const { data } = await supabaseAdmin
    .from('analysis_monitoring_configs')
    .insert({
      profile_id: profileId,
      org_id: orgId,
      frequency: 'daily',
      search_queries: [],
      is_active: true,
    })
    .select()
    .single();
  return data as AnalysisMonitoringConfig | null;
}

// ── Source Registry Queries ─────────────────────────────────────────

export async function getOrgSources(orgId: string): Promise<AnalysisSourceRegistry[]> {
  const { data } = await supabaseAdmin
    .from('analysis_source_registry')
    .select('*')
    .eq('org_id', orgId)
    .order('trust_level')
    .order('source_name');
  return (data || []) as AnalysisSourceRegistry[];
}

export async function seedOrgSources(orgId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('seed_analysis_org_sources', {
    p_org_id: orgId,
  });
  if (error) {
    console.error('[seedOrgSources] error:', error.message);
  }
}

// ── Data Item Queries ───────────────────────────────────────────────

export async function getProfileDataItems(
  profileId: string,
  options?: { category?: string; verification_status?: string; limit?: number; offset?: number }
): Promise<AnalysisDataItem[]> {
  let query = supabaseAdmin
    .from('analysis_data_items')
    .select('*')
    .eq('profile_id', profileId)
    .order('item_date', { ascending: false, nullsFirst: false });

  if (options?.category) query = query.eq('category', options.category);
  if (options?.verification_status) query = query.eq('verification_status', options.verification_status);
  if (options?.limit) query = query.limit(options.limit);
  if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 20) - 1);

  const { data } = await query;
  return (data || []) as AnalysisDataItem[];
}
