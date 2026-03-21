# Job Automation Pipeline - Architecture Documentation

## Overview

This is a semi-automated job application pipeline that:
1. Searches LinkedIn for relevant jobs
2. Scrapes full job descriptions
3. Analyzes match score against the user's resume
4. Generates tailoring prompts for Claude to create custom resumes + cover letters
5. Opens a browser and fills application forms on various ATS systems
6. Pauses for human review before submission
7. Tracks every application, resume, and cover letter submitted

## Design Philosophy
- **Not aggressive**: Professional, thoughtful cover letters that highlight genuine strengths
- **Track everything**: Every resume, cover letter, and submission is saved and linked in the tracker DB
- **Semi-auto first**: Always pauses for human review before submitting
- **Session-resilient**: All state persists across Claude Code compact windows via JSON files + SQLite

## Pipeline Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Search     │ -> │ Scrape JD   │ -> │ Analyze     │ -> │ Tailor      │
│ (LinkedIn)   │    │ (Playwright)│    │ Match Score │    │ Resume + CL │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                                                                v
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Track      │ <- │ Submit      │ <- │ Review      │ <- │ Fill Form   │
│ (SQLite)     │    │ (Click)     │    │ (Human)     │    │ (Playwright)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## Application Status Flow

```
discovered → scraped → resume_tailored → form_started → review_pending → submitted
                                                              ↓
                                                          skipped / rejected / interview / offer
```

## Module Map

| Module | File | Purpose |
|--------|------|---------|
| Job Searcher | `src/search/job-searcher.ts` | Batch LinkedIn searches via `linkedin-jobs-api` |
| JD Scraper | `src/scraper/job-detail-scraper.ts` | Playwright-based full JD extraction from LinkedIn URLs |
| Resume Tailor | `src/tailor/resume-tailor.ts` | Keyword extraction, match scoring, tailoring prompt generation |
| ATS Detector | `src/ats/detector.ts` | URL + DOM pattern matching to identify ATS systems |
| Base Handler | `src/ats/base-handler.ts` | Abstract base class with safe form-filling helpers |
| Greenhouse | `src/ats/greenhouse.ts` | Greenhouse ATS form filler |
| Lever | `src/ats/lever.ts` | Lever ATS form filler |
| Generic | `src/ats/generic.ts` | Fallback handler using smart label matching |
| Tracker | `src/tracker/application-tracker.ts` | SQLite CRUD for all applications |
| State | `src/utils/state.ts` | Session state + pending review queue persistence |
| Orchestrator | `src/pipeline/orchestrator.ts` | Main pipeline coordinator with review checkpoints |

## Technology Stack

- **Runtime**: Node.js 20+ (use `npx -y node@20` wrapper)
- **Language**: TypeScript (ESM modules)
- **Browser Automation**: Playwright
- **Database**: SQLite via `better-sqlite3`
- **Job Search**: `linkedin-jobs-api` (scrapes public LinkedIn listings, no auth needed)
- **MCP Servers**: LinkedIn search + Playwright configured in `~/.claude/mcp.json`
