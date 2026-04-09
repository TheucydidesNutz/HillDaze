import { createHash, randomBytes } from 'crypto';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Workspace } from './types';

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString('hex');
  const key = `wk_${raw}`;
  return {
    key,
    hash: hashKey(key),
    prefix: key.substring(0, 11), // "wk_" + first 8 chars
  };
}

export async function verifyWorkspaceApiKey(request: NextRequest): Promise<{
  workspace: Workspace;
  orgId: string;
} | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer wk_')) return null;

  const key = authHeader.substring(7); // Remove "Bearer "
  const keyHash = hashKey(key);

  const { data: apiKey } = await supabaseAdmin
    .from('workspace_api_keys')
    .select('id, workspace_id, expires_at')
    .eq('key_hash', keyHash)
    .single();

  if (!apiKey) return null;

  // Check expiration
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) return null;

  // Update last_used_at
  await supabaseAdmin
    .from('workspace_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id);

  // Get workspace
  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('*')
    .eq('id', apiKey.workspace_id)
    .single();

  if (!workspace) return null;

  return {
    workspace: workspace as Workspace,
    orgId: workspace.org_id,
  };
}
