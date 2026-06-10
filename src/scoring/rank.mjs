import { scoreJob } from './keyword_score.mjs';

export const SCORING_VERSION = 'workbench-v1';

export function sponsorshipSignal(text) {
  const value = String(text || '').toLowerCase();
  if (/no(?:t)?\s+(?:offer|provide|available|support).{0,35}sponsor|without sponsorship|must be (?:a )?u\.?s\.? citizen|u\.?s\.? citizenship required|security clearance required/.test(value)) return 'explicit_no';
  if (/h-?1b|visa sponsorship|immigration support|sponsor(?:ship)?/.test(value)) return 'positive';
  return 'unknown';
}

export function eligibility(job, rules, now = new Date()) {
  const posted = Date.parse(job.posted_at);
  const allowMissingPostedAt = rules.include_jobs_without_posted_at === true;
  if (!Number.isFinite(posted) && !allowMissingPostedAt) return { ok: false, reason: 'posted date unavailable' };
  const ageDays = Number.isFinite(posted) ? (now.getTime() - posted) / 86400000 : 0;
  if (Number.isFinite(posted) && (ageDays < 0 || ageDays > Number(rules.max_posted_age_days || 7))) return { ok: false, reason: 'outside posted-age window' };
  const local = scoreJob(job, rules);
  if (local.experience_excluded) return { ok: false, reason: local.reason };
  if (local.role_excluded) return { ok: false, reason: local.reason };
  if (local.missing_must_have) return { ok: false, reason: local.reason };
  if (local.location_excluded) return { ok: false, reason: 'outside target locations' };
  if (local.negative_matches.length) return { ok: false, reason: `negative keywords: ${local.negative_matches.join(', ')}` };
  const sponsorship = sponsorshipSignal(`${job.title} ${job.description}`);
  if (sponsorship === 'explicit_no') return { ok: false, reason: 'explicit sponsorship or citizenship restriction', sponsorship };
  if (local.score < Number(rules.score_threshold || 0)) return { ok: false, reason: `below local fit threshold: ${local.score}`, local, sponsorship, ageDays };
  return { ok: true, reason: local.reason, local, sponsorship, ageDays };
}

export function rankScores(job, atsScore, eligible) {
  const fit = Math.min(100, eligible.local.score);
  const recency = Math.max(0, 100 - (eligible.ageDays / 7) * 100);
  const rank = atsScore * 0.65 + fit * 0.25 + recency * 0.10;
  return { fit_score: fit, recency_score: recency, rank_score: Math.round(rank * 10) / 10 };
}
