import { spawnSync } from 'child_process';
import { PATHS, readYaml } from '../config.mjs';
import { normalizeJob } from './normalize.mjs';

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), ...options });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function everJobs(integrations, sources) {
  const cfg = integrations.ever_jobs;
  if (!cfg?.enabled || process.env.DISABLE_EVER_JOBS === '1') return { source: 'ever-jobs', jobs: [], skipped: true };
  const jobs = [];
  const errors = [];
  const companySources = sources.ever_jobs_company_sources || [];
  let index = 0;
  async function worker() {
    while (index < companySources.length) {
      const source = companySources[index];
      index += 1;
      await fetchSource(source);
    }
  }
  async function fetchSource(source) {
    try {
      const body = { siteType: [source], hoursOld: 168, resultsWanted: 100, descriptionFormat: 'markdown' };
      const result = await fetchJson(`${cfg.base_url}/api/jobs/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      jobs.push(...(result.jobs || []).map(raw => normalizeJob(raw, `ever-jobs:${source}`)));
    } catch (error) {
      errors.push(`${source}: ${error.message}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, companySources.length) }, () => worker()));
  return { source: 'ever-jobs', jobs, errors };
}

function jobSpy(integrations, sources) {
  const cfg = integrations.jobspy;
  if (!cfg?.enabled || process.env.DISABLE_JOBSPY === '1') return { source: 'jobspy', jobs: [], skipped: true };
  const jobs = [];
  for (const query of sources.board_searches || []) {
    const result = spawnSync(cfg.python || '.venv/bin/python', ['workers/jobspy_worker.py'], {
      input: JSON.stringify({ sites: cfg.sites, term: query.term, location: query.location, hours_old: 168 }),
      encoding: 'utf8',
      timeout: 120000,
    });
    if (result.status !== 0) throw new Error(result.stderr || 'JobSpy worker failed');
    jobs.push(...JSON.parse(result.stdout).jobs.map(raw => normalizeJob(raw, raw.source)));
  }
  return { source: 'jobspy', jobs };
}

export async function discoverJobs() {
  const integrations = readYaml(PATHS.integrations);
  const sources = readYaml(PATHS.sources);
  const results = [];
  try {
    results.push(await everJobs(integrations, sources));
  } catch (error) {
    results.push({ source: 'ever-jobs', jobs: [], error: error.message });
  }
  try {
    results.push(jobSpy(integrations, sources));
  } catch (error) {
    results.push({ source: 'jobspy', jobs: [], error: error.message });
  }
  return results;
}
