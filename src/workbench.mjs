import { createHash, randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { db } from './storage/db.mjs';
import { loadConfig, PATHS, readYaml } from './config.mjs';
import { discoverJobs } from './discovery/sources.mjs';
import { eligibility, rankScores, SCORING_VERSION } from './scoring/rank.mjs';
import { scoreResume } from './scoring/ats_score.mjs';
import { reviewJobWithClaude } from './scoring/claude_review.mjs';
import { serializeCsv } from './queue.mjs';

function now() {
  return new Date().toISOString();
}

function getJob(database, job) {
  return database.prepare(`
    SELECT * FROM jobs
    WHERE (source = ? AND source_job_id <> '' AND source_job_id = ?)
       OR job_url = ?
       OR identity_hash = ?
    LIMIT 1
  `).get(job.source, job.source_job_id, job.job_url, job.identity_hash);
}

function saveJob(database, job, eligible, timestamp) {
  const existing = getJob(database, job);
  const firstSeen = existing?.first_seen_at || timestamp;
  const sponsorship = eligible.sponsorship || existing?.sponsorship_signal || 'unknown';
  const values = {
    ...job,
    first_seen_at: firstSeen,
    last_seen_at: timestamp,
    eligibility: eligible.ok ? 'eligible' : 'excluded',
    exclusion_reason: eligible.reason || '',
    sponsorship_signal: sponsorship,
  };
  if (existing) {
    database.prepare(`
      UPDATE jobs SET source=@source, source_job_id=@source_job_id, company=@company, title=@title,
      location=@location, description=@description, job_url=@job_url, apply_url=@apply_url,
      posted_at=@posted_at, last_seen_at=@last_seen_at, description_hash=@description_hash,
      identity_hash=@identity_hash, source_confidence=@source_confidence, eligibility=@eligibility,
      exclusion_reason=@exclusion_reason, sponsorship_signal=@sponsorship_signal WHERE id=@id
    `).run({ ...values, id: existing.id });
    return { id: existing.id, changed: existing.description_hash !== job.description_hash || existing.posted_at !== job.posted_at };
  }
  const result = database.prepare(`
    INSERT INTO jobs(source,source_job_id,company,title,location,description,job_url,apply_url,posted_at,
      first_seen_at,last_seen_at,description_hash,identity_hash,source_confidence,eligibility,exclusion_reason,sponsorship_signal)
    VALUES(@source,@source_job_id,@company,@title,@location,@description,@job_url,@apply_url,@posted_at,
      @first_seen_at,@last_seen_at,@description_hash,@identity_hash,@source_confidence,@eligibility,@exclusion_reason,@sponsorship_signal)
  `).run(values);
  return { id: Number(result.lastInsertRowid), changed: true };
}

function skillDetails(result) {
  const hardSkill = result.ats.tiers.match?.checks.find(check => check.id === 'hard-skill-overlap');
  return {
    matched: result.matched_skills || hardSkill?.message || '',
    missing: JSON.stringify(result.missing_skills || []),
  };
}

export async function scan({ dryRun = false, rescore = false, noClaude = false } = {}) {
  const database = db();
  const { searchRules, candidateProfile } = loadConfig();
  if (!candidateProfile.resume_verified && !dryRun) {
    throw new Error('Confirm the extracted resume profile in the UI before running a live scan');
  }
  const integrations = readYaml(PATHS.integrations);
  const started = now();
  const run = dryRun ? null : database.prepare('INSERT INTO scan_runs(started_at,dry_run,status) VALUES(?,?,?)').run(started, 0, 'running');
  const discovery = await discoverJobs();
  const counters = { fetched: 0, eligible: 0, evaluated: 0, unchanged: 0, excluded: 0, reviewed: 0 };
  const reviewCandidates = [];

  for (const result of discovery) {
    counters.fetched += result.jobs.length;
    const healthStatus = result.error || result.errors?.length ? 'warning' : 'healthy';
    if (!dryRun) database.prepare(`
      INSERT INTO source_health(source,status,last_checked_at,job_count,error) VALUES(?,?,?,?,?)
      ON CONFLICT(source) DO UPDATE SET status=excluded.status,last_checked_at=excluded.last_checked_at,job_count=excluded.job_count,error=excluded.error
    `).run(result.source, healthStatus, started, result.jobs.length, result.error || (result.errors || []).join('; '));

    for (const job of result.jobs) {
      if (!job.company || !job.title || !job.job_url) continue;
      const eligible = eligibility(job, searchRules);
      if (!eligible.ok) counters.excluded += 1;
      if (dryRun) {
        if (eligible.ok) counters.eligible += 1;
        continue;
      }
      const saved = saveJob(database, job, eligible, started);
      database.prepare('INSERT INTO job_observations(job_id,source,source_job_id,job_url,observed_at,description_hash) VALUES(?,?,?,?,?,?)')
        .run(saved.id, job.source, job.source_job_id, job.job_url, started, job.description_hash);
      if (!eligible.ok) continue;
      counters.eligible += 1;
      const previous = database.prepare('SELECT * FROM evaluations WHERE job_id=?').get(saved.id);
      if (!rescore && previous && !saved.changed && previous.scoring_version === SCORING_VERSION) {
        counters.unchanged += 1;
        continue;
      }
      const scored = scoreResume(job);
      const ranks = rankScores(job, scored.ats.score, eligible);
      const skills = skillDetails(scored);
      database.prepare(`
        INSERT INTO evaluations(job_id,scoring_version,ats_score,ats_rating,parsing_score,match_score,recruiter_score,fit_score,recency_score,rank_score,matched_skills,missing_skills,knockout_signals,summary,evaluated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(job_id) DO UPDATE SET scoring_version=excluded.scoring_version,ats_score=excluded.ats_score,
        ats_rating=excluded.ats_rating,parsing_score=excluded.parsing_score,match_score=excluded.match_score,
        recruiter_score=excluded.recruiter_score,fit_score=excluded.fit_score,recency_score=excluded.recency_score,
        rank_score=excluded.rank_score,matched_skills=excluded.matched_skills,missing_skills=excluded.missing_skills,
        knockout_signals=excluded.knockout_signals,summary=excluded.summary,evaluated_at=excluded.evaluated_at
      `).run(saved.id, SCORING_VERSION, scored.ats.score, scored.ats.rating, scored.ats.tiers.parsing.score,
        scored.ats.tiers.match?.score || 0, scored.ats.tiers.recruiter.score, ranks.fit_score, ranks.recency_score,
        ranks.rank_score, skills.matched, skills.missing, JSON.stringify(scored.ats.knockouts), scored.ats.summary, started);
      database.prepare(`INSERT INTO applications(job_id,status,updated_at) VALUES(?,?,?) ON CONFLICT(job_id) DO NOTHING`).run(saved.id, 'queued', started);
      counters.evaluated += 1;
      if (scored.ats.score >= Number(integrations.claude?.minimum_ats_score || 75) && ranks.rank_score >= Number(integrations.claude?.minimum_rank_score || 75)) {
        reviewCandidates.push({ id: saved.id, job, rank: ranks.rank_score });
      }
    }
  }

  if (!dryRun && !noClaude && integrations.claude?.enabled !== false) {
    const limit = Number(integrations.claude?.max_reviews_per_scan || 20);
    for (const candidate of reviewCandidates.sort((a, b) => b.rank - a.rank).slice(0, limit)) {
      const review = await reviewJobWithClaude(candidate.job, candidateProfile);
      if (!review) break;
      database.prepare('UPDATE evaluations SET claude_review=? WHERE job_id=?').run(JSON.stringify({ ...review, reviewed_at: now(), model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5' }), candidate.id);
      counters.reviewed += 1;
    }
  }

  if (!dryRun) database.prepare('UPDATE scan_runs SET finished_at=?, fetched_count=?, qualified_count=?, status=?, summary=? WHERE id=?')
    .run(now(), counters.fetched, counters.eligible, 'completed', JSON.stringify(counters), run.lastInsertRowid);
  return { counters, sources: discovery.map(item => ({ source: item.source, count: item.jobs.length, error: item.error || (item.errors || []).join('; ') })) };
}

export function listJobs() {
  return db().prepare(`
    SELECT j.*, e.ats_score,e.ats_rating,e.parsing_score,e.match_score,e.recruiter_score,e.fit_score,e.recency_score,e.rank_score,
      e.matched_skills,e.missing_skills,e.knockout_signals,e.summary,e.claude_review,a.status AS application_status,a.preparation_report,a.review_token
    FROM jobs j JOIN evaluations e ON e.job_id=j.id LEFT JOIN applications a ON a.job_id=j.id
    WHERE j.eligibility='eligible' ORDER BY e.rank_score DESC, j.source_confidence DESC, j.posted_at DESC
  `).all();
}

export function getJobById(id) {
  return listJobs().find(job => Number(job.id) === Number(id));
}

export function listApplications() {
  return db().prepare('SELECT a.*,j.company,j.title,j.apply_url FROM applications a JOIN jobs j ON j.id=a.job_id ORDER BY a.updated_at DESC').all();
}

export function listSources() {
  return db().prepare('SELECT * FROM source_health ORDER BY source').all();
}

export function markSkipped(id) {
  db().prepare('UPDATE applications SET status=?,updated_at=? WHERE job_id=?').run('skipped', now(), id);
}

export function savePreparation(id, report) {
  const token = randomUUID();
  db().prepare('UPDATE applications SET status=?,preparation_report=?,review_token=?,reviewed_at=?,updated_at=? WHERE job_id=?')
    .run(report.validation.ok ? 'prepared' : 'blocked', JSON.stringify(report), report.validation.ok ? token : '', report.validation.ok ? now() : null, now(), id);
  return token;
}

export function consumeReviewToken(id, token) {
  const app = db().prepare('SELECT * FROM applications WHERE job_id=?').get(id);
  if (!app || app.status !== 'prepared' || !token || token !== app.review_token) return false;
  db().prepare('UPDATE applications SET review_token=? WHERE job_id=?').run('', id);
  return true;
}

export function recordSubmission(id, result) {
  db().prepare('UPDATE applications SET status=?,submitted_at=?,final_url=?,updated_at=? WHERE job_id=?')
    .run(result.confirmed ? 'submitted_confirmed' : 'submit_unconfirmed', now(), result.final_url || '', now(), id);
}

export function exportQueue() {
  const rows = listJobs().map(job => ({
    company: job.company, title: job.title, location: job.location, ats_type: job.source, job_url: job.apply_url,
    posted_at: job.posted_at, score: job.rank_score, reason: job.summary, matched_keywords: job.matched_skills,
    sponsorship_signal: job.sponsorship_signal, apply_mode: 'review_first', status: job.application_status,
  }));
  mkdirSync(dirname(PATHS.exportQueue), { recursive: true });
  writeFileSync(PATHS.exportQueue, serializeCsv(rows));
  return { path: PATHS.exportQueue, count: rows.length };
}
