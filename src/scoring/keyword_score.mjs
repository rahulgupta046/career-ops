function lower(value) {
  return String(value || '').toLowerCase();
}

function includesAny(haystack, needles = []) {
  return needles.some(needle => haystack.includes(lower(needle)));
}

function matches(value, needles = []) {
  return needles.filter(needle => value.includes(lower(needle)));
}

function roleFamilyMatches(title, text, families = {}) {
  const results = [];
  for (const [name, family] of Object.entries(families || {})) {
    const titleMatches = matches(title, family.titles || []);
    const termMatches = matches(text, family.strong_terms || []);
    if (titleMatches.length || termMatches.length) {
      results.push({ name, titleMatches, termMatches });
    }
  }
  return results;
}

export function locationMatches(value, locations = []) {
  const location = lower(value);
  const normalizedTargets = locations.map(lower);
  const specificTargets = normalizedTargets.filter(target => target !== 'remote');

  if (includesAny(location, specificTargets)) return true;
  if (normalizedTargets.includes('united states') && /\b(?:us|usa|united states|u\.s\.)\b/i.test(String(value || ''))) return true;
  if (!normalizedTargets.includes('remote')) return false;

  const remoteOnly = /^remote(?:\s*[-,|/]\s*(?:us|usa|united states))?$/i;
  const usRemote = /\bremote\b.*\b(?:us|usa|united states)\b|\b(?:us|usa|united states)\b.*\bremote\b/i;
  return remoteOnly.test(String(value || '').trim()) || usRemote.test(String(value || ''));
}

export function requiredExperienceYears(text) {
  const value = lower(text);
  const years = [];
  const patterns = [
    /(?:at least|minimum(?: of)?|requires?|required|need(?:s|ed)?|must have)\s+(\d{1,2})\+?\s*(?:years|yrs|yr)\b/g,
    /(\d{1,2})\+?\s*(?:years|yrs|yr)\s+(?:of\s+)?(?:professional\s+)?experience\b/g,
    /(\d{1,2})\s*-\s*(\d{1,2})\s*(?:years|yrs|yr)\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      years.push(Number(match[1]));
    }
  }

  return years.filter(Number.isFinite);
}

export function scoreJob(job, rules) {
  const targetRoles = rules.target_roles || [];
  const roleFamilies = rules.role_families || {};
  const requiredKeywords = rules.required_keywords || [];
  const mustHaveAny = rules.must_have_any || requiredKeywords;
  const strongPositive = rules.strong_positive || requiredKeywords;
  const niceToHave = rules.nice_to_have || [];
  const locations = rules.locations || [];
  const negativeKeywords = rules.negative_keywords || [];
  const negativeRoleKeywords = rules.negative_role_keywords || [];
  const seniorityExclusionKeywords = rules.seniority_exclusion_keywords || [];
  const sponsorshipKeywords = rules.sponsorship_keywords || [];
  const maxExperienceYears = Number(rules.max_experience_years || 0);

  const title = lower(job.title);
  const description = lower(job.description);
  const text = `${title} ${description}`;
  const location = lower(job.location);
  const locationMatched = locationMatches(location, locations);
  const locationExcluded = locations.length > 0 && !locationMatched;
  const experienceYears = requiredExperienceYears(text);
  const experienceExcluded = maxExperienceYears > 0 && experienceYears.some(years => years > maxExperienceYears);
  const seniorityExcluded = maxExperienceYears > 0 && includesAny(title, seniorityExclusionKeywords);
  const roleExcludedMatches = matches(title, negativeRoleKeywords);
  const roleExcluded = roleExcludedMatches.length > 0;
  const negativeMatches = matches(text, negativeKeywords);
  const mustHaveMatches = matches(text, mustHaveAny);
  const strongMatches = matches(text, strongPositive);
  const niceMatches = matches(text, niceToHave);
  const familyMatches = roleFamilyMatches(title, text, roleFamilies);
  const titleMatches = matches(title, targetRoles);
  const sponsorshipMatches = matches(text, sponsorshipKeywords);

  let score = 0;
  const parts = [];

  if (titleMatches.length) {
    score += 30;
    parts.push(`target title: ${titleMatches.join(', ')}`);
  }

  if (familyMatches.length) {
    const familyScore = Math.min(25, familyMatches.reduce((sum, family) => {
      return sum + (family.titleMatches.length ? 12 : 0) + Math.min(13, family.termMatches.length * 3);
    }, 0));
    score += familyScore;
    parts.push(`role family: ${familyMatches.map(item => item.name).join(', ')}`);
  }

  if (mustHaveMatches.length) {
    score += Math.min(15, mustHaveMatches.length * 5);
    parts.push(`must-have: ${mustHaveMatches.join(', ')}`);
  }

  if (strongMatches.length) {
    score += Math.min(25, strongMatches.length * 4);
    parts.push(`strong signals: ${strongMatches.slice(0, 6).join(', ')}`);
  }

  if (niceMatches.length) {
    score += Math.min(10, niceMatches.length * 2);
    parts.push(`nice-to-have: ${niceMatches.slice(0, 5).join(', ')}`);
  }

  if (locationMatched) {
    score += 10;
    parts.push('target location match');
  }

  if (negativeMatches.length === 0) {
    score += 5;
    parts.push('no negative keyword');
  }

  if (sponsorshipMatches.length > 0) {
    score += 5;
    parts.push('sponsorship/work-auth signal');
  }

  const hardRejectReason = experienceExcluded || seniorityExcluded
    ? `requires more than ${maxExperienceYears} years experience or seniority is excluded`
    : roleExcluded
      ? `excluded role family: ${roleExcludedMatches.join(', ')}`
      : mustHaveAny.length && mustHaveMatches.length === 0
        ? `missing one of must-have signals: ${mustHaveAny.join(', ')}`
        : '';

  return {
    score: Math.min(100, score),
    reason: hardRejectReason || (parts.length ? parts.join('; ') : 'weak local match'),
    matched_keywords: [...new Set([...mustHaveMatches, ...strongMatches, ...niceMatches])],
    role_families: familyMatches.map(item => item.name),
    negative_matches: negativeMatches,
    negative_role_matches: roleExcludedMatches,
    sponsorship_signal: sponsorshipMatches.length ? sponsorshipMatches.join('|') : 'unknown',
    experience_years: experienceYears,
    experience_excluded: experienceExcluded || seniorityExcluded,
    seniority_excluded: seniorityExcluded,
    role_excluded: roleExcluded,
    missing_must_have: mustHaveAny.length > 0 && mustHaveMatches.length === 0,
    location_excluded: locationExcluded,
  };
}
