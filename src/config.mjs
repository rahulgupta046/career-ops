import { readFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';

export const PATHS = {
  searchRules: 'config/search_rules.yml',
  companies: 'config/companies.yml',
  candidateProfile: 'config/candidate_profile.yml',
  queue: 'data/applications_queue.csv',
  scannedJobs: 'data/scanned_jobs.json',
};

export function readYaml(path, fallback = {}) {
  if (!existsSync(path)) return fallback;
  return yaml.load(readFileSync(path, 'utf8')) || fallback;
}

export function loadConfig() {
  const searchRules = readYaml(PATHS.searchRules);
  const companiesConfig = readYaml(PATHS.companies, { companies: [] });
  const candidateProfile = readYaml(PATHS.candidateProfile);

  return {
    searchRules,
    companies: (companiesConfig.companies || []).filter(company => company.enabled !== false),
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
