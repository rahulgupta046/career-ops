import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { PATHS } from './config.mjs';

export function scanKey(job) {
  const ats = String(job.ats || job.ats_type || 'unknown').trim().toLowerCase();
  const id = String(job.job_id || '').trim().toLowerCase();
  const url = String(job.job_url || '').trim().toLowerCase();
  return id ? `${ats}:${id}` : `${ats}:url:${url}`;
}

export function readScanHistory(path = PATHS.scannedJobs) {
  if (!existsSync(path)) return { jobs: {} };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed?.jobs ? parsed : { jobs: {} };
  } catch {
    return { jobs: {} };
  }
}

export function recordScannedJob(history, job, scannedAt = new Date().toISOString()) {
  const key = scanKey(job);
  if (!key || key.endsWith(':url:')) return;
  const previous = history.jobs[key] || {};
  history.jobs[key] = {
    ats: job.ats,
    job_id: job.job_id || '',
    job_url: job.job_url,
    company: job.company,
    title: job.title,
    posted_at: job.posted_at || '',
    first_seen_at: previous.first_seen_at || scannedAt,
    last_seen_at: scannedAt,
  };
}

export function writeScanHistory(history, path = PATHS.scannedJobs) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
}

export function postedWithinDays(postedAt, maxAgeDays, now = new Date()) {
  if (!postedAt) return false;
  const timestamp = Date.parse(postedAt);
  if (!Number.isFinite(timestamp)) return false;
  const ageMs = now.getTime() - timestamp;
  return ageMs >= 0 && ageMs <= Number(maxAgeDays) * 24 * 60 * 60 * 1000;
}
