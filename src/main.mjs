#!/usr/bin/env node

import { readArgValue, loadConfig } from './config.mjs';
import { exportQueue, getJobById, scan } from './workbench.mjs';
import { prepareJob, submitPreparedJob } from './apply/browser_prepare.mjs';

function usage() {
  console.log(`Usage:
  npm run scan [-- --dry-run] [-- --rescore] [-- --no-claude]
  npm run prepare -- --job <id>
  npm run apply -- --job <id> --token <review-token> --confirm
  npm run export`);
}

async function prepare(argv) {
  const id = Number(readArgValue(argv, '--job'));
  const job = getJobById(id);
  if (!job) throw new Error(`Unknown job id: ${id}`);
  const { searchRules, candidateProfile } = loadConfig();
  const result = await prepareJob(job, candidateProfile, searchRules.resume_path, { safeAutofillFields: searchRules.safe_autofill_fields });
  console.log(`${result.status}: ${job.company} - ${job.title}`);
  if (result.review_token) console.log(`Review token: ${result.review_token}`);
}

async function apply(argv) {
  if (!argv.includes('--confirm')) throw new Error('Apply requires explicit --confirm');
  const id = Number(readArgValue(argv, '--job'));
  const token = readArgValue(argv, '--token');
  const job = getJobById(id);
  if (!job) throw new Error(`Unknown job id: ${id}`);
  const { searchRules, candidateProfile } = loadConfig();
  const result = await submitPreparedJob(job, candidateProfile, searchRules.resume_path, token);
  console.log(`${result.confirmed ? 'APPLIED_CONFIRMED' : 'SUBMIT_UNCONFIRMED'}: ${job.company} - ${job.title}`);
}

const [command, ...argv] = process.argv.slice(2);
try {
  if (command === 'scan' || command === 'find') {
    const result = await scan({ dryRun: argv.includes('--dry-run'), rescore: argv.includes('--rescore'), noClaude: argv.includes('--no-claude') });
    console.log(JSON.stringify(result, null, 2));
  } else if (command === 'prepare') await prepare(argv);
  else if (command === 'apply') await apply(argv);
  else if (command === 'export') console.log(JSON.stringify(exportQueue(), null, 2));
  else usage();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
