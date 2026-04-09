# Mode: auto-apply-static - Static ATS Auto Submit

Auto-submit flow for static ATS pages only.

## Scope

Supported portals:
- Greenhouse
- Lever
- Ashby

Unsupported/unknown portals must be skipped and marked as manual-required.

## Guardrails

1. Score gate: only auto-submit if score is `>= 4.0/5`.
2. Language: all generated form answers and notes in English.
3. If portal is not static-compatible, do not attempt submit.
4. If captcha/hard blocker appears, stop and mark manual-required.

## Inputs

- Job URL(s) from user or pending entries in `data/pipeline.md`
- Candidate data from `config/profile.yml`
- Evidence/context from `cv.md`, `article-digest.md`, and report in `reports/`

## Workflow

1. Resolve target URL(s).
2. Detect portal from URL:
   - `job-boards.greenhouse.io` or `boards.greenhouse.io` -> Greenhouse
   - `jobs.lever.co` -> Lever
   - `jobs.ashbyhq.com` -> Ashby
   - otherwise -> unsupported
3. Ensure evaluation exists:
   - If missing, run evaluation first to get score/report.
4. Apply score gate:
   - If score `< 4.0`, skip and record reason.
5. Open apply page with Playwright and extract form fields.
6. Fill deterministic fields from profile:
   - name, email, phone, location, LinkedIn, work authorization/sponsorship
7. Generate concise English responses for free-text fields using report + CV proof points.
8. Select and upload prebuilt resume artifact:
   - Run:

```bash
node resume-selector.mjs --title "{role_title}" --jd-file /tmp/jd.txt
```

   - Upload selected file from `source-resumes/`.
   - Do not run tailored PDF generation in this mode unless user explicitly requests `/career-ops pdf`.
9. Submit form only if all required fields are satisfied and no blocker is present.
10. Update tracker:
   - success -> `Applied` with note `resume: source-resumes/{file}`
   - skipped/blocked -> keep canonical status and add note:
     - `manual_required:unsupported_portal`
     - `manual_required:captcha_or_blocker`
     - `manual_required:score_below_threshold`
     - `auto_apply_failed:<reason>`

## Output Summary

For each URL, report:
- portal
- score
- decision (`applied`, `skipped`, `failed`)
- tracker update note
