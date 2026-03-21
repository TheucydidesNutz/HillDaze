/**
 * Shared API utilities used by both /analysis and /intel sections.
 * Neither section should import from the other — both import from here.
 */

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry and exponential backoff.
 * Respects 429 Retry-After headers from government APIs.
 */
export async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  options?: RequestInit
): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000),
      });

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        console.warn(`[api-utils] Rate limited. Waiting ${retryAfter}s (attempt ${attempt + 1}/${maxRetries})`);
        await delay(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        console.error(`[api-utils] HTTP ${response.status} for ${url.split('?')[0]}`);
        if (attempt < maxRetries - 1) {
          await delay(2000 * (attempt + 1));
          continue;
        }
        return null;
      }

      return await response.json() as Record<string, unknown>;
    } catch (err) {
      console.error(`[api-utils] Fetch error (attempt ${attempt + 1}):`, err);
      if (attempt < maxRetries - 1) {
        await delay(2000 * (attempt + 1));
      }
    }
  }
  return null;
}

/**
 * Extract last name from a full name, stripping common titles.
 */
export function extractLastName(fullName: string): string {
  const cleaned = fullName.replace(/^(Sen\.|Rep\.|Senator|Representative|Judge|Justice|Hon\.)\s*/i, '');
  const parts = cleaned.trim().split(/\s+/);
  return parts[parts.length - 1];
}

/**
 * Convert a state name or abbreviation to a 2-letter abbreviation.
 */
export function getStateAbbreviation(state: string): string | null {
  if (/^[A-Z]{2}$/.test(state)) return state;
  const stateMap: Record<string, string> = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
    'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
    'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
    'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
    'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
    'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
    'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
    'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
    'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
    'puerto rico': 'PR', 'guam': 'GU', 'american samoa': 'AS',
    'u.s. virgin islands': 'VI', 'northern mariana islands': 'MP',
  };
  return stateMap[state.toLowerCase()] || null;
}
