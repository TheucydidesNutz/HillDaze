import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { getWorkspaceBySlug } from '@/lib/analysis/workspace-queries';
import { extractText, getDocumentProxy } from 'unpdf';

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slug, id } = await params;
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const orgId = formData.get('org_id') as string;
  const title = (formData.get('title') as string) || file?.name || 'Untitled Example';

  if (!file || !orgId) {
    return NextResponse.json({ error: 'file and org_id required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const workspace = await getWorkspaceBySlug(orgId, slug);
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  // Get the template
  const { data: template } = await supabaseAdmin
    .from('workspace_report_templates')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .single();

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  // Extract text from the file
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileExtension = file.name.toLowerCase().split('.').pop() || '';
  let content = '';

  if (fileExtension === 'pdf') {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      content = text;
      pdf.cleanup();
    } catch {
      return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 400 });
    }
  } else if (fileExtension === 'docx' || fileExtension === 'doc') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
    } catch {
      return NextResponse.json({ error: 'Failed to parse document' }, { status: 400 });
    }
  } else if (fileExtension === 'txt' || fileExtension === 'md') {
    content = new TextDecoder('utf-8').decode(buffer);
  } else {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  // Append to example_reports JSONB array
  const examples = template.example_reports || [];
  examples.push({
    title,
    content,
    date: new Date().toISOString().split('T')[0],
  });

  const { error } = await supabaseAdmin
    .from('workspace_report_templates')
    .update({
      example_reports: examples,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    example_count: examples.length,
    added: { title, content_length: content.length },
  }, { status: 201 });
}
