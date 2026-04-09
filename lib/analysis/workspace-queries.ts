import { supabaseAdmin } from '@/lib/supabase';
import type { Workspace, WorkspaceDocument, WorkspaceConversation } from './types';

// ── Workspace CRUD ──────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

export async function createWorkspace(input: {
  org_id: string;
  name: string;
  description?: string;
  created_by?: string;
}): Promise<Workspace | null> {
  let slug = slugify(input.name);

  // Check for slug collisions and append suffix if needed
  const { data: existing } = await supabaseAdmin
    .from('workspaces')
    .select('slug')
    .eq('org_id', input.org_id)
    .like('slug', `${slug}%`);

  if (existing && existing.length > 0) {
    const existingSlugs = new Set(existing.map(w => w.slug));
    if (existingSlugs.has(slug)) {
      let suffix = 2;
      while (existingSlugs.has(`${slug}-${suffix}`)) suffix++;
      slug = `${slug}-${suffix}`;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .insert({
      org_id: input.org_id,
      slug,
      name: input.name,
      description: input.description || null,
      created_by: input.created_by || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[createWorkspace] error:', error.message);
    return null;
  }
  return data as Workspace;
}

export async function getWorkspaceBySlug(orgId: string, slug: string): Promise<Workspace | null> {
  const { data } = await supabaseAdmin
    .from('workspaces')
    .select('*')
    .eq('org_id', orgId)
    .eq('slug', slug)
    .single();
  return data as Workspace | null;
}

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  const { data } = await supabaseAdmin
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .single();
  return data as Workspace | null;
}

export async function getOrgWorkspaces(orgId: string): Promise<Workspace[]> {
  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[getOrgWorkspaces] error:', error.message);
    return [];
  }
  return (data || []) as Workspace[];
}

export async function updateWorkspace(
  workspaceId: string,
  updates: Partial<Pick<Workspace, 'name' | 'description' | 'soul_doc' | 'soul_doc_md' | 'soul_doc_version' | 'settings'>>
): Promise<Workspace | null> {
  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', workspaceId)
    .select()
    .single();

  if (error) {
    console.error('[updateWorkspace] error:', error.message);
    return null;
  }
  return data as Workspace;
}

export async function deleteWorkspace(workspaceId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('workspaces')
    .delete()
    .eq('id', workspaceId);

  if (error) {
    console.error('[deleteWorkspace] error:', error.message);
    return false;
  }
  return true;
}

// ── Document Queries ────────────────────────────────────────────────

export async function getWorkspaceDocuments(
  workspaceId: string,
  options?: { folder?: string; limit?: number; offset?: number }
): Promise<WorkspaceDocument[]> {
  let query = supabaseAdmin
    .from('workspace_documents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (options?.folder) query = query.eq('folder', options.folder);
  if (options?.limit) query = query.limit(options.limit);
  if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 20) - 1);

  const { data, error } = await query;
  if (error) {
    console.error('[getWorkspaceDocuments] error:', error.message);
    return [];
  }
  return (data || []) as WorkspaceDocument[];
}

export async function getWorkspaceDocument(documentId: string): Promise<WorkspaceDocument | null> {
  const { data } = await supabaseAdmin
    .from('workspace_documents')
    .select('*')
    .eq('id', documentId)
    .single();
  return data as WorkspaceDocument | null;
}

export async function deleteWorkspaceDocument(documentId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('workspace_documents')
    .delete()
    .eq('id', documentId);

  if (error) {
    console.error('[deleteWorkspaceDocument] error:', error.message);
    return false;
  }
  return true;
}

// ── Conversation Queries ────────────────────────────────────────────

export async function getWorkspaceConversations(
  workspaceId: string,
  options?: { limit?: number; offset?: number }
): Promise<WorkspaceConversation[]> {
  let query = supabaseAdmin
    .from('workspace_conversations')
    .select('id, workspace_id, user_id, title, source, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

  if (options?.limit) query = query.limit(options.limit);
  if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 20) - 1);

  const { data, error } = await query;
  if (error) {
    console.error('[getWorkspaceConversations] error:', error.message);
    return [];
  }
  return (data || []) as WorkspaceConversation[];
}

export async function getWorkspaceConversation(conversationId: string): Promise<WorkspaceConversation | null> {
  const { data } = await supabaseAdmin
    .from('workspace_conversations')
    .select('*')
    .eq('id', conversationId)
    .single();
  return data as WorkspaceConversation | null;
}

export async function deleteWorkspaceConversation(conversationId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('workspace_conversations')
    .delete()
    .eq('id', conversationId);

  if (error) {
    console.error('[deleteWorkspaceConversation] error:', error.message);
    return false;
  }
  return true;
}
