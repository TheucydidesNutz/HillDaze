import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getUserOrgMembership } from '@/lib/intel/supabase-queries';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { org_id, service_name, api_key } = body;

  if (!org_id || !service_name || !api_key) {
    return NextResponse.json({ error: 'org_id, service_name, and api_key required' }, { status: 400 });
  }

  const member = await getUserOrgMembership(org_id, user.id);
  if (!member || (member.role !== 'admin' && member.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    let success = false;
    let message = '';

    switch (service_name) {
      case 'congress_gov': {
        const url = `https://api.congress.gov/v3/bill?limit=1&api_key=${encodeURIComponent(api_key)}`;
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          success = true;
          message = 'Connected successfully — verified with Congress.gov';
        } else {
          const text = await res.text().catch(() => '');
          if (res.status === 403 || res.status === 401) {
            message = 'Failed: Invalid API key. Get a free key at api.congress.gov/sign-up';
          } else if (res.status === 429) {
            message = 'Failed: Rate limited. The key may be valid — try again in a minute.';
          } else {
            message = `Failed: Congress.gov returned HTTP ${res.status}${text ? ` — ${text.substring(0, 100)}` : ''}`;
          }
        }
        break;
      }
      case 'opensecrets': {
        const res = await fetch(
          `https://www.opensecrets.org/api/?method=getLegislators&id=RI&apikey=${encodeURIComponent(api_key)}&output=json`,
          { signal: AbortSignal.timeout(15000) }
        );
        if (res.ok) {
          success = true;
          message = 'Connected successfully — verified with OpenSecrets';
        } else if (res.status === 403 || res.status === 401) {
          message = 'Failed: Invalid API key. Get a free key at opensecrets.org/api';
        } else {
          message = `Failed: OpenSecrets returned HTTP ${res.status}`;
        }
        break;
      }
      case 'courtlistener': {
        const res = await fetch(
          'https://www.courtlistener.com/api/rest/v4/search/?q=test&type=o&page_size=1',
          {
            headers: { Authorization: `Token ${api_key}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(15000),
          }
        );
        if (res.ok) {
          success = true;
          message = 'Connected successfully — verified with CourtListener';
        } else if (res.status === 403 || res.status === 401) {
          message = 'Failed: Invalid API token. Get a free token at courtlistener.com';
        } else {
          message = `Failed: CourtListener returned HTTP ${res.status}`;
        }
        break;
      }
      default:
        message = 'No test available for this service — key will be saved on trust';
        success = true;
    }

    return NextResponse.json({ success, message });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    if (errMsg.includes('abort') || errMsg.includes('timeout')) {
      return NextResponse.json({
        success: false,
        message: 'Failed: Request timed out. The service may be temporarily unavailable.',
      });
    }
    return NextResponse.json({
      success: false,
      message: `Failed: Network error — ${errMsg}`,
    });
  }
}
