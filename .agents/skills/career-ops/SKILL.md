---
name: career-ops
description: Local job discovery, ATS scoring, and review-first application workbench
license: MIT
---

# Local Application Workbench

Use this repo as a narrow job application assistant.

## Commands

```bash
npm run setup
npm run integrations:start
npm run scan -- --no-claude
npm run ui
npm run prepare -- --job <id>
npm run apply -- --job <id> --token <review-token> --confirm
npm run export
npm run verify
```

## Rules

- Keep targeting in `config/search_rules.yml`, `config/sources.yml`, and `config/candidate_profile.yml`.
- Keep generated data under `data/`.
- Do not submit without a validated preparation report, a one-time review token, and explicit `--confirm`.
- Never submit from scans, scheduled tasks, or UI refresh actions.
- Fill only verified profile fields.
