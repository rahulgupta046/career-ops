#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_RESUME_PATHS = {
  software: 'source-resumes/backend_sde.pdf',
  ml: 'source-resumes/ml_infra.pdf',
  genai: 'source-resumes/genai_platform.pdf',
};

const DEFAULT_FALLBACK = 'ml';

const KEYWORDS = {
  genai: [
    'genai',
    'generative ai',
    'llm',
    'rag',
    'agentic',
    'prompt',
    'foundation model',
    'evaluation',
    'embedding',
    'ai platform',
  ],
  ml: [
    'machine learning',
    'ml engineer',
    'ml infra',
    'ml infrastructure',
    'mlops',
    'training pipeline',
    'inference',
    'model serving',
    'ranking',
    'recommendation',
    'feature pipeline',
  ],
  software: [
    'backend',
    'software engineer',
    'sde',
    'platform engineer',
    'distributed systems',
    'microservices',
    'api',
    'services',
    'system design',
    'data platform',
  ],
};

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
}

function scoreKeywords(text, terms) {
  let score = 0;
  const matched = [];
  for (const term of terms) {
    if (text.includes(term)) {
      score += 1;
      matched.push(term);
    }
  }
  return { score, matched };
}

function parseProfileAutomation(content) {
  const cfg = {
    resume_strategy: 'prebuilt',
    prebuilt_resumes: {
      software: DEFAULT_RESUME_PATHS.software,
      ml: DEFAULT_RESUME_PATHS.ml,
      genai: DEFAULT_RESUME_PATHS.genai,
      default: DEFAULT_FALLBACK,
    },
  };

  const lines = content.split(/\r?\n/);
  let inAutomation = false;
  let inPrebuiltResumes = false;

  for (const line of lines) {
    const indent = (line.match(/^\s*/) || [''])[0].length;
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) continue;

    if (indent === 0 && trimmed === 'automation:') {
      inAutomation = true;
      inPrebuiltResumes = false;
      continue;
    }

    if (indent === 0 && trimmed.endsWith(':') && trimmed !== 'automation:') {
      inAutomation = false;
      inPrebuiltResumes = false;
      continue;
    }

    if (!inAutomation) continue;

    if (indent === 2 && trimmed === 'prebuilt_resumes:') {
      inPrebuiltResumes = true;
      continue;
    }

    if (indent === 2 && trimmed.startsWith('resume_strategy:')) {
      cfg.resume_strategy = trimmed.split(':').slice(1).join(':').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      continue;
    }

    if (indent === 2 && trimmed.endsWith(':') && trimmed !== 'prebuilt_resumes:') {
      inPrebuiltResumes = false;
      continue;
    }

    if (inPrebuiltResumes && indent === 4) {
      const [rawKey, ...rest] = trimmed.split(':');
      const key = rawKey.trim();
      const value = rest.join(':').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      if (['software', 'ml', 'genai', 'default'].includes(key) && value) {
        cfg.prebuilt_resumes[key] = value;
      }
    }
  }

  return cfg;
}

function resolveResumePath(pathValue) {
  const resolved = resolve(process.cwd(), pathValue);
  return {
    configured: pathValue,
    absolute: resolved,
    exists: existsSync(resolved),
  };
}

export function selectResumeProfile({ title = '', jdText = '', profileConfig = null } = {}) {
  const text = normalizeText(`${title} ${jdText}`);
  const scoring = {
    genai: scoreKeywords(text, KEYWORDS.genai),
    ml: scoreKeywords(text, KEYWORDS.ml),
    software: scoreKeywords(text, KEYWORDS.software),
  };

  const ranked = ['genai', 'ml', 'software']
    .map((key) => ({ key, score: scoring[key].score }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const order = ['genai', 'ml', 'software'];
      return order.indexOf(a.key) - order.indexOf(b.key);
    });

  const fallback = profileConfig?.prebuilt_resumes?.default || DEFAULT_FALLBACK;
  const picked = ranked[0].score > 0 ? ranked[0].key : fallback;

  const configuredPath =
    profileConfig?.prebuilt_resumes?.[picked] || DEFAULT_RESUME_PATHS[picked] || DEFAULT_RESUME_PATHS[DEFAULT_FALLBACK];

  const pathInfo = resolveResumePath(configuredPath);

  return {
    selected_profile: picked,
    fallback_used: ranked[0].score === 0,
    scores: {
      genai: scoring.genai.score,
      ml: scoring.ml.score,
      software: scoring.software.score,
    },
    matched_terms: {
      genai: scoring.genai.matched,
      ml: scoring.ml.matched,
      software: scoring.software.matched,
    },
    resume: pathInfo,
  };
}

async function runCli() {
  const argv = process.argv.slice(2);
  let title = '';
  let jdFile = '';
  let profilePath = 'config/profile.yml';
  let printPathOnly = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--title') {
      title = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--jd-file') {
      jdFile = argv[i + 1] || '';
      i += 1;
    } else if (arg === '--profile') {
      profilePath = argv[i + 1] || profilePath;
      i += 1;
    } else if (arg === '--print-path') {
      printPathOnly = true;
    }
  }

  let jdText = '';
  if (jdFile) {
    jdText = await readFile(resolve(process.cwd(), jdFile), 'utf8');
  }

  let profileConfig = null;
  const resolvedProfile = resolve(process.cwd(), profilePath);
  if (existsSync(resolvedProfile)) {
    const content = await readFile(resolvedProfile, 'utf8');
    profileConfig = parseProfileAutomation(content);
  }

  const result = selectResumeProfile({ title, jdText, profileConfig });

  if (printPathOnly) {
    console.log(result.resume.absolute);
    process.exit(result.resume.exists ? 0 : 2);
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.resume.exists ? 0 : 2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((err) => {
    console.error('resume-selector failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
