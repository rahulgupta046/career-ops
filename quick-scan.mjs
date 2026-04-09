#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = process.cwd();
const PORTALS_PATH = join(PROJECT_ROOT, 'portals.yml');
const PIPELINE_PATH = join(PROJECT_ROOT, 'data', 'pipeline.md');
const APPLICATIONS_PATH = join(PROJECT_ROOT, 'data', 'applications.md');
const HISTORY_PATH = join(PROJECT_ROOT, 'data', 'scan-history.tsv');

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');

function parseScalar(raw) {
  const value = raw.trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function parsePortalsYaml(content) {
  const cfg = {
    title_filter: { positive: [], negative: [], seniority_boost: [] },
    tracked_companies: [],
  };

  const lines = content.split(/\r?\n/);
  let section = '';
  let titleSubsection = '';
  let currentCompany = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const topLevelKeyMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*$/);
    if (topLevelKeyMatch) {
      const key = topLevelKeyMatch[1];
      if (key === 'title_filter') {
        section = 'title_filter';
      } else if (key === 'tracked_companies') {
        section = 'tracked_companies';
      } else {
        section = '';
      }
      titleSubsection = '';
      currentCompany = null;
      continue;
    }

    if (section === 'title_filter') {
      const sectionMatch = trimmed.match(/^(positive|negative|seniority_boost):$/);
      if (sectionMatch) {
        titleSubsection = sectionMatch[1];
        continue;
      }

      const listMatch = trimmed.match(/^-\s+(.+)$/);
      if (listMatch && titleSubsection) {
        cfg.title_filter[titleSubsection].push(String(parseScalar(listMatch[1])));
      }
      continue;
    }

    if (section === 'tracked_companies') {
      const itemMatch = line.match(/^\s*-\s+name:\s*(.+)$/);
      if (itemMatch) {
        currentCompany = { name: String(parseScalar(itemMatch[1])) };
        cfg.tracked_companies.push(currentCompany);
        continue;
      }

      if (!currentCompany) continue;

      const kvMatch = line.match(/^\s+([a-zA-Z0-9_]+):\s*(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const rawValue = kvMatch[2];
        currentCompany[key] = parseScalar(rawValue);
      }
    }
  }

  return cfg;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeKey(a, b) {
  return `${normalizeText(a)}::${normalizeText(b)}`;
}

function detectProvider(company) {
  if (company.provider) return String(company.provider).toLowerCase();

  const api = String(company.api || '').toLowerCase();
  const careers = String(company.careers_url || '').toLowerCase();

  if (api.includes('greenhouse.io') || careers.includes('greenhouse.io') || careers.includes('boards.greenhouse.io')) {
    return 'greenhouse';
  }
  if (careers.includes('jobs.lever.co')) {
    return 'lever';
  }
  if (careers.includes('jobs.ashbyhq.com')) {
    return 'ashby';
  }

  return '';
}

function extractSlug(company, provider) {
  if (company.board_slug) return String(company.board_slug).trim();

  const rawUrl = String(company.careers_url || '').trim();
  if (!rawUrl) return '';

  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    if (!parts.length) return '';

    if (provider === 'greenhouse') {
      return parts[parts.length - 1];
    }

    if (provider === 'lever' || provider === 'ashby') {
      return parts[0];
    }

    return '';
  } catch {
    return '';
  }
}

function shouldIncludeTitle(title, titleFilter) {
  const value = normalizeText(title);
  if (!value) return false;

  const positives = (titleFilter.positive || []).map(normalizeText).filter(Boolean);
  const negatives = (titleFilter.negative || []).map(normalizeText).filter(Boolean);

  const positiveMatch = positives.length === 0 || positives.some((term) => value.includes(term));
  const negativeMatch = negatives.some((term) => value.includes(term));

  return positiveMatch && !negativeMatch;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'career-ops-quick-scan/1.0' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const text = await fetchText(url);
  return JSON.parse(text);
}

function extractJsonObjectFromHtml(html, marker) {
  const markerIdx = html.indexOf(marker);
  if (markerIdx < 0) {
    throw new Error(`Marker not found: ${marker}`);
  }

  const start = markerIdx + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i += 1) {
    const ch = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return html.slice(start, i + 1);
      }
    }
  }

  throw new Error('Unbalanced JSON object in HTML');
}

async function fetchGreenhouseJobs(company, slug) {
  const url = company.api
    ? String(company.api)
    : `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;

  const data = await fetchJson(url);
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];

  return jobs
    .filter((job) => job && job.title && job.absolute_url)
    .map((job) => ({
      company: company.name,
      title: String(job.title).trim(),
      url: String(job.absolute_url).trim(),
      portal: 'Greenhouse API',
    }));
}

async function fetchLeverJobs(company, slug) {
  const data = await fetchJson(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  const jobs = Array.isArray(data) ? data : [];

  return jobs
    .filter((job) => job && job.text && (job.hostedUrl || job.id))
    .map((job) => ({
      company: company.name,
      title: String(job.text).trim(),
      url: String(job.hostedUrl || `https://jobs.lever.co/${slug}/${job.id}`).trim(),
      portal: 'Lever API',
    }));
}

async function fetchAshbyJobs(company, slug) {
  const boardUrl = company.careers_url
    ? String(company.careers_url)
    : `https://jobs.ashbyhq.com/${slug}`;

  const html = await fetchText(boardUrl);
  const jsonText = extractJsonObjectFromHtml(html, 'window.__appData = ');
  const appData = JSON.parse(jsonText);
  const postings = appData?.jobBoard?.jobPostings;

  if (!Array.isArray(postings)) return [];

  const base = `https://jobs.ashbyhq.com/${slug}`;

  return postings
    .filter((job) => job && job.id && job.title && job.isListed !== false)
    .map((job) => ({
      company: company.name,
      title: String(job.title).trim(),
      url: `${base}/${job.id}`,
      portal: 'Ashby Board',
    }));
}

async function readOptional(path, fallback) {
  if (!existsSync(path)) return fallback;
  return readFile(path, 'utf8');
}

function parseSeenUrlsFromHistory(content) {
  const urls = new Set();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith('url\t')) continue;
    const cols = line.split('\t');
    if (cols[0]) urls.add(cols[0].trim());
  }
  return urls;
}

function parsePipelineUrls(content) {
  const urls = new Set();
  const lines = content.split(/\r?\n/);
  const regex = /(https?:\/\/[^\s|)]+|local:jds\/[^\s|)]+)/g;

  for (const line of lines) {
    const matches = line.match(regex);
    if (!matches) continue;
    for (const match of matches) {
      urls.add(match.trim());
    }
  }

  return urls;
}

function parseApplicationKeys(content) {
  const keys = new Set();
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    if (line.includes('| # |') || line.includes('|---')) continue;

    const cols = line.split('|').map((x) => x.trim()).filter(Boolean);
    if (cols.length < 4) continue;

    const company = cols[2];
    const role = cols[3];
    if (company && role) {
      keys.add(normalizeKey(company, role));
    }
  }

  return keys;
}

function ensurePipelineSkeleton(content) {
  if (content.includes('## Pending') && content.includes('## Processed')) {
    return content;
  }
  return '## Pending\n\n## Processed\n';
}

function appendPendingEntries(content, entries) {
  if (entries.length === 0) return content;

  const normalized = ensurePipelineSkeleton(content);
  const marker = '## Processed';
  const idx = normalized.indexOf(marker);

  if (idx < 0) {
    return `${normalized.trimEnd()}\n${entries.join('\n')}\n`;
  }

  const before = normalized.slice(0, idx).trimEnd();
  const after = normalized.slice(idx).trimStart();

  return `${before}\n${entries.join('\n')}\n\n${after}`;
}

function escapeTsv(value) {
  return String(value || '').replace(/[\t\r\n]+/g, ' ').trim();
}

async function main() {
  if (!existsSync(PORTALS_PATH)) {
    console.error('portals.yml not found. Create it before running quick scan.');
    process.exit(1);
  }

  const portalsRaw = await readFile(PORTALS_PATH, 'utf8');
  const portals = parsePortalsYaml(portalsRaw);

  const pipelineRaw = await readOptional(PIPELINE_PATH, '## Pending\n\n## Processed\n');
  const historyRaw = await readOptional(HISTORY_PATH, 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus\n');
  const applicationsRaw = await readOptional(APPLICATIONS_PATH, '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|------|---------|------|-------|--------|-----|--------|-------|\n');

  const seenUrls = parseSeenUrlsFromHistory(historyRaw);
  const pipelineUrls = parsePipelineUrls(pipelineRaw);
  const applicationKeys = parseApplicationKeys(applicationsRaw);

  const scanDate = new Date().toISOString().slice(0, 10);
  const companies = (portals.tracked_companies || []).filter((c) => c.enabled !== false);

  const additions = [];
  const historyLines = [];

  const stats = {
    companies_scanned: 0,
    offers_found: 0,
    skipped_title: 0,
    skipped_dup: 0,
    skipped_provider: 0,
    skipped_error: 0,
    added: 0,
  };

  for (const company of companies) {
    const provider = detectProvider(company);

    if (!['greenhouse', 'lever', 'ashby'].includes(provider)) {
      stats.skipped_provider += 1;
      continue;
    }

    const slug = extractSlug(company, provider);
    if (!slug && provider !== 'greenhouse') {
      stats.skipped_provider += 1;
      continue;
    }

    stats.companies_scanned += 1;

    let jobs = [];
    try {
      if (provider === 'greenhouse') {
        jobs = await fetchGreenhouseJobs(company, slug);
      } else if (provider === 'lever') {
        jobs = await fetchLeverJobs(company, slug);
      } else {
        jobs = await fetchAshbyJobs(company, slug);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stats.skipped_error += 1;
      historyLines.push([
        `error:${company.name}`,
        scanDate,
        provider,
        'scan_error',
        company.name,
        `skipped_error:${escapeTsv(message).slice(0, 120)}`,
      ].join('\t'));
      continue;
    }

    stats.offers_found += jobs.length;

    for (const job of jobs) {
      const titleAllowed = shouldIncludeTitle(job.title, portals.title_filter || {});
      if (!titleAllowed) {
        stats.skipped_title += 1;
        historyLines.push([
          job.url,
          scanDate,
          job.portal,
          escapeTsv(job.title),
          escapeTsv(job.company),
          'skipped_title',
        ].join('\t'));
        continue;
      }

      const dedupKey = normalizeKey(job.company, job.title);
      if (seenUrls.has(job.url) || pipelineUrls.has(job.url) || applicationKeys.has(dedupKey)) {
        stats.skipped_dup += 1;
        historyLines.push([
          job.url,
          scanDate,
          job.portal,
          escapeTsv(job.title),
          escapeTsv(job.company),
          'skipped_dup',
        ].join('\t'));
        continue;
      }

      stats.added += 1;
      additions.push(`- [ ] ${job.url} | ${job.company} | ${job.title}`);
      seenUrls.add(job.url);
      pipelineUrls.add(job.url);
      historyLines.push([
        job.url,
        scanDate,
        job.portal,
        escapeTsv(job.title),
        escapeTsv(job.company),
        'added',
      ].join('\t'));
    }
  }

  const updatedPipeline = appendPendingEntries(pipelineRaw, additions);
  const historyPrefix = historyRaw.trimEnd() || 'url\tfirst_seen\tportal\ttitle\tcompany\tstatus';
  const updatedHistory = historyLines.length
    ? `${historyPrefix}\n${historyLines.join('\n')}\n`
    : `${historyPrefix}\n`;

  if (!DRY_RUN) {
    await writeFile(PIPELINE_PATH, updatedPipeline, 'utf8');
    await writeFile(HISTORY_PATH, updatedHistory, 'utf8');
  }

  console.log(`Quick Scan (${DRY_RUN ? 'dry-run' : 'live'}) — ${scanDate}`);
  console.log('----------------------------------------');
  console.log(`Companies scanned: ${stats.companies_scanned}`);
  console.log(`Offers found: ${stats.offers_found}`);
  console.log(`Filtered by title: ${stats.skipped_title}`);
  console.log(`Duplicates skipped: ${stats.skipped_dup}`);
  console.log(`Provider skipped: ${stats.skipped_provider}`);
  console.log(`Fetch errors: ${stats.skipped_error}`);
  console.log(`Added to pipeline: ${stats.added}`);

  if (additions.length > 0) {
    console.log('\nNew entries:');
    for (const line of additions.slice(0, 25)) {
      console.log(`  ${line}`);
    }
    if (additions.length > 25) {
      console.log(`  ... and ${additions.length - 25} more`);
    }
  }
}

main().catch((err) => {
  console.error('quick-scan failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
