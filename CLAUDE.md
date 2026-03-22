# Job Apply AI — Claude Code Instructions

## IMPORTANT: Playwright MCP Required

This project requires Playwright MCP to apply to jobs. Before doing anything, check if Playwright MCP is configured:

1. Check `~/.claude/settings.json` for a `playwright` entry under `mcpServers`
2. If NOT configured, tell the user:

```
Playwright MCP is not configured. This is required for applying to jobs.

Add this to your ~/.claude/settings.json:

{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}

Then restart Claude Code.
```

Do NOT fall back to running scripts for applying. The scripts use hardcoded selectors and miss fields. Playwright MCP lets you see and fill forms visually — it works on any ATS, handles custom dropdowns, radio buttons, and multi-step flows.

Scripts (`scripts/greenhouse-pull.cjs`, `scripts/greenhouse-filter.cjs`) are fine for pulling and filtering jobs. Only the apply step requires Playwright MCP.

## Quick Start
1. Verify Playwright MCP is configured (see above)
2. Read `config/profile.example.json` to understand the profile schema
3. User must create `config/profile.json` with their own data before running
4. Use `docs/quickstart.md` for setup guide

## Applying to Jobs (Playwright MCP)
1. User provides a job URL or says "apply to jobs"
2. Use `browser_navigate` to open the job application page
3. Use `browser_snapshot` to see the form
4. Read `config/profile.json` for the applicant's data
5. Use `browser_fill_form`, `browser_click`, `browser_select_option` to fill every field
6. Use `browser_take_screenshot` before submitting — show the user
7. Only submit after user confirms

## Key Files
- `config/profile.json` — Applicant profile (name, email, work history, skills, etc.)
- `config/standard-answers.json` — Common ATS question answers
- `config/greenhouse-companies.json` — 929 company board slugs for job discovery
- `src/ats/` — ATS form handlers (reference for field patterns)
- `src/tailor/resume-tailor.ts` — Keyword extraction + match scoring
- `skills/` — Detailed skill instructions for each pipeline stage

## Rules
- Never hardcode personal information — always read from config/profile.json
- Always take screenshots before and after submission
- Always use Playwright MCP for form filling — never fall back to scripts
- Default to dry-run / human review before submitting
- Track every application in data/applications-log.json
