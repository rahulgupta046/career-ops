import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { analyzeAts } from 'resuml/ats';
import { PATHS } from '../config.mjs';

function check(result, id) {
  return result.tiers.match?.checks.find(item => item.id === id);
}

export function loadResume(path = PATHS.resume) {
  return yaml.load(readFileSync(path, 'utf8'));
}

export function scoreResume(job, resume = loadResume()) {
  const ats = analyzeAts(resume, { jobDescription: job.description, jobTitle: job.title });
  const hardSkills = check(ats, 'hard-skill-overlap');
  const hints = hardSkills?.hints || [];
  const missing = hints.flatMap(value => value.match(/Missing[^:]*:\s*(.*)/i)?.[1]?.split(',').map(item => item.trim()) || []);
  return {
    ats,
    matched_skills: hardSkills?.message || '',
    missing_skills: missing,
  };
}
