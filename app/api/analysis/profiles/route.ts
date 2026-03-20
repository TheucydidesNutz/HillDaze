import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { createProfile, createSoulDocument, createMonitoringConfig } from '@/lib/analysis/supabase-queries';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { org_id, full_name, position_type, party, state, district, court, organization, aliases, profile_type, parent_profile_id, title } = body;

  if (!org_id || !full_name || !position_type) {
    return NextResponse.json({ error: 'org_id, full_name, and position_type are required' }, { status: 400 });
  }

  // Verify membership
  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Create profile
  const profile = await createProfile({
    org_id,
    full_name,
    position_type,
    party,
    state,
    district,
    court,
    organization,
    aliases: aliases || [],
    profile_type: profile_type || 'primary',
    parent_profile_id: parent_profile_id || undefined,
    title: title || undefined,
  });

  if (!profile) {
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }

  // Create empty soul document
  await createSoulDocument(profile.id, org_id);

  // Create default monitoring config
  await createMonitoringConfig(profile.id, org_id);

  return NextResponse.json({ profile }, { status: 201 });
}
