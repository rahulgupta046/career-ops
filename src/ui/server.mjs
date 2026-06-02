#!/usr/bin/env node

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, PATHS } from '../config.mjs';
import { readQueue } from '../queue.mjs';
import { prepareApplications } from '../apply/browser_prepare.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));
const openBrowsers = new Set();

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function publicProfile(profile) {
  const fields = ['name', 'email', 'phone', 'linkedin', 'github', 'website', 'location', 'city', 'country', 'work_authorized'];
  const unverified = new Set(profile.unverified_fields || []);
  return fields.map(key => ({
    key,
    label: key.replaceAll('_', ' '),
    value: profile[key] || '',
    verified: !unverified.has(key),
  }));
}

async function requestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function serveStatic(pathname, response) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = normalize(join(PUBLIC_DIR, relative));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const content = readFileSync(filePath);
    response.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${HOST}:${PORT}`);

  if (request.method === 'GET' && url.pathname === '/api/jobs') {
    return json(response, 200, { jobs: readQueue(PATHS.queue) });
  }

  if (request.method === 'GET' && url.pathname === '/api/profile') {
    const { candidateProfile } = loadConfig();
    return json(response, 200, { fields: publicProfile(candidateProfile) });
  }

  if (request.method === 'POST' && url.pathname === '/api/prepare') {
    try {
      const { job_url: jobUrl } = await requestBody(request);
      const job = readQueue(PATHS.queue).find(row => row.job_url === jobUrl);
      if (!job) return json(response, 404, { error: 'Job not found in queue' });

      const { searchRules, candidateProfile } = loadConfig();
      const prepared = await prepareApplications([job], candidateProfile, searchRules.resume_path);
      openBrowsers.add(prepared.browser);
      prepared.browser.on('disconnected', () => openBrowsers.delete(prepared.browser));
      return json(response, 200, { result: prepared.results[0] });
    } catch (error) {
      return json(response, 500, { error: error.message });
    }
  }

  if (request.method === 'GET') return serveStatic(url.pathname, response);
  return json(response, 405, { error: 'Method not allowed' });
});

server.listen(PORT, HOST, () => {
  console.log(`Job Finder UI: http://${HOST}:${PORT}`);
});

