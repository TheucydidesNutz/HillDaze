import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export const SUPABASE_URL = process.env.SUPABASE_URL || '';
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
export const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY || '';
export const OPENSECRETS_API_KEY = process.env.OPENSECRETS_API_KEY || '';
export const COURTLISTENER_API_KEY = process.env.COURTLISTENER_API_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
