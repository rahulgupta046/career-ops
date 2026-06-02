// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */

// Lever provider — hits the public postings endpoint.
// Auto-detects from careers_url pattern `https://jobs.lever.co/<slug>`.

function resolveApiUrl(entry) {
  if (entry.api) return entry.api;
  if (entry.slug) return `https://api.lever.co/v0/postings/${entry.slug}?mode=json`;
  const url = entry.careers_url || '';
  const match = url.match(/jobs\.lever\.co\/([^/?#]+)/);
  if (!match) return null;
  return `https://api.lever.co/v0/postings/${match[1]}?mode=json`;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** @type {Provider} */
export default {
  id: 'lever',

  detect(entry) {
    const apiUrl = resolveApiUrl(entry);
    return apiUrl ? { url: apiUrl } : null;
  },

  async fetch(entry, ctx) {
    const apiUrl = resolveApiUrl(entry);
    if (!apiUrl) throw new Error(`lever: cannot derive API URL for ${entry.name}`);
    const json = await ctx.fetchJson(apiUrl);
    if (!Array.isArray(json)) return [];
    return json.map(j => ({
      title: j.text || '',
      url: j.hostedUrl || '',
      job_url: j.hostedUrl || '',
      company: entry.name,
      location: j.categories?.location || '',
      description: stripHtml([
        j.descriptionPlain,
        j.description,
        ...(Array.isArray(j.lists) ? j.lists.map(list => `${list.text || ''} ${list.content || ''}`) : []),
      ].filter(Boolean).join(' ')),
      ats: 'lever',
      job_id: String(j.id || ''),
      posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : '',
    }));
  },
};
