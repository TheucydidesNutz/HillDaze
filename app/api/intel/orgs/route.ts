import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMemberships, createOrg, addOrgMember, createSoulDocument } from '@/lib/intel/supabase-queries';
import { DEFAULT_BRANDING, DEFAULT_ORG_SETTINGS, SOUL_DOCUMENT_TEMPLATE } from '@/lib/intel/constants';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const memberships = await getUserOrgMemberships(user.id);
  return NextResponse.json(memberships);
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, slug } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'Slug must contain only lowercase letters, numbers, and hyphens' }, { status: 400 });
  }

  // Create the org
  const org = await createOrg({
    name,
    slug,
    branding: DEFAULT_BRANDING,
    created_by: user.id,
  });

  if (!org) {
    return NextResponse.json({ error: 'Failed to create organization. Slug may already be in use.' }, { status: 400 });
  }

  // Add creator as super_admin
  await addOrgMember({
    org_id: org.id,
    user_id: user.id,
    role: 'super_admin',
    display_name: user.user_metadata?.display_name || user.email || 'Admin',
    title: user.user_metadata?.role || null,
    company: user.user_metadata?.company || null,
  });

  // Create default soul document
  await createSoulDocument({
    org_id: org.id,
    content: SOUL_DOCUMENT_TEMPLATE,
    updated_by: user.id,
  });

  // Create default document folders
  await supabaseAdmin.from('intel_document_folders').insert([
    {
      org_id: org.id,
      name: 'Deep Dive',
      slug: 'deep-dive',
      folder_type: 'deep_dive',
      description: 'Full analytical documents the Intelligence Analyst can read in their entirety. Upload legislation, regulations, academic papers, industry reports, and detailed policy analyses.',
      sort_order: 0,
      created_by: user.id,
    },
    {
      org_id: org.id,
      name: 'Reference',
      slug: 'reference',
      folder_type: 'reference',
      description: 'Tone and style reference materials. Upload past op-eds, position papers, testimony transcripts, and writing samples. The AI reads these for voice and framing, not detailed analysis.',
      sort_order: 1,
      created_by: user.id,
    },
  ]);

  return NextResponse.json(org, { status: 201 });
}
