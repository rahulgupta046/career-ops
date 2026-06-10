#!/usr/bin/env node
import { createServer } from 'http';
import { readFileSync, writeFileSync } from 'fs';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { loadConfig, PATHS } from '../config.mjs';
import { exportQueue, getJobById, listApplications, listJobs, listSources, markSkipped, scan } from '../workbench.mjs';
import { prepareJob, submitPreparedJob } from '../apply/browser_prepare.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

function json(res, status, body) {
  if (res.headersSent) {
    if (!res.writableEnded) res.end();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
function profilePayload() {
  const { candidateProfile } = loadConfig();
  const unverified = new Set(candidateProfile.unverified_fields || []);
  const fields = ['name', 'email', 'phone', 'linkedin', 'github', 'website', 'location', 'city', 'country', 'work_authorized', 'needs_sponsorship'];
  return { resume_verified: candidateProfile.resume_verified === true, fields: fields.map(key => ({ key, value: candidateProfile[key] ?? '', verified: !unverified.has(key) })) };
}
function staticFile(pathname, res) {
  const file = normalize(join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname.slice(1)));
  if (!file.startsWith(PUBLIC_DIR)) return json(res, 403, { error: 'Forbidden' });
  try {
    const content = readFileSync(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch { json(res, 404, { error: 'Not found' }); }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/jobs') return json(res, 200, { jobs: listJobs() });
    if (req.method === 'GET' && url.pathname.startsWith('/api/jobs/')) return json(res, 200, { job: getJobById(url.pathname.split('/').pop()) });
    if (req.method === 'GET' && url.pathname === '/api/applications') return json(res, 200, { applications: listApplications() });
    if (req.method === 'GET' && url.pathname === '/api/sources') return json(res, 200, { sources: listSources() });
    if (req.method === 'GET' && url.pathname === '/api/profile') return json(res, 200, profilePayload());
    if (req.method === 'POST' && url.pathname === '/api/profile/confirm') {
      const config = yaml.load(readFileSync(PATHS.candidateProfile, 'utf8'));
      config.resume_verified = true;
      writeFileSync(PATHS.candidateProfile, yaml.dump(config, { lineWidth: 100 }));
      return json(res, 200, profilePayload());
    }
    if (req.method === 'POST' && url.pathname === '/api/scan') return json(res, 200, await scan({ noClaude: true }));
    if (req.method === 'POST' && url.pathname === '/api/export') return json(res, 200, exportQueue());
    if (req.method === 'POST' && url.pathname === '/api/skip') {
      const input = await body(req); markSkipped(input.job_id); return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/prepare') {
      const input = await body(req); const job = getJobById(input.job_id);
      if (!job) return json(res, 404, { error: 'Unknown job' });
      const { searchRules, candidateProfile } = loadConfig();
      if (!candidateProfile.resume_verified) return json(res, 409, { error: 'Confirm the extracted resume profile first' });
      const result = await prepareJob(job, candidateProfile, searchRules.resume_path, { safeAutofillFields: searchRules.safe_autofill_fields });
      return json(res, 200, { result: { ...result, browser: undefined } });
    }
    if (req.method === 'POST' && url.pathname === '/api/submit') {
      const input = await body(req); const job = getJobById(input.job_id);
      if (!job) return json(res, 404, { error: 'Unknown job' });
      const { searchRules, candidateProfile } = loadConfig();
      return json(res, 200, { result: await submitPreparedJob(job, candidateProfile, searchRules.resume_path, input.review_token) });
    }
    if (req.method === 'GET') return staticFile(url.pathname, res);
    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) { return json(res, 500, { error: error.message }); }
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.log(`Application Workbench already running: http://${HOST}:${PORT}`);
    process.exit(0);
  }
  throw error;
});

server.listen(PORT, HOST, () => console.log(`Application Workbench: http://${HOST}:${PORT}`));
