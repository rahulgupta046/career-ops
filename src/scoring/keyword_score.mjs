function lower(value) {
  return String(value || '').toLowerCase();
}

function includesAny(haystack, needles = []) {
  return needles.some(needle => haystack.includes(lower(needle)));
}

export function locationMatches(value, locations = []) {
  const location = lower(value);
  const normalizedTargets = locations.map(lower);
  const specificTargets = normalizedTargets.filter(target => target !== 'remote');

  if (includesAny(location, specificTargets)) return true;
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
  const requiredKeywords = rules.required_keywords || [];
  const locations = rules.locations || [];
  const negativeKeywords = rules.negative_keywords || [];
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

  let score = 0;
  const parts = [];

  if (includesAny(title, targetRoles)) {
    score += 35;
    parts.push('target title match');
  }

  const matchedKeywords = requiredKeywords.filter(keyword => text.includes(lower(keyword)));
  const skillScore = Math.min(matchedKeywords.length * 5, 30);
  score += skillScore;
  if (matchedKeywords.length) parts.push(`${matchedKeywords.join('/')} match`);

  if (locationMatched) {
    score += 15;
    parts.push('target location match');
  }

  const negativeMatches = negativeKeywords.filter(keyword => text.includes(lower(keyword)));
  if (negativeMatches.length === 0) {
    score += 10;
    parts.push('no negative keyword');
  }

  const sponsorshipMatches = sponsorshipKeywords.filter(keyword => text.includes(lower(keyword)));
  if (sponsorshipMatches.length > 0) {
    score += 10;
    parts.push('sponsorship/work-auth signal');
  }

  return {
    score,
    reason: experienceExcluded || seniorityExcluded
      ? `requires more than ${maxExperienceYears} years experience`
      : parts.length ? parts.join('; ') : 'weak local match',
    matched_keywords: matchedKeywords,
    negative_matches: negativeMatches,
    sponsorship_signal: sponsorshipMatches.length ? sponsorshipMatches.join('|') : 'unknown',
    experience_years: experienceYears,
    experience_excluded: experienceExcluded || seniorityExcluded,
    seniority_excluded: seniorityExcluded,
    location_excluded: locationExcluded,
  };
}
