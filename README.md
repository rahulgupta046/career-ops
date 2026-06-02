# Job Finder MVP

This repo is a focused, review-first job finder. It fetches public ATS postings,
scores them locally, optionally asks Claude to review only high-score matches,
and writes a queue CSV. It does not submit applications.

## Commands

```bash
npm install
npm run find
npm run find -- --dry-run
npm run find -- --no-claude
npm run find -- --no-claude --rescan
npm run ui
npm run prepare -- --top 10
npm run apply -- --top 1 --confirm
npm run verify
```

## Local UI

Run `npm run find -- --no-claude`, then run `npm run ui` and open
`http://127.0.0.1:4173`.

The local dashboard reads `data/applications_queue.csv`. It supports text and
score filters, sponsorship-signal filtering, direct application links, profile
copy buttons, and a review-first **Prepare fields** action. Prepare opens a
Playwright browser, uploads the configured resume, fills obvious verified
profile fields, and leaves the page open. The dashboard never submits an
application.

Most ATS portals do not support personal data encoded into an application URL.
The direct link plus the Prepare action is the lightweight equivalent: discovery
and ranking happen once, while field filling runs only for jobs you select.

## Config

- `config/search_rules.yml` controls target roles, locations, keywords, score threshold, and resume path.
- `config/companies.yml` lists Greenhouse, Lever, and Ashby company boards.
- `config/candidate_profile.yml` stores the compressed profile and form-fill contact fields.

Fields listed under `unverified_fields` remain visible in the UI but are not
copied or autofilled. Remove a key from that list only after confirming its
value.

`max_posted_age_days` defaults to `7`, so the queue only keeps jobs posted
within the last week. `data/scanned_jobs.json` records ATS job IDs and URL
fallbacks. Later scans still fetch portal indexes to discover new jobs, but
skip scoring and Claude review for previously seen postings. Use `--rescan`
after changing scoring rules when you intentionally want to reevaluate them.

## Output

`npm run find` writes `data/applications_queue.csv` with:

```text
company,title,location,ats_type,job_url,posted_at,score,reason,matched_keywords,sponsorship_signal,apply_mode,status
```

## Safety

`npm run prepare` opens job pages and fills obvious fields where possible.

`npm run apply -- --top N --confirm` fills, validates required visible fields,
and submits only when validation passes. If required fields, CAPTCHA, login, or
other blockers remain, it stops without submitting.
