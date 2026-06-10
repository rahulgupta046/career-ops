import { createHash } from 'crypto';

function hash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function text(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function locationText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return [value.city, value.state, value.country].filter(Boolean).join(', ');
}

function isoDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function normalizeJob(raw, source = 'unknown') {
  const company = text(raw.company || raw.companyName);
  const title = text(raw.title);
  const location = text(locationText(raw.location));
  const description = text(raw.description || raw.body);
  const jobUrl = text(raw.job_url || raw.jobUrl || raw.url);
  const applyUrl = text(raw.apply_url || raw.jobUrlDirect || raw.job_url_direct || jobUrl);
  const sourceJobId = text(raw.source_job_id || raw.job_id || raw.id);
  const postedAt = raw.posted_at || raw.datePosted || raw.date_posted || raw.postedAt || '';
  const identity = `${company}|${title}|${location}`.toLowerCase();
  return {
    source: text(raw.source || source),
    source_job_id: sourceJobId,
    company,
    title,
    location,
    description,
    job_url: jobUrl,
    apply_url: applyUrl,
    posted_at: isoDate(postedAt),
    description_hash: hash(description),
    identity_hash: hash(identity),
    source_confidence: Number(raw.source_confidence || (source.includes('jobspy') ? 55 : 90)),
  };
}
