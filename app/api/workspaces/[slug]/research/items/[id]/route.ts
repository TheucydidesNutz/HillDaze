import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug } from '@/lib/analysis/workspace-queries';
import { chunkText } from '@/lib/analysis/chunking';
import { generateEmbeddings } from '@/lib/analysis/embeddings';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug, id } = await params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { org_id, verification_status, promote_to_document } = body as {
    org_id: string;
    verification_status?: 'relevant' | 'ignored';
    promote_to_document?: boolean;
  };

  if (!org_id) return NextResponse.json({ error: 'org_id required' }, { status: 400 });

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const workspace = await getWorkspaceBySlug(org_id, slug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { data: item } = await supabaseAdmin
    .from('workspace_research_items')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .single();

  if (!item) return NextResponse.json({ error: 'Research item not found' }, { status: 404 });

  // Update status
  if (verification_status) {
    await supabaseAdmin
      .from('workspace_research_items')
      .update({ verification_status })
      .eq('id', id);
  }

  // Promote to workspace document (creates document + chunks)
  if (promote_to_document && item.content) {
    const { data: doc, error: docError } = await supabaseAdmin
      .from('workspace_documents')
      .insert({
        workspace_id: workspace.id,
        title: item.title,
        source_type: 'research_agent',
        source_url: item.source_url,
        content: item.content,
        summary: item.content.substring(0, 500),
        metadata: { promoted_from_research_item: id, source_type: item.source_type },
        folder: 'Research',
      })
      .select()
      .single();

    if (!docError && doc) {
      // Chunk and embed (fire-and-forget)
      const chunks = chunkText(item.content);
      if (chunks.length > 0) {
        generateEmbeddings(chunks.map(c => c.text)).then(async (embeddings) => {
          const rows = chunks.map((chunk, i) => ({
            document_id: doc.id,
            workspace_id: workspace.id,
            chunk_text: chunk.text,
            chunk_index: chunk.index,
            embedding: JSON.stringify(embeddings[i]),
          }));

          for (let i = 0; i < rows.length; i += 50) {
            await supabaseAdmin
              .from('workspace_chunks')
              .insert(rows.slice(i, i + 50));
          }
        }).catch(err => {
          console.error('[research-promote] embedding error:', err);
        });
      }

      return NextResponse.json({ success: true, document_id: doc.id });
    }
  }

  return NextResponse.json({ success: true });
}
