import { readFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';

export const PATHS = {
  searchRules: 'config/search_rules.yml',
  candidateProfile: 'config/candidate_profile.yml',
  database: 'data/job_finder.sqlite',
  resume: 'config/resume.yml',
  sources: 'config/sources.yml',
  integrations: 'config/integrations.yml',
  exportQueue: 'data/exports/applications_queue.csv',
};

export function readYaml(path, fallback = {}) {
  if (!existsSync(path)) return fallback;
  return yaml.load(readFileSync(path, 'utf8')) || fallback;
}

export function loadConfig() {
  const searchRules = readYaml(PATHS.searchRules);
  const candidateProfile = readYaml(PATHS.candidateProfile);

  return {
    searchRules,
    candidateProfile,
  };
}

export function readArgValue(argv, flagName, fallback = '') {
  const prefix = `${flagName}=`;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith(prefix)) return token.slice(prefix.length);
    if (token === flagName) return argv[i + 1] || fallback;
  }
  return fallback;
}
