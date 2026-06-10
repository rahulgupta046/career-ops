const $ = selector => document.querySelector(selector);
let jobs = [];
let applications = [];
let selectedId = null;

const api = async (url, options) => {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
};
const post = (url, value = {}) => api(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
const age = date => Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 86400000));
const parsed = value => { try { return JSON.parse(value || '[]'); } catch { return []; } };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
const state = (value, style = value) => `<span class="state ${esc(style)}">${esc(value)}</span>`;
const skill = value => `<span class="badge">${esc(value)}</span>`;
const visibleSkills = value => String(value || '').match(/\d+\/\d+ hard skills matched \(\d+%\)/)?.[0] || value || 'ATS keyword analysis available';

function status(value) { $('#status').textContent = value; }
function sourceMatches(job, value) {
  if (!value) return true;
  return String(job.source || '').startsWith(`${value}:`) || job.source === value;
}
function filtered() {
  const term = $('#search').value.toLowerCase();
  const days = Number($('#days').value);
  const ats = Number($('#ats').value);
  const sponsor = $('#sponsor').value;
  const source = $('#source-filter').value;
  return jobs.filter(job => [job.company, job.title, job.location].join(' ').toLowerCase().includes(term)
    && age(job.posted_at) <= days && Number(job.ats_score) >= ats && (!sponsor || job.sponsorship_signal === sponsor)
    && sourceMatches(job, source));
}
function updateStats() {
  const fresh = jobs.filter(job => age(job.posted_at) <= 7);
  const sponsor = jobs.filter(job => job.sponsorship_signal === 'positive');
  const average = jobs.length ? Math.round(jobs.reduce((sum, job) => sum + Number(job.ats_score), 0) / jobs.length) : '--';
  $('#stat-qualified').textContent = jobs.length;
  $('#stat-fresh').textContent = fresh.length;
  $('#stat-sponsor').textContent = sponsor.length;
  $('#stat-ats').textContent = average;
  $('#nav-job-count').textContent = jobs.length;
  $('#nav-app-count').textContent = applications.length;
}
function renderJobs() {
  const visible = filtered();
  $('#job-count').textContent = `${visible.length} role${visible.length === 1 ? '' : 's'}`;
  if (!visible.length) {
    $('#jobs').innerHTML = `<div class="empty-state"><span class="empty-icon">⌕</span><h3>No matching roles</h3><p>Refresh discovery or relax the active filters.</p></div>`;
    return;
  }
  $('#jobs').innerHTML = visible.map(job => `
    <button class="job ${Number(job.id) === Number(selectedId) ? 'selected' : ''}" data-job="${job.id}">
      <span class="job-score">${Math.round(job.rank_score)}</span>
      <span>
        <span class="eyebrow">${esc(job.company)}</span>
        <h4>${esc(job.title)}</h4>
        <span class="job-meta">${esc(job.location || 'Location not specified')} · ${age(job.posted_at)}d ago</span>
        <span class="badges">
          <span class="badge">ATS ${Math.round(job.ats_score)}</span>
          <span class="badge ${esc(job.sponsorship_signal)}">${esc(job.sponsorship_signal)} sponsorship</span>
        </span>
      </span>
      <span class="source-tag">${esc(job.source)}</span>
    </button>`).join('');
  document.querySelectorAll('[data-job]').forEach(button => button.onclick = () => showDetails(jobs.find(job => Number(job.id) === Number(button.dataset.job))));
}
function showDetails(job) {
  selectedId = job.id;
  renderJobs();
  const missing = parsed(job.missing_skills);
  const knockouts = parsed(job.knockout_signals);
  $('#details').classList.add('has-selection');
  $('#details').innerHTML = `<div class="details-content">
    <p class="eyebrow">${esc(job.company)} · ${esc(job.source)}</p>
    <h2>${esc(job.title)}</h2>
    <p>${esc(job.location)} · Posted ${age(job.posted_at)}d ago</p>
    <div class="metrics">
      <span class="metric"><b>${Math.round(job.ats_score)}</b><span>ATS</span></span>
      <span class="metric"><b>${Math.round(job.parsing_score)}</b><span>Parsing</span></span>
      <span class="metric"><b>${Math.round(job.match_score)}</b><span>Match</span></span>
      <span class="metric"><b>${Math.round(job.recruiter_score)}</b><span>Recruiter</span></span>
    </div>
    <h4>Assessment</h4><p>${esc(job.summary)}</p>
    <h4>Fit reason</h4><p>${esc(job.exclusion_reason || 'No local fit reason recorded')}</p>
    <h4>Skill coverage</h4><p>${esc(visibleSkills(job.matched_skills))}</p>
    <h4>Missing skills</h4><div class="skill-list">${missing.length ? missing.map(skill).join('') : '<span class="subtle">None detected</span>'}</div>
    <h4>Knockout signals</h4><p>${knockouts.length ? knockouts.map(item => esc(item.signal)).join(', ') : 'None detected'}</p>
    <div class="actions">
      <a href="${esc(job.apply_url)}" target="_blank" rel="noreferrer">Open application</a>
      <button id="prepare">Prepare fields</button>
      <button id="skip">Skip</button>
    </div>
    <div id="prep"></div>
  </div>`;
  $('#skip').onclick = async () => { await post('/api/skip', { job_id: job.id }); await load(); };
  $('#prepare').onclick = async () => {
    status('Preparing fields in browser...');
    try {
      const { result } = await post('/api/prepare', { job_id: job.id });
      const unresolved = [...result.validation.missing, ...result.validation.blockers];
      const reviewRequired = result.validation.review_required || [];
      $('#prep').innerHTML = `<h4>${esc(result.status)}</h4><p>${unresolved.map(esc).join(', ') || 'Visible required fields passed validation.'}</p>${reviewRequired.length ? `<h4>Manual review required</h4><p>${reviewRequired.map(esc).join(', ')}</p>` : ''}${result.review_token ? '<div class="actions"><button id="submit">Confirm and submit</button></div>' : ''}`;
      if (result.review_token) $('#submit').onclick = async () => {
        if (!confirm('Submit this reviewed application?')) return;
        await post('/api/submit', { job_id: job.id, review_token: result.review_token });
        status('Submission attempted. Review Applications for the recorded result.');
        await load();
      };
    } catch (error) { status(error.message); }
  };
}
function renderApplications() {
  $('#application-list').innerHTML = applications.length ? applications.map(item => `
    <article class="row"><b>${esc(item.company)}</b><span>${esc(item.title)}</span>${state(item.status)}</article>`).join('')
    : `<div class="empty-state"><span class="empty-icon">✓</span><h3>No applications yet</h3><p>Prepare a qualified role from the inbox to begin tracking it here.</p></div>`;
}
function renderSources(sources) {
  $('#sidebar-health').textContent = sources.length ? `${sources.filter(item => item.status === 'healthy').length}/${sources.length} sources healthy` : 'Waiting for scan';
  $('#source-list').innerHTML = sources.length ? sources.map(item => `
    <article class="row"><b>${esc(item.source)}</b><span>${esc(item.error || `${item.job_count} jobs discovered`)}</span>${state(item.status)}</article>`).join('')
    : `<div class="empty-state"><span class="empty-icon">⌁</span><h3>No discovery run yet</h3><p>Refresh jobs after confirming your extracted resume to populate source health.</p></div>`;
}
function renderProfile(profile) {
  $('#profile-indicator').classList.toggle('verified', profile.resume_verified);
  $('#profile-state').innerHTML = profile.resume_verified
    ? `${state('Resume confirmed', 'verified')}<p class="subtle">ATS scoring and verified-field autofill are enabled.</p>`
    : `${state('Confirmation required', 'unverified')}<p class="subtle">Scoring remains locked until you review and confirm this resume extraction.</p>`;
  $('#confirm-profile').disabled = profile.resume_verified;
  $('#confirm-profile').textContent = profile.resume_verified ? 'Resume confirmed' : 'Confirm extracted resume';
  $('#profile-list').innerHTML = profile.fields.filter(field => field.value !== '').map(field => `
    <article class="profile-row"><b>${esc(field.key.replaceAll('_', ' '))}</b><span>${esc(field.value)}</span>${state(field.verified ? 'Verified' : 'Needs review', field.verified ? 'verified' : 'unverified')}</article>`).join('');
}
async function load() {
  const [{ jobs: list }, { applications: apps }, { sources }, profile] = await Promise.all([api('/api/jobs'), api('/api/applications'), api('/api/sources'), api('/api/profile')]);
  jobs = list; applications = apps; renderJobs(); updateStats(); renderApplications(); renderSources(sources); renderProfile(profile);
}
for (const selector of ['#search', '#days', '#ats', '#sponsor', '#source-filter']) $(selector).oninput = renderJobs;
$('#scan').onclick = async () => { status('Scanning configured sources...'); try { await post('/api/scan'); await load(); status('Scan complete'); } catch (error) { status(error.message); } };
$('#export').onclick = async () => status(`Exported ${(await post('/api/export')).path}`);
$('#confirm-profile').onclick = async () => { await post('/api/profile/confirm'); await load(); status('Resume extraction confirmed'); };
document.querySelectorAll('.tab').forEach(button => button.onclick = () => {
  document.querySelectorAll('.tab,.view').forEach(item => item.classList.remove('active'));
  button.classList.add('active'); $(`#${button.dataset.tab}`).classList.add('active');
  const labels = { inbox: ['Application queue', 'Job Inbox'], applications: ['Review-first workflow', 'Applications'], sources: ['Discovery diagnostics', 'Source Health'], profile: ['Resume onboarding', 'Candidate Profile'] };
  [$('#page-eyebrow').textContent, $('#page-title').textContent] = labels[button.dataset.tab];
});
load().catch(error => status(error.message));
