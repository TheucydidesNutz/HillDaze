import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import Papa from 'papaparse';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

  const text = await file.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    return NextResponse.json({ error: 'Failed to parse CSV' }, { status: 400 });
  }

  const headers = parsed.meta.fields || [];
  const rows = parsed.data as Record<string, string>[];
  const rowCount = rows.length;

  // Detect format
  const headersLower = headers.map(h => h.toLowerCase().replace(/[^a-z]/g, ''));

  // OpenSecrets / donation pattern detection
  const donationIndicators = ['donor', 'recipient', 'amount', 'contrib', 'pac', 'committee', 'fec', 'cycle', 'contribid', 'orgname'];
  const donationMatchCount = headersLower.filter(h => donationIndicators.some(d => h.includes(d))).length;
  const isDonationFormat = donationMatchCount >= 2;

  // Detect date column
  const dateColumns = headers.filter(h => {
    const l = h.toLowerCase();
    return l.includes('date') || l === 'cycle' || l === 'year';
  });

  // Detect amount column
  const amountColumns = headers.filter(h => {
    const l = h.toLowerCase();
    return l.includes('amount') || l.includes('total') || l.includes('contrib');
  });

  // Sample first 5 rows
  const sampleRows = rows.slice(0, 5);

  return NextResponse.json({
    filename: file.name,
    row_count: rowCount,
    headers,
    detected_format: isDonationFormat ? 'donation' : 'generic',
    date_columns: dateColumns,
    amount_columns: amountColumns,
    sample_rows: sampleRows,
    suggestion: isDonationFormat
      ? `This CSV appears to contain donation/contribution data (${rowCount} rows). You can import each row as a separate donation record, or as a single document.`
      : `This CSV has ${rowCount} rows and ${headers.length} columns. It will be imported as a single document with AI-generated summary.`,
  });
}
