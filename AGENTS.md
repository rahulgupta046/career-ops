# Job Finder MVP for Codex

This repo is no longer the full career-ops framework. It is a narrow job finder
and review-first application prep tool.

Rules:
- Submit applications only when the user explicitly asks for it and the command
  uses `--confirm`.
- Before submit, validate that visible required fields are filled and stop on
  CAPTCHA, login, missing required fields, or unclear blockers.
- Do not add broad career-ops modes back unless explicitly requested.
- Keep user targeting in `config/search_rules.yml`, `config/companies.yml`, and `config/candidate_profile.yml`.
- Keep outputs under `data/`.
- Use `npm run find`, `npm run prepare`, and `npm run verify`.
