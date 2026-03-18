import { NextRequest, NextResponse } from 'next/server';
import { testFeedUrl } from '@/lib/intel/ingestion/rss-fetcher';

export async function POST(request: NextRequest) {
  const { url } = await request.json();
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  const result = await testFeedUrl(url);
  return NextResponse.json(result);
}
