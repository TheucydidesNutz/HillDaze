/**
 * Seed RSS feeds and competitive sources for the cigar-rights org.
 *
 * Run with: npx tsx lib/intel/migrations/seed-cigar-rights-feeds.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env.local manually (no dotenv dependency needed)
const envPath = resolve(process.cwd(), '.env.local');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {
  // .env.local may not exist; env vars might already be set
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // Get org_id for cigar-rights
  const { data: org, error: orgError } = await supabase
    .from('intel_organizations')
    .select('id, name')
    .eq('slug', 'cigar-rights')
    .single();

  if (orgError || !org) {
    console.error('Could not find org with slug "cigar-rights":', orgError?.message);
    process.exit(1);
  }

  console.log(`Found org: ${org.name} (${org.id})`);
  const orgId = org.id;

  // RSS Feeds
  const feeds = [
    {
      org_id: orgId,
      feed_url: 'https://www.federalregister.gov/documents/search.atom?conditions%5Bterm%5D=cigar+tobacco',
      feed_name: 'Federal Register: Cigar & Tobacco',
      category: 'federal_policy',
      active: true,
    },
    {
      org_id: orgId,
      feed_url: 'https://www.federalregister.gov/documents/search.atom?conditions%5Bagencies%5D%5B%5D=food-and-drug-administration&conditions%5Bterm%5D=tobacco',
      feed_name: 'FDA Tobacco Regulations',
      category: 'federal_policy',
      active: true,
    },
    {
      org_id: orgId,
      feed_url: 'https://www.congress.gov/rss/most-viewed-bills.xml',
      feed_name: 'Congress Most Viewed Bills',
      category: 'federal_policy',
      active: true,
    },
    {
      org_id: orgId,
      feed_url: 'https://halfwheel.com/feed/',
      feed_name: 'Halfwheel',
      category: 'industry_news',
      active: true,
    },
    {
      org_id: orgId,
      feed_url: 'https://cigaraficionado.com/feed',
      feed_name: 'Cigar Aficionado',
      category: 'industry_news',
      active: true,
    },
    {
      org_id: orgId,
      feed_url: 'https://www.tobaccobusiness.com/feed/',
      feed_name: 'Tobacco Business Magazine',
      category: 'industry_news',
      active: true,
    },
    {
      org_id: orgId,
      feed_url: 'https://legiscan.com/feed',
      feed_name: 'LegiScan Legislative Tracker',
      category: 'state_legislation',
      active: true,
    },
  ];

  const { data: insertedFeeds, error: feedError } = await supabase
    .from('intel_rss_feed_config')
    .insert(feeds)
    .select();

  if (feedError) {
    console.error('Failed to insert feeds:', feedError.message);
  } else {
    console.log(`Inserted ${insertedFeeds.length} RSS feeds:`);
    for (const f of insertedFeeds) {
      console.log(`  - ${f.feed_name} (${f.category})`);
    }
  }

  // Competitive/allied sources
  const competitive = [
    {
      org_id: orgId,
      name: 'Campaign for Tobacco-Free Kids',
      url: 'https://www.tobaccofreekids.org/press-releases/feed',
      relationship: 'competitor',
      active: true,
    },
    {
      org_id: orgId,
      name: 'Cigar Rights of America (own site)',
      url: 'https://www.cigarrights.org/feed',
      relationship: 'ally',
      active: true,
    },
    {
      org_id: orgId,
      name: 'PCA/IPCPR',
      url: 'https://ipcpr.org/feed',
      relationship: 'ally',
      active: true,
    },
  ];

  const { data: insertedComp, error: compError } = await supabase
    .from('intel_competitive_sources')
    .insert(competitive)
    .select();

  if (compError) {
    console.error('Failed to insert competitive sources:', compError.message);
  } else {
    console.log(`Inserted ${insertedComp.length} competitive/allied sources:`);
    for (const c of insertedComp) {
      console.log(`  - ${c.name} (${c.relationship})`);
    }
  }

  console.log('\nDone.');
}

main();
