const jobsElement = document.querySelector('#jobs');
const profileElement = document.querySelector('#profile');
const countElement = document.querySelector('#job-count');
const statusElement = document.querySelector('#status');
const template = document.querySelector('#job-template');
const searchInput = document.querySelector('#search');
const minimumScore = document.querySelector('#minimum-score');
const postedWithin = document.querySelector('#posted-within');
const sponsorshipOnly = document.querySelector('#sponsorship-only');

let jobs = [];

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}

function filteredJobs() {
  const term = searchInput.value.trim().toLowerCase();
  const threshold = Number(minimumScore.value);
  const postedCutoff = Date.now() - Number(postedWithin.value) * 86400000;
  return jobs.filter(job => {
    const text = [job.company, job.title, job.location, job.matched_keywords].join(' ').toLowerCase();
    const hasSponsorship = job.sponsorship_signal && job.sponsorship_signal !== 'unknown';
    return Number(job.score) >= threshold
      && (!term || text.includes(term))
      && Date.parse(job.posted_at) >= postedCutoff
      && (!sponsorshipOnly.checked || hasSponsorship);
  });
}

function keyword(text, extraClass = '') {
  const item = document.createElement('span');
  item.className = `keyword ${extraClass}`.trim();
  item.textContent = text;
  return item;
}

function postedLabel(value) {
  if (!value) return 'Posted date unavailable';
  const date = new Date(value);
  const ageDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  return `Posted ${ageDays === 0 ? 'today' : `${ageDays} day${ageDays === 1 ? '' : 's'} ago`}`;
}

async function prepare(job, button) {
  button.disabled = true;
  statusElement.textContent = `Preparing ${job.company}...`;
  try {
    const { result } = await fetchJson('/api/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_url: job.job_url }),
    });
    statusElement.textContent = `${result.status}: ${job.company}. Review the opened browser window.`;
  } catch (error) {
    statusElement.textContent = `Prepare failed: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

function renderJobs() {
  const visibleJobs = filteredJobs();
  countElement.textContent = `${visibleJobs.length} of ${jobs.length} jobs`;
  jobsElement.replaceChildren();

  if (!visibleJobs.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No jobs match these filters.';
    jobsElement.append(empty);
    return;
  }

  for (const job of visibleJobs) {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector('.job-score').textContent = job.score;
    fragment.querySelector('.job-company').textContent = job.company;
    fragment.querySelector('.job-title').textContent = job.title;
    fragment.querySelector('.ats').textContent = job.ats_type;
    fragment.querySelector('.job-location').textContent = job.location || 'Location not specified';
    fragment.querySelector('.job-posted').textContent = postedLabel(job.posted_at);
    fragment.querySelector('.job-reason').textContent = job.reason;
    const keywordRow = fragment.querySelector('.keyword-row');

    for (const item of (job.matched_keywords || '').split('|').filter(Boolean)) {
      keywordRow.append(keyword(item));
    }
    if (job.sponsorship_signal && job.sponsorship_signal !== 'unknown') {
      keywordRow.append(keyword('sponsorship signal', 'signal'));
    }

    const link = fragment.querySelector('.apply-link');
    link.href = job.job_url;
    const prepareButton = fragment.querySelector('.prepare-button');
    prepareButton.addEventListener('click', () => prepare(job, prepareButton));
    jobsElement.append(fragment);
  }
}

function renderProfile(fields) {
  profileElement.replaceChildren();
  for (const field of fields.filter(item => item.value)) {
    const row = document.createElement('div');
    row.className = 'profile-item';
    const content = document.createElement('div');
    const label = document.createElement('p');
    label.className = 'eyebrow';
    label.textContent = field.label;
    const value = document.createElement('p');
    value.className = `profile-value ${field.verified ? '' : 'unverified'}`.trim();
    value.textContent = `${field.value}${field.verified ? '' : ' (confirm before autofill)'}`;
    content.append(label, value);

    const copy = document.createElement('button');
    copy.className = 'secondary-button copy-button';
    copy.type = 'button';
    copy.textContent = 'Copy';
    copy.disabled = !field.verified;
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(field.value);
      copy.textContent = 'Copied';
      setTimeout(() => { copy.textContent = 'Copy'; }, 1200);
    });
    row.append(content, copy);
    profileElement.append(row);
  }
}

async function load() {
  statusElement.textContent = 'Loading queue...';
  try {
    const [{ jobs: queue }, { fields }] = await Promise.all([
      fetchJson('/api/jobs'),
      fetchJson('/api/profile'),
    ]);
    jobs = queue.sort((a, b) => Number(b.score) - Number(a.score));
    renderJobs();
    renderProfile(fields);
    statusElement.textContent = 'Queue loaded';
  } catch (error) {
    statusElement.textContent = `Load failed: ${error.message}`;
  }
}

for (const control of [searchInput, minimumScore, postedWithin, sponsorshipOnly]) {
  control.addEventListener('input', renderJobs);
}
document.querySelector('#refresh').addEventListener('click', load);

load();
