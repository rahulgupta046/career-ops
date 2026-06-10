# Local Application Workbench

A local job discovery, ATS analysis, and review-first application assistant.

## Workflow

```bash
npm install
npm run setup
npm run ui
```

Open `http://127.0.0.1:4173`, review the PDF-extracted profile, and click
**Confirm extracted resume**. Then use **Refresh jobs** or:

```bash
npm run scan -- --no-claude
npm run scan -- --dry-run
npm run scan -- --rescore
npm run export
```

Discovery uses the pinned Ever Jobs sidecar on `127.0.0.1:3001` plus selective
Indeed and Google searches through JobSpy after setup.

On a machine without Docker, the no-Docker Ever Jobs sidecar can be used after
setup:

```bash
npm run integrations:install
npm run integrations:start:local
npm run integrations:stop:local
```

Docker remains available only as an optional isolation mode:

```bash
npm run integrations:start
npm run integrations:stop
```

## Applications

The dashboard shows recent qualified jobs with ATS tier scores, missing skills,
sponsorship signals, source health, and application state.

`Prepare fields` opens a persistent Playwright browser profile, uploads the
fixed resume PDF, fills verified fields, validates visible required fields, and
returns a one-time review token. It never submits.

After reviewing the browser form, submit from the UI or run:

```bash
npm run prepare -- --job <id>
npm run apply -- --job <id> --token <review-token> --confirm
```

Submission stops on missing required fields, CAPTCHA, login, or unclear
blockers. Scheduled scans never open a browser or submit.

## Data

SQLite is the source of truth:

```text
data/job_finder.sqlite
```

Generated databases, exports, logs, browser profiles, `.venv`, and cloned
integrations are ignored by Git.

## Scheduler

Install or remove the macOS 08:00 local-time scan:

```bash
npm run scheduler:install
npm run scheduler:remove
```

Run `npm run verify` after changes.
