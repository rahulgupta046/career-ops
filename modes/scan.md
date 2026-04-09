# Mode: scan - Quick API Scan (Low Token)

Default scan mode optimized for low token usage.

## Goal

Discover new jobs with deterministic HTTP/API extraction only (no WebSearch and no Playwright crawl):
- Greenhouse API
- Lever API
- Ashby board data (`window.__appData`)

## Workflow

1. Run quick scan:

```bash
node quick-scan.mjs
```

2. If the user asks for preview/no writes, run:

```bash
node quick-scan.mjs --dry-run
```

3. Summarize the command output:
- companies scanned
- offers found
- filtered/skipped counts
- added to pipeline count

4. If new offers were added, suggest next step:

```text
Run /career-ops pipeline to evaluate newly discovered offers.
```

## Notes

- `/career-ops scan` is intentionally lightweight and API-first.
- For the legacy context-heavy 3-level scan (Playwright + Greenhouse + WebSearch), use `/career-ops scan-full`.
- Quick scan only processes providers that can be resolved as `greenhouse`, `lever`, or `ashby`.
