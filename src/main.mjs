#!/usr/bin/env node

import { mkdirSync } from 'fs';
import { loadConfig, readArgValue, PATHS } from './config.mjs';
import { fetchCompanyJobs } from './providers.mjs';
import { scoreJob } from './scoring/keyword_score.mjs';
import { reviewJobWithClaude } from './scoring/claude_review.mjs';
import { dedupQueueRows, readQueue, writeQueue } from './queue.mjs';
import { postedWithinDays, readScanHistory, recordScannedJob, scanKey, writeScanHistory } from './scan_history.mjs';
import { prepareApplications, submitApplications } from './apply/browser_prepare.mjs';

function usage() {
  console.log(`Usage:
  npm run find [-- --dry-run] [-- --no-claude] [-- --rescan]
  npm run prepare -- --top 10
  npm run prepare -- --top 10 --dry-run
  npm run apply -- --top 1 --confirm
  node src/main.mjs find|prepare|apply`);
}

function queueRow(job, local, review = null) {
  const reviewScore = typeof review?.score === 'number' ? review.score : null;
  const score = reviewScore ?? local.score;
  const decision = review?.decision || (local.score >= 70 ? 'maybe' : 'skip');
  const applyMode = decision === 'skip'
    ? 'skip'
    : review?.custom_answer_needed
      ? 'manual_review'
      : 'browser_prepare';

  return {
    company: job.company,
    title: job.title,
    location: job.location,
    ats_type: job.ats,
    job_url: job.job_url,
    posted_at: job.posted_at,
    score,
    reason: review?.reason || local.reason,
    matched_keywords: local.matched_keywords.join('|'),
    sponsorship_signal: local.sponsorship_signal,
    apply_mode: applyMode,
    status: applyMode === 'skip' ? 'skipped' : 'queued',
  };
}

async function findCommand(argv) {
  const dryRun = argv.includes('--dry-run');
  const noClaude = argv.includes('--no-claude');
  const rescan = argv.includes('--rescan');
  const { searchRules, companies, candidateProfile } = loadConfig();
  const threshold = Number(searchRules.score_threshold || 70);
  const maxPostedAgeDays = Number(searchRules.max_posted_age_days || 7);
  const includeUnknownDates = searchRules.include_jobs_without_posted_at === true;
  const scanHistory = readScanHistory();
  const scannedAt = new Date().toISOString();

  mkdirSync('data', { recursive: true });

  const rows = [];
  const errors = [];
  let fetched = 0;
  let locallyQualified = 0;
  let filteredExperience = 0;
  let filteredLocation = 0;
  let filteredPostedAge = 0;
  let skippedPreviouslyScanned = 0;
  let reviewed = 0;

  for (const company of companies) {
    try {
      const jobs = await fetchCompanyJobs(company);
      fetched += jobs.length;
      for (const job of jobs) {
        const previouslyScanned = Boolean(scanHistory.jobs[scanKey(job)]);
        if (!dryRun) recordScannedJob(scanHistory, job, scannedAt);
        if (!rescan && previouslyScanned) {
          skippedPreviouslyScanned += 1;
          continue;
        }
        if (!includeUnknownDates && !job.posted_at) {
          filteredPostedAge += 1;
          continue;
        }
        if (job.posted_at && !postedWithinDays(job.posted_at, maxPostedAgeDays)) {
          filteredPostedAge += 1;
          continue;
        }
        const local = scoreJob(job, searchRules);
        if (local.experience_excluded) {
          filteredExperience += 1;
          continue;
        }
        if (local.location_excluded) {
          filteredLocation += 1;
          continue;
        }
        if (local.score < threshold) continue;
        locallyQualified += 1;

        let review = null;
        if (!noClaude) {
          review = await reviewJobWithClaude(job, candidateProfile);
          if (review) reviewed += 1;
        }

        rows.push(queueRow(job, local, review));
      }
    } catch (err) {
      errors.push(`${company.name}: ${err.message}`);
    }
  }

  const existing = readQueue(PATHS.queue).filter(row => (
    includeUnknownDates || postedWithinDays(row.posted_at, maxPostedAgeDays)
  ));
  const merged = dedupQueueRows([...existing, ...rows]).sort((a, b) => Number(b.score) - Number(a.score));

  if (!dryRun) {
    writeQueue(merged, PATHS.queue);
    writeScanHistory(scanHistory);
  }

  console.log(`Find ${dryRun ? '(dry-run)' : '(live)'}`);
  console.log(`Companies scanned: ${companies.length}`);
  console.log(`Jobs fetched: ${fetched}`);
  console.log(`Filtered by experience: ${filteredExperience}`);
  console.log(`Filtered by location: ${filteredLocation}`);
  console.log(`Filtered by posted age: ${filteredPostedAge}`);
  console.log(`Skipped previously scanned: ${skippedPreviouslyScanned}`);
  console.log(`Locally qualified: ${locallyQualified}`);
  console.log(`Claude reviewed: ${reviewed}`);
  console.log(`Queued rows: ${dryRun ? rows.length : merged.length}`);
  if (!process.env.ANTHROPIC_API_KEY && !noClaude) {
    console.log('Claude review skipped: ANTHROPIC_API_KEY is not set');
  }
  if (errors.length) {
    console.log('\nErrors:');
    for (const error of errors) console.log(`- ${error}`);
  }
  if (rows.length) {
    console.log('\nTop matches:');
    for (const row of rows.sort((a, b) => Number(b.score) - Number(a.score)).slice(0, 10)) {
      console.log(`- ${row.score} ${row.company} | ${row.title} | ${row.location || 'N/A'}`);
    }
  }
}

async function prepareCommand(argv) {
  const top = Number(readArgValue(argv, '--top', '10'));
  const dryRun = argv.includes('--dry-run');
  const { searchRules, candidateProfile } = loadConfig();
  const queued = readQueue(PATHS.queue)
    .filter(row => row.status === 'queued' && row.apply_mode !== 'skip')
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, top);

  if (!queued.length) {
    console.log('No queued jobs found. Run npm run find first.');
    return;
  }

  if (dryRun) {
    console.log(`Prepare (dry-run): ${queued.length} job(s) selected`);
    for (const job of queued) {
      console.log(`- ${job.company} | ${job.title} | ${job.job_url}`);
    }
    console.log('No browser opened and no form fields filled.');
    return;
  }

  await prepareApplications(queued, candidateProfile, searchRules.resume_path);
}

async function applyCommand(argv) {
  const confirm = argv.includes('--confirm');
  if (!confirm) {
    console.log('Apply requires explicit confirmation. Use: npm run apply -- --top 1 --confirm');
    return;
  }

  const top = Number(readArgValue(argv, '--top', '1'));
  const { searchRules, candidateProfile } = loadConfig();
  const queued = readQueue(PATHS.queue)
    .filter(row => row.status === 'queued' && row.apply_mode !== 'skip')
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, top);

  if (!queued.length) {
    console.log('No queued jobs found. Run npm run find first.');
    return;
  }

  await submitApplications(queued, candidateProfile, searchRules.resume_path);
}

const [command, ...argv] = process.argv.slice(2);

try {
  if (command === 'find') await findCommand(argv);
  else if (command === 'prepare') await prepareCommand(argv);
  else if (command === 'apply') await applyCommand(argv);
  else usage();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
