# Mode: tracker - Application Tracker

Read and display `data/applications.md`.

**Tracker format:**
```markdown
| # | Date | Company | Role | Score | Status | PDF | Report |
```

Canonical status workflow:
`Evaluated` -> `Applied` -> `Responded` -> `Interview` -> `Offer` / `Rejected` / `Discarded` / `SKIP`

Status definitions:
- `Applied`: Application submitted by the candidate.
- `Responded`: Company/recruiter responded.
- `Interview`: Active interview process.
- `Offer`: Offer received.
- `Rejected`: Rejected by company.
- `Discarded`: Candidate decided not to continue, or role closed.
- `SKIP`: Explicitly not a target role.

If the user asks to update a status, edit the corresponding row.

Also show:
- Total applications
- By status
- Average score
- % with PDF generated
- % with report generated
