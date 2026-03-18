import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import type { IntelOrg, IntelOrgMember, IntelMemberRole, BrandingConfig, IntelSoulDocument, IntelDocument, DocumentSummaryMetadata, IntelConversation, ChatMessage, ConversationSummary } from './types';

// ── Org Queries ─────────────────────────────────────────────────────

export async function getOrgBySlug(slug: string): Promise<IntelOrg | null> {
  const { data } = await supabaseAdmin
    .from('intel_organizations')
    .select('*')
    .eq('slug', slug)
    .single();
  return data as IntelOrg | null;
}

export async function getOrgById(orgId: string): Promise<IntelOrg | null> {
  const { data } = await supabaseAdmin
    .from('intel_organizations')
    .select('*')
    .eq('id', orgId)
    .single();
  return data as IntelOrg | null;
}

export async function createOrg(input: {
  name: string;
  slug: string;
  branding?: Partial<BrandingConfig>;
  created_by: string;
}): Promise<IntelOrg | null> {
  const { data, error } = await supabaseAdmin
    .from('intel_organizations')
    .insert({
      name: input.name,
      slug: input.slug,
      ...(input.branding ? { branding: input.branding } : {}),
    })
    .select()
    .single();

  if (error || !data) return null;
  return data as IntelOrg;
}

export async function updateOrgBranding(
  orgId: string,
  branding: BrandingConfig
): Promise<IntelOrg | null> {
  const { data } = await supabaseAdmin
    .from('intel_organizations')
    .update({ branding })
    .eq('id', orgId)
    .select()
    .single();
  return data as IntelOrg | null;
}

export async function updateOrgSettings(
  orgId: string,
  settings: Record<string, unknown>
): Promise<IntelOrg | null> {
  const { data } = await supabaseAdmin
    .from('intel_organizations')
    .update({ settings })
    .eq('id', orgId)
    .select()
    .single();
  return data as IntelOrg | null;
}

// ── Member Queries ──────────────────────────────────────────────────

export async function getUserOrgMemberships(
  userId: string
): Promise<(IntelOrgMember & { org: IntelOrg })[]> {
  const { data } = await supabaseAdmin
    .from('intel_org_members')
    .select('*, org:intel_organizations(*)')
    .eq('user_id', userId);
  return (data || []) as (IntelOrgMember & { org: IntelOrg })[];
}

export async function getOrgMembers(orgId: string): Promise<IntelOrgMember[]> {
  const { data } = await supabaseAdmin
    .from('intel_org_members')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at');
  return (data || []) as IntelOrgMember[];
}

export async function getUserOrgMembership(
  orgId: string,
  userId: string
): Promise<IntelOrgMember | null> {
  const { data } = await supabaseAdmin
    .from('intel_org_members')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .single();
  return data as IntelOrgMember | null;
}

export async function addOrgMember(input: {
  org_id: string;
  user_id: string;
  role: IntelMemberRole;
  display_name: string;
  title?: string;
  company?: string;
  phone?: string;
  invited_by?: string;
}): Promise<IntelOrgMember | null> {
  const { data } = await supabaseAdmin
    .from('intel_org_members')
    .insert(input)
    .select()
    .single();
  return data as IntelOrgMember | null;
}

export async function updateMemberRole(
  memberId: string,
  role: IntelMemberRole
): Promise<IntelOrgMember | null> {
  const { data } = await supabaseAdmin
    .from('intel_org_members')
    .update({ role })
    .eq('id', memberId)
    .select()
    .single();
  return data as IntelOrgMember | null;
}

export async function removeMember(memberId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('intel_org_members')
    .delete()
    .eq('id', memberId);
  return !error;
}

// ── Soul Document Queries ───────────────────────────────────────────

export async function createSoulDocument(input: {
  org_id: string;
  content: string;
  updated_by: string;
}): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('intel_soul_documents')
    .insert({
      org_id: input.org_id,
      content: input.content,
      version: 1,
      updated_by: input.updated_by,
    });
  return !error;
}

export async function getLatestSoulDocument(orgId: string): Promise<IntelSoulDocument | null> {
  const { data } = await supabaseAdmin
    .from('intel_soul_documents')
    .select('*')
    .eq('org_id', orgId)
    .order('version', { ascending: false })
    .limit(1)
    .single();
  return data as IntelSoulDocument | null;
}

export async function saveSoulDocumentVersion(input: {
  org_id: string;
  content: string;
  updated_by: string;
}): Promise<IntelSoulDocument | null> {
  const current = await getLatestSoulDocument(input.org_id);
  const nextVersion = current ? current.version + 1 : 1;

  const { data } = await supabaseAdmin
    .from('intel_soul_documents')
    .insert({
      org_id: input.org_id,
      content: input.content,
      version: nextVersion,
      updated_by: input.updated_by,
    })
    .select()
    .single();
  return data as IntelSoulDocument | null;
}

export async function getSoulDocumentHistory(orgId: string): Promise<{
  id: string;
  version: number;
  updated_at: string;
  updated_by: string;
  updated_by_name: string;
}[]> {
  const { data: versions } = await supabaseAdmin
    .from('intel_soul_documents')
    .select('id, version, updated_at, updated_by')
    .eq('org_id', orgId)
    .order('version', { ascending: false });

  if (!versions || versions.length === 0) return [];

  const memberIds = [...new Set(versions.map(v => v.updated_by))];
  const { data: members } = await supabaseAdmin
    .from('intel_org_members')
    .select('user_id, display_name')
    .eq('org_id', orgId)
    .in('user_id', memberIds);

  const nameMap = new Map((members || []).map(m => [m.user_id, m.display_name]));

  return versions.map(v => ({
    id: v.id,
    version: v.version,
    updated_at: v.updated_at,
    updated_by: v.updated_by,
    updated_by_name: nameMap.get(v.updated_by) || 'Unknown',
  }));
}

export async function getSoulDocumentVersion(versionId: string): Promise<IntelSoulDocument | null> {
  const { data } = await supabaseAdmin
    .from('intel_soul_documents')
    .select('*')
    .eq('id', versionId)
    .single();
  return data as IntelSoulDocument | null;
}

// ── Document Queries ────────────────────────────────────────────────

export async function createDocument(input: {
  org_id: string;
  folder: 'deep_dive' | 'reference';
  filename: string;
  storage_path: string;
  full_text: string | null;
  uploaded_by: string;
  summary_metadata?: DocumentSummaryMetadata;
  folder_id?: string;
}): Promise<IntelDocument | null> {
  const row: Record<string, unknown> = {
    org_id: input.org_id,
    folder: input.folder,
    filename: input.filename,
    storage_path: input.storage_path,
    full_text: input.full_text,
    uploaded_by: input.uploaded_by,
    summary_metadata: input.summary_metadata ? { page_count: input.summary_metadata.page_count } : null,
  };
  if (input.folder_id) {
    row.folder_id = input.folder_id;
  }
  const { data, error } = await supabaseAdmin
    .from('intel_documents')
    .insert(row)
    .select()
    .single();
  if (error) {
    console.error('[createDocument] insert error:', error.message, error.details, 'folder_id:', input.folder_id);
  }
  return data as IntelDocument | null;
}

export async function updateDocumentSummary(
  docId: string,
  summary: string,
  summaryMetadata: DocumentSummaryMetadata
): Promise<void> {
  await supabaseAdmin
    .from('intel_documents')
    .update({ summary, summary_metadata: summaryMetadata })
    .eq('id', docId);
}

export async function getDocuments(
  orgId: string,
  folder?: 'deep_dive' | 'reference'
): Promise<IntelDocument[]> {
  let query = supabaseAdmin
    .from('intel_documents')
    .select('*')
    .eq('org_id', orgId)
    .order('uploaded_at', { ascending: false });

  if (folder) {
    query = query.eq('folder', folder);
  }

  const { data } = await query;
  const docs = (data || []) as IntelDocument[];

  if (docs.length === 0) return [];

  // Look up uploader names separately
  const uploaderIds = [...new Set(docs.map(d => d.uploaded_by).filter(Boolean))];
  const { data: members } = await supabaseAdmin
    .from('intel_org_members')
    .select('user_id, display_name')
    .eq('org_id', orgId)
    .in('user_id', uploaderIds);
  const nameMap = new Map((members || []).map(m => [m.user_id, m.display_name]));

  return docs.map(d => ({
    ...d,
    uploader_name: nameMap.get(d.uploaded_by) || 'Unknown',
  }));
}

export async function getDocument(docId: string): Promise<IntelDocument | null> {
  const { data } = await supabaseAdmin
    .from('intel_documents')
    .select('*')
    .eq('id', docId)
    .single();
  return data as IntelDocument | null;
}

export async function deleteDocument(docId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('intel_documents')
    .delete()
    .eq('id', docId);
  return !error;
}

// ── Conversation Queries ────────────────────────────────────────────

export async function createConversation(input: {
  org_id: string;
  user_id: string;
  title: string;
}): Promise<IntelConversation | null> {
  const { data, error } = await supabaseAdmin
    .from('intel_conversations')
    .insert({
      org_id: input.org_id,
      user_id: input.user_id,
      title: input.title,
      messages: [],
    })
    .select()
    .single();

  if (error) {
    console.error('[createConversation] error:', error.message, error.details);
    return null;
  }
  return data as IntelConversation | null;
}

export async function getConversation(convId: string): Promise<IntelConversation | null> {
  const { data, error } = await supabaseAdmin
    .from('intel_conversations')
    .select('*')
    .eq('id', convId)
    .single();
  if (error || !data) return null;
  // Ensure messages is always an array even if column doesn't exist
  return { ...data, messages: data.messages || [] } as IntelConversation;
}

export async function listConversations(
  orgId: string,
  userId: string,
  userRole: IntelMemberRole,
  limit = 20,
  offset = 0
): Promise<ConversationSummary[]> {
  let query = supabaseAdmin
    .from('intel_conversations')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (userRole !== 'super_admin') {
    query = query.eq('user_id', userId);
  }

  const { data } = await query;

  return ((data || []) as IntelConversation[]).map(c => {
    const msgs = (c.messages || []) as ChatMessage[];
    const lastMsg = msgs[msgs.length - 1];
    return {
      id: c.id,
      title: c.title,
      updated_at: c.updated_at,
      message_preview: lastMsg ? lastMsg.content.substring(0, 60) : '',
    };
  });
}

export async function appendConversationMessages(
  convId: string,
  newMessages: ChatMessage[]
): Promise<void> {
  const conv = await getConversation(convId);
  if (!conv) return;

  const existingMessages = (conv.messages || []) as ChatMessage[];
  const updatedMessages = [...existingMessages, ...newMessages];

  const { error } = await supabaseAdmin
    .from('intel_conversations')
    .update({
      messages: updatedMessages,
      updated_at: new Date().toISOString(),
    })
    .eq('id', convId);

  if (error) {
    console.error('[appendConversationMessages] error:', error.message);
  }
}

export async function updateConversationTitle(convId: string, title: string): Promise<void> {
  await supabaseAdmin
    .from('intel_conversations')
    .update({ title })
    .eq('id', convId);
}

export async function deleteConversation(convId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('intel_conversations')
    .delete()
    .eq('id', convId);
  return !error;
}

// ── Activity Logging ────────────────────────────────────────────────

export async function logActivity(input: {
  org_id: string;
  user_id: string;
  action_type: string;
  action_detail: Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from('intel_user_activity_log').insert(input);
}
