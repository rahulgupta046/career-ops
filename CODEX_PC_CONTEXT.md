# Codex PC Handoff Context

This repo is a local job discovery, ATS scoring, and review-first application
workbench. It was cleaned to keep only the current Ever Jobs + JobSpy discovery
flow and conservative application preparation flow.

## Current Flow

Discovery:

```text
Ever Jobs sidecar + JobSpy
  -> normalize
  -> dedupe in SQLite
  -> hard filters
  -> ATS scoring against config/resume.yml
  -> ranked UI queue
```

Application preparation:

```text
Open application in Playwright
  -> upload resume
  -> fill safe verified fields only
  -> report required/manual-review fields
  -> create submit token only when validation is clean
  -> submit only with token + explicit confirm
```

The app must not submit from scans, refreshes, scheduled tasks, or bulk actions.

## PC Setup

Start Docker Desktop first. Then run:

```bash
npm install
npm run setup
npm run scan -- --no-claude
npm run ui
```

Open:

```text
http://127.0.0.1:4173
```

If Docker setup fails or the sidecar is not healthy:

```bash
npm run integrations:start
```

If running without Docker, use the local sidecar mode:

```bash
npm run integrations:install
npm run integrations:start:local
```

## Required PC Edits

Update `resume_path` in `config/search_rules.yml` to the resume PDF path on the
PC before using prepare/apply.

Review `config/candidate_profile.yml` and keep only verified fields. Fields
listed under `unverified_fields` are intentionally not autofilled.

## Important Files

- `config/search_rules.yml`: targeting, hard filters, ranking terms, safe autofill fields.
- `config/sources.yml`: Ever Jobs company sources and JobSpy board searches.
- `config/integrations.yml`: Ever Jobs, JobSpy, and Claude integration settings.
- `config/resume.yml`: structured resume used by ATS scoring.
- `src/discovery/sources.mjs`: Ever Jobs + JobSpy discovery.
- `src/scoring/keyword_score.mjs`: hard filters and local fit scoring.
- `src/scoring/rank.mjs`: eligibility and ranking blend.
- `src/apply/browser_prepare.mjs`: conservative Playwright preparation.
- `src/workbench.mjs`: scan/evaluation/application orchestration.
- `src/ui/server.mjs`: local UI/API server.

## Cleanup Decisions Already Made

Removed from the active repo:

- old tracked scan/archive data
- internal ATS fallback provider stack
- old liveness helpers
- duplicate `.claude/skills` and `.qwen/skills`
- generated runtime DB/log/export files

Generated/local-only state is ignored:

- `.integrations/`
- `.venv/`
- `node_modules/`
- `data/job_finder.sqlite*`
- `data/exports/*`
- `data/logs/*`
- `data/browser-profile/*`

## Verification

Run:

```bash
npm run verify
npm run scan -- --dry-run --no-claude
```

Last known dry scan on the Mac after cleanup:

```text
Ever Jobs: 1438 jobs
JobSpy: 100 jobs
Eligible: 9 jobs
```

Numbers will differ on the PC depending on network, Docker, and source freshness.

## Next Improvements

Tune `config/search_rules.yml` based on false positives/false negatives in the
UI. Do not add browser-use or Crawl4AI until the current Ever Jobs + JobSpy queue
quality is acceptable.
