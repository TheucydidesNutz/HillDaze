import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, supabaseAdmin } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';
import { callClaude } from '@/lib/intel/agent/client';
import { logApiUsage } from '@/lib/intel/agent/usage';
import Papa from 'papaparse';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const profileId = formData.get('profile_id') as string;
  const orgId = formData.get('org_id') as string;
  const importMode = (formData.get('import_mode') as string) || 'single'; // 'rows' or 'single'
  const folderPath = (formData.get('folder_path') as string) || '';

  if (!file || !profileId || !orgId) {
    return NextResponse.json({ error: 'file, profile_id, and org_id required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(orgId, user.id);
  if (!member || member.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: profile } = await supabaseAdmin
    .from('analysis_profiles')
    .select('id, org_id, full_name')
    .eq('id', profileId)
    .single();
  if (!profile || profile.org_id !== orgId) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const csvText = await file.text();
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields || [];
  const rows = parsed.data as Record<string, string>[];

  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV has no data rows' }, { status: 400 });
  }

  // Upload raw CSV to storage
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const pathPrefix = folderPath ? `${folderPath.replace(/\/+$/, '')}/` : '';
  const storagePath = `${orgId}/${profileId}/documents/${pathPrefix}${timestamp}_${safeName}`;

  await supabaseAdmin.storage.from('analysis').upload(storagePath, csvText, {
    contentType: 'text/csv',
    upsert: false,
  });

  if (importMode === 'rows') {
    // Import each row as a separate donation data item
    const headersLower = headers.map(h => h.toLowerCase());

    // Find column mappings (flexible matching)
    const findCol = (patterns: string[]) => {
      for (const p of patterns) {
        const idx = headersLower.findIndex(h => h.includes(p));
        if (idx >= 0) return headers[idx];
      }
      return null;
    };

    const donorCol = findCol(['donor', 'contrib', 'orgname', 'from', 'name']);
    const recipientCol = findCol(['recipient', 'candname', 'cand_name', 'to']);
    const amountCol = findCol(['amount', 'total', 'contrib_amount']);
    const dateCol = findCol(['date', 'cycle', 'year']);
    const sectorCol = findCol(['sector', 'industry', 'catname', 'realcode']);

    let created = 0;
    const batchSize = 100; // Don't create more than 100 items from a single CSV

    for (const row of rows.slice(0, batchSize)) {
      const donor = donorCol ? row[donorCol] : '';
      const recipient = recipientCol ? row[recipientCol] : profile.full_name;
      const amount = amountCol ? row[amountCol] : '';
      const date = dateCol ? row[dateCol] : null;
      const sector = sectorCol ? row[sectorCol] : '';

      // Format amount with $ if numeric
      const amountDisplay = amount && !isNaN(Number(amount.replace(/[,$]/g, '')))
        ? `$${Number(amount.replace(/[,$]/g, '')).toLocaleString()}`
        : amount;

      const title = [donor, recipient].filter(Boolean).join(' → ') + (amountDisplay ? ` (${amountDisplay})` : '');

      // Build summary from all columns
      const summaryParts = headers.map(h => `${h}: ${row[h] || 'N/A'}`);
      const summary = summaryParts.join('\n');

      const keyTopics: string[] = ['campaign finance', 'donations'];
      if (sector) keyTopics.push(sector);

      // Normalize date — handle "2024", "2024-01-15", etc.
      let itemDate: string | null = null;
      if (date) {
        if (/^\d{4}$/.test(date)) itemDate = `${date}-01-01`;
        else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) itemDate = date;
        else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(date)) {
          try { itemDate = new Date(date).toISOString().split('T')[0]; } catch { /* skip */ }
        }
      }

      await supabaseAdmin.from('analysis_data_items').insert({
        profile_id: profileId,
        org_id: orgId,
        category: 'donation',
        subcategory: 'csv_import',
        title: title || `Donation Record (Row ${created + 1})`,
        summary,
        key_topics: keyTopics,
        source_url: null,
        source_name: `CSV: ${file.name}`,
        source_trust_level: 'trusted',
        item_date: itemDate,
        folder_path: folderPath || null,
        storage_path: storagePath,
        storage_tier: 'deep_dive',
        original_filename: file.name,
        file_size_bytes: file.size,
        verification_status: 'verified',
        anomaly_flags: {},
      });
      created++;
    }

    return NextResponse.json({
      mode: 'rows',
      items_created: created,
      total_rows: rows.length,
      truncated: rows.length > batchSize,
    }, { status: 201 });

  } else {
    // Single document mode — summarize entire CSV with Claude
    const model = 'claude-sonnet-4-20250514';
    const previewText = `CSV: ${file.name}\nColumns: ${headers.join(', ')}\nRows: ${rows.length}\n\nFirst 20 rows:\n${Papa.unparse(rows.slice(0, 20))}`;

    let summaryData: { title?: string; executive_summary?: string; key_topics?: string[]; date?: string | null } = {};

    try {
      const result = await callClaude({
        system: `You are analyzing a CSV file related to ${profile.full_name}. Return ONLY valid JSON.`,
        userMessage: `Analyze this CSV and return:
{
  "title": "descriptive title for this dataset",
  "executive_summary": "2-3 sentence summary of what this data contains and its relevance to ${profile.full_name}",
  "key_topics": ["topic1", "topic2"],
  "date": "date range covered or null"
}

${previewText}`,
        model,
        maxTokens: 1024,
      });

      await logApiUsage({ orgId, endpoint: 'analysis_csv_summarize', model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });

      try { summaryData = JSON.parse(result.text); } catch {
        summaryData = { title: file.name, executive_summary: result.text, key_topics: [] };
      }
    } catch {
      summaryData = { title: file.name, executive_summary: `CSV with ${rows.length} rows and ${headers.length} columns.`, key_topics: [] };
    }

    const { data: dataItem, error: insertError } = await supabaseAdmin
      .from('analysis_data_items')
      .insert({
        profile_id: profileId,
        org_id: orgId,
        category: 'uploaded_doc',
        subcategory: 'csv',
        title: summaryData.title || file.name,
        full_text: csvText,
        summary: summaryData.executive_summary || `CSV file with ${rows.length} rows and columns: ${headers.join(', ')}`,
        key_topics: summaryData.key_topics || [],
        source_url: null,
        source_name: 'CSV upload',
        source_trust_level: 'trusted',
        item_date: summaryData.date || null,
        folder_path: folderPath || null,
        storage_path: storagePath,
        storage_tier: 'deep_dive',
        original_filename: file.name,
        file_size_bytes: file.size,
        verification_status: 'verified',
        anomaly_flags: {},
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: 'Failed to create data item' }, { status: 500 });
    }

    return NextResponse.json({ mode: 'single', item: dataItem }, { status: 201 });
  }
}
