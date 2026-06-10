#!/usr/bin/env node
import assert from 'assert/strict';
import { existsSync } from 'fs';
import { normalizeJob } from './src/discovery/normalize.mjs';
import { loadConfig } from './src/config.mjs';
import { locationMatches, scoreJob } from './src/scoring/keyword_score.mjs';
import { eligibility, sponsorshipSignal } from './src/scoring/rank.mjs';
import { scoreResume } from './src/scoring/ats_score.mjs';

const { searchRules } = loadConfig();
assert.ok(existsSync('config/resume.yml'));
assert.ok(existsSync('config/integrations.yml'));
assert.ok(existsSync('config/sources.yml'));
assert.ok(existsSync('src/storage/db.mjs'));
assert.ok(existsSync('workers/jobspy_worker.py'));

const recent = '2026-06-01T12:00:00.000Z';
const normalized = normalizeJob({ id: '1', companyName: 'Example', title: 'Backend Engineer', location: { city: 'Seattle', state: 'WA', country: 'US' }, description: 'Python SQL AWS backend systems', jobUrl: 'https://example.com/jobs/1', datePosted: recent }, 'test');
assert.equal(normalized.company, 'Example');
assert.equal(normalized.apply_url, normalized.job_url);
assert.ok(normalized.description_hash);
assert.equal(locationMatches('Remote (Buenos Aires, Argentina)', searchRules.locations), false);
assert.equal(locationMatches('Remote, US', searchRules.locations), true);
assert.equal(sponsorshipSignal('Candidates must be US citizens.'), 'explicit_no');
assert.equal(sponsorshipSignal('We support H-1B visa sponsorship.'), 'positive');

const strong = { ...normalized, description: 'Python SQL AWS Spark Databricks backend distributed systems machine learning LLM RAG visa sponsorship', posted_at: recent };
assert.ok(scoreJob(strong, searchRules).score >= 70);
assert.equal(eligibility(strong, searchRules, new Date('2026-06-02T12:00:00Z')).ok, true);
assert.equal(eligibility({ ...strong, description: 'Must be US citizens.' }, searchRules, new Date('2026-06-02T12:00:00Z')).ok, false);
assert.equal(scoreJob({ title: 'Senior Backend Engineer', description: 'Python', location: 'Remote, US' }, searchRules).experience_excluded, true);
assert.equal(scoreJob({ title: 'Backend Engineer', description: 'Requires 5+ years of experience with Python', location: 'Remote, US' }, searchRules).experience_excluded, true);

const ats = scoreResume(strong);
assert.equal(typeof ats.ats.score, 'number');
assert.ok(ats.ats.tiers.parsing);
assert.ok(ats.ats.tiers.match);
assert.ok(ats.ats.tiers.recruiter);

console.log('Workbench verification passed');
