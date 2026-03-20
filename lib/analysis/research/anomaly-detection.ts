import type { AnalysisProfile } from '../types';

interface AnomalyCheckResult {
  isAnomaly: boolean;
  flags: {
    type: string;
    reason: string;
    score: number; // 0-1, higher = more suspicious
  }[];
}

const PROFESSION_MISMATCH_TERMS = [
  'arrested', 'obituary', 'wedding', 'athlete', 'musician',
  'actor', 'actress', 'singer', 'rapper', 'comedian',
  'chef', 'restaurant', 'sports', 'nba', 'nfl', 'mlb',
  'nhl', 'olympic', 'marathon', 'reality tv', 'contestant',
];

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

export function checkForAnomalies(
  profile: AnalysisProfile,
  item: {
    title?: string | null;
    summary?: string | null;
    source_name?: string | null;
    venue?: string | null;
    context?: string | null;
  }
): AnomalyCheckResult {
  const flags: AnomalyCheckResult['flags'] = [];
  const textToCheck = [
    item.title || '',
    item.summary || '',
    item.venue || '',
    item.context || '',
  ].join(' ').toLowerCase();

  // 1. Profession mismatch check
  for (const term of PROFESSION_MISMATCH_TERMS) {
    if (textToCheck.includes(term.toLowerCase())) {
      flags.push({
        type: 'profession_mismatch',
        reason: `Contains "${term}" which is unusual for a ${profile.position_type.replace('_', ' ')}`,
        score: 0.7,
      });
      break; // One profession mismatch flag is enough
    }
  }

  // 2. Location mismatch check (for congress_member with known state)
  if (profile.state && profile.position_type === 'congress_member') {
    const stateFullName = US_STATES[profile.state] || profile.state;
    // Check if the item mentions a DIFFERENT state prominently without mentioning the expected state
    const mentionsExpectedState = textToCheck.includes(profile.state.toLowerCase()) ||
                                   textToCheck.includes(stateFullName.toLowerCase());

    // Only flag if there's a strong signal of a different location
    if (!mentionsExpectedState && textToCheck.length > 100) {
      // Check for other state names in prominent positions (title specifically)
      const titleLower = (item.title || '').toLowerCase();
      for (const [abbr, fullName] of Object.entries(US_STATES)) {
        if (abbr === profile.state) continue;
        if (titleLower.includes(`(${abbr.toLowerCase()})`) || titleLower.includes(fullName.toLowerCase())) {
          flags.push({
            type: 'location_mismatch',
            reason: `Title references ${fullName} (${abbr}) but profile is from ${stateFullName} (${profile.state})`,
            score: 0.6,
          });
          break;
        }
      }
    }
  }

  // 3. Name confidence check — check if the profile name appears in the text
  const nameParts = profile.full_name.toLowerCase().split(' ');
  const lastName = nameParts[nameParts.length - 1];
  if (textToCheck.length > 50 && !textToCheck.includes(lastName)) {
    flags.push({
      type: 'name_mismatch',
      reason: `Profile name "${profile.full_name}" (last name: "${lastName}") not found in the text — may be about a different person`,
      score: 0.8,
    });
  }

  return {
    isAnomaly: flags.length > 0,
    flags,
  };
}
