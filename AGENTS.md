# Local Application Workbench

This repo is a narrow local job discovery, ATS analysis, and review-first
application assistant.

Rules:
- Keep targeting in `config/search_rules.yml`, `config/sources.yml`, and
  `config/candidate_profile.yml`.
- Keep generated databases, exports, logs, browser profiles, integration
  checkouts, and Python environments ignored by Git.
- Use `npm run scan`, `npm run ui`, `npm run prepare`, `npm run apply`,
  `npm run export`, and `npm run verify`.
- Fill only verified profile fields.
- Submit only after preparation validation, a one-time review token, and
  explicit `--confirm`.
- Never submit from scans, refresh actions, scheduled tasks, or bulk actions.
