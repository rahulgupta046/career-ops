import greenhouse from '../providers/greenhouse.mjs';
import lever from '../providers/lever.mjs';
import ashby from '../providers/ashby.mjs';
import { makeHttpCtx } from '../providers/_http.mjs';

const PROVIDERS = {
  greenhouse,
  lever,
  ashby,
};

function careersUrlFor(company) {
  if (company.careers_url) return company.careers_url;
  if (company.ats === 'greenhouse') return `https://job-boards.greenhouse.io/${company.slug}`;
  if (company.ats === 'lever') return `https://jobs.lever.co/${company.slug}`;
  if (company.ats === 'ashby') return `https://jobs.ashbyhq.com/${company.slug}`;
  return '';
}

export async function fetchCompanyJobs(company) {
  const ats = String(company.ats || company.provider || '').toLowerCase();
  const provider = PROVIDERS[ats];
  if (!provider) throw new Error(`Unsupported ATS: ${company.ats || company.provider || 'unknown'}`);

  const entry = {
    ...company,
    provider: ats,
    careers_url: careersUrlFor(company),
  };

  const jobs = await provider.fetch(entry, makeHttpCtx());
  return jobs
    .filter(job => job.title && (job.job_url || job.url))
    .map(job => ({
      company: job.company || company.name,
      title: job.title || '',
      location: job.location || '',
      description: job.description || '',
      job_url: job.job_url || job.url,
      ats,
      job_id: job.job_id || '',
      posted_at: job.posted_at || '',
    }));
}
