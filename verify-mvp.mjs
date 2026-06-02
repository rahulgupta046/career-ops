#!/usr/bin/env node

import assert from 'assert/strict';
import { existsSync } from 'fs';
import { locationMatches, scoreJob } from './src/scoring/keyword_score.mjs';
import { parseCsvLine, serializeCsv } from './src/queue.mjs';
import { loadConfig } from './src/config.mjs';
import { classifyLiveness } from './liveness-core.mjs';
import { postedWithinDays, recordScannedJob, scanKey } from './src/scan_history.mjs';

const { searchRules, companies } = loadConfig();

assert.ok(existsSync('config/search_rules.yml'), 'missing config/search_rules.yml');
assert.ok(existsSync('config/companies.yml'), 'missing config/companies.yml');
assert.ok(existsSync('config/candidate_profile.yml'), 'missing config/candidate_profile.yml');
assert.ok(existsSync('src/ui/server.mjs'), 'missing UI server');
assert.ok(existsSync('src/ui/public/index.html'), 'missing UI page');
assert.ok(companies.length > 0, 'companies list must not be empty');

const strong = scoreJob({
  title: 'Backend Machine Learning Engineer',
  location: 'Remote, United States',
  description: 'Python SQL AWS Spark Databricks backend distributed systems machine learning LLM RAG visa sponsorship',
}, searchRules);
assert.ok(strong.score >= 70, `strong match should pass threshold, got ${strong.score}`);
assert.ok(strong.sponsorship_signal !== 'unknown', 'sponsorship signal should be detected');

const negative = scoreJob({
  title: 'Principal Intern',
  location: 'Remote, United States',
  description: 'unpaid internship contract only clearance required',
}, searchRules);
assert.ok(negative.score < 70, `negative match should not pass threshold, got ${negative.score}`);
assert.ok(negative.negative_matches.length > 0, 'negative keywords should be detected');

const tooExperienced = scoreJob({
  title: 'Backend Engineer',
  location: 'Remote, United States',
  description: 'Requires 5+ years of experience with Python SQL AWS backend systems.',
}, searchRules);
assert.equal(tooExperienced.experience_excluded, true, 'roles above 3 years should be filtered');

const allowedExperience = scoreJob({
  title: 'Backend Engineer',
  location: 'Remote, United States',
  description: 'Requires 3+ years of experience with Python SQL AWS backend systems.',
}, searchRules);
assert.equal(allowedExperience.experience_excluded, false, '3+ years should remain allowed');

const seniorTitle = scoreJob({
  title: 'Senior Backend Engineer',
  location: 'Remote, United States',
  description: 'Python SQL AWS backend systems.',
}, searchRules);
assert.equal(seniorTitle.experience_excluded, true, 'senior roles should be filtered under 3-year max');
assert.equal(locationMatches('Remote (Buenos Aires, Argentina)', searchRules.locations), false, 'foreign remote roles should not match generic Remote');
assert.equal(locationMatches('Remote, US', searchRules.locations), true, 'US remote roles should match');
assert.equal(scoreJob({
  title: 'Backend Engineer',
  location: 'Remote (Buenos Aires, Argentina)',
  description: 'Python SQL AWS backend systems.',
}, searchRules).location_excluded, true, 'non-target locations should be filtered');

const now = new Date('2026-06-02T12:00:00.000Z');
assert.equal(postedWithinDays('2026-05-28T12:00:00.000Z', 7, now), true, 'five-day-old jobs should pass latest filter');
assert.equal(postedWithinDays('2026-05-20T12:00:00.000Z', 7, now), false, 'old jobs should fail latest filter');
const history = { jobs: {} };
const scannedJob = { ats: 'greenhouse', job_id: '123', job_url: 'https://example.com/jobs/123', company: 'Example', title: 'Engineer', posted_at: '2026-06-01T00:00:00.000Z' };
recordScannedJob(history, scannedJob, '2026-06-02T12:00:00.000Z');
assert.ok(history.jobs[scanKey(scannedJob)], 'scan registry should record normalized ATS job key');

const csv = serializeCsv([{ company: 'A, Inc', title: 'Engineer', location: '', ats_type: 'greenhouse', job_url: 'https://example.com', posted_at: '2026-06-01T00:00:00.000Z', score: 90, reason: 'a,b', matched_keywords: 'python|sql', sponsorship_signal: 'unknown', apply_mode: 'manual_review', status: 'queued' }]);
assert.equal(parseCsvLine(csv.split('\n')[1])[0], 'A, Inc', 'CSV parser should handle quoted commas');

const live = classifyLiveness({ status: 200, finalUrl: 'https://example.com', bodyText: 'x'.repeat(400), applyControls: ['Apply now'] });
assert.equal(live.result, 'active', 'liveness should detect apply control');

console.log('MVP verification passed');
