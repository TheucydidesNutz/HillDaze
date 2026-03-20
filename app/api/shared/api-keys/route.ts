import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getOrgApiKeysMasked, setOrgApiKey, SUPPORTED_SERVICES } from '@/lib/shared/org-api-keys';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = request.nextUrl.searchParams.get('org_id');
  if (!orgId) return NextResponse.json({ error: 'org_id required' }, { status: 400 });

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const keys = await getOrgApiKeysMasked(orgId);

  return NextResponse.json({
    keys,
    supported_services: SUPPORTED_SERVICES,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { org_id, service_name, api_key } = body;

  if (!org_id || !service_name || !api_key) {
    return NextResponse.json({ error: 'org_id, service_name, and api_key required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'admin' && member.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validate service name
  const validService = SUPPORTED_SERVICES.find(s => s.service_name === service_name);
  if (!validService) {
    return NextResponse.json({ error: 'Invalid service_name' }, { status: 400 });
  }

  const success = await setOrgApiKey(org_id, service_name, api_key);
  if (!success) return NextResponse.json({ error: 'Failed to save key' }, { status: 500 });

  return NextResponse.json({ success: true }, { status: 201 });
}
