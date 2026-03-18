import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership, getOrgById } from '@/lib/intel/supabase-queries';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import { gatherMonthlyData, gatherQuarterlyData } from '@/lib/intel/reports/gather-data';
import { getMonthlyReportPrompt, getExecutiveBriefPrompt } from '@/lib/intel/reports/report-templates';
import { markdownToDocx } from '@/lib/intel/reports/generate-docx';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { org_id, month, report_type = 'monthly_summary' } = body;

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'super_admin' && member.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const org = await getOrgById(org_id);
  const orgName = org?.name || 'Organization';
  const monthDate = month ? new Date(month + '-01') : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

  // Gather data
  const data = report_type === 'quarterly_review'
    ? await gatherQuarterlyData(org_id, monthDate)
    : await gatherMonthlyData(org_id, monthDate);

  // Get prompt based on type
  const prompt = report_type === 'executive_briefing'
    ? getExecutiveBriefPrompt(orgName, data)
    : getMonthlyReportPrompt(orgName, data);

  const model = 'claude-sonnet-4-20250514';
  const result = await callClaude({
    system: prompt.system,
    userMessage: prompt.user,
    model,
    maxTokens: 8192,
  });

  await logApiUsage({ orgId: org_id, endpoint: 'report_generation', model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });

  // Generate .docx
  const docxBuffer = await markdownToDocx(result.text, orgName, org?.branding);
  const monthStr = monthDate.toISOString().substring(0, 7);
  const storagePath = `intel/${org_id}/reports/${monthStr}/${report_type}.docx`;

  await supabaseAdmin.storage.from('intel').upload(storagePath, docxBuffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    upsert: true,
  });

  // Store in database
  const { data: report, error } = await supabaseAdmin.from('intel_monthly_summaries').insert({
    org_id,
    month: monthDate.toISOString().split('T')[0],
    content: result.text,
    docx_storage_path: storagePath,
    generated_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(report, { status: 201 });
}
