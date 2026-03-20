import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = request.nextUrl;
  const profileId = url.searchParams.get('profile_id');
  const orgId = url.searchParams.get('org_id');
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');
  const verificationStatus = url.searchParams.get('verification_status');
  const sourceTrustLevel = url.searchParams.get('source_trust_level');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  if (!profileId || !orgId) {
    return NextResponse.json({ error: 'profile_id and org_id are required' }, { status: 400 });
  }

  // Validate membership
  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Build query
  let query = supabaseAdmin
    .from('analysis_data_items')
    .select('id, profile_id, org_id, category, subcategory, title, summary, key_quotes, key_topics, source_url, source_name, source_trust_level, item_date, venue, context, tone_analysis, folder_path, storage_tier, original_filename, file_size_bytes, verification_status, anomaly_flags, created_at, updated_at', { count: 'exact' })
    .eq('profile_id', profileId)
    .eq('org_id', orgId)
    .order('item_date', { ascending: false, nullsFirst: false });

  if (category) query = query.eq('category', category);
  if (verificationStatus) query = query.eq('verification_status', verificationStatus);
  if (sourceTrustLevel) query = query.eq('source_trust_level', sourceTrustLevel);
  if (search) {
    // Use ilike for search across title and summary
    query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[data-items] query error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch data items' }, { status: 500 });
  }

  // Get category counts for this profile
  const { data: allItems } = await supabaseAdmin
    .from('analysis_data_items')
    .select('category')
    .eq('profile_id', profileId)
    .eq('org_id', orgId);

  const categoryCounts: Record<string, number> = {};
  (allItems || []).forEach(item => {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  });

  return NextResponse.json({
    items: data || [],
    total: count || 0,
    category_counts: categoryCounts,
  });
}
