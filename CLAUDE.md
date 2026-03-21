# Job Apply AI — Claude Code Instructions

## Quick Start
1. Read `config/profile.example.json` to understand the profile schema
2. User must create `config/profile.json` with their own data before running
3. Use `docs/quickstart.md` for setup guide

## Key Files
- `src/ats/` — ATS form handlers (Greenhouse, Lever, Generic)
- `src/pipeline/orchestrator.ts` — Main pipeline
- `src/tailor/resume-tailor.ts` — Keyword extraction + match scoring
- `config/` — Profile and ATS configuration

## Rules
- Never hardcode personal information — always read from config/profile.json
- Always take screenshots before and after submission
- Default to semi-auto mode (skipSubmit: true)
- Track every application in the SQLite database
