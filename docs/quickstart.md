# Quickstart Guide

## Prerequisites
- Node.js 20+ (use `npx -y node@20` to run commands)
- npm dependencies installed (`npm install` in project root)
- Playwright browsers installed (`npx playwright install chromium`)

## Step-by-Step Usage

### 1. Search for jobs
```bash
cd /path/to/job-apply-ai
npx -y node@20 --loader ts-node/esm scripts/search.ts --24hr
```
This runs 6 search queries, deduplicates, and saves new jobs to the tracker.

### 2. Check status
```bash
npx -y node@20 --loader ts-node/esm scripts/status.ts
```
Shows dashboard with job counts by status, recent searches, pending jobs.

### 3. Process a job (semi-auto pipeline)
In a Claude Code session:
```
1. Read data/memory/session-state.json to see current state
2. Pick a job from the "discovered" list
3. The orchestrator will:
   a. Scrape the full job description
   b. Compute match score
   c. Show you the tailoring prompt
   d. You generate a tailored resume + cover letter
   e. Browser opens and fills the form
   f. You review the screenshot and approve/abort
   g. Application is submitted and tracked
```

### 4. Where things are saved
- Job search results: `data/jobs/{id}.json`
- Full job descriptions: `data/jobs/{id}-details.json`
- Tailored resumes: `data/resumes/{id}/resume.txt`
- Cover letters: `data/resumes/{id}/cover_letter.txt`
- Pre/post submit screenshots: `data/screenshots/`
- Application tracker: `data/tracker.db`
- Session state: `data/memory/session-state.json`
- Pending reviews: `data/memory/pending-reviews.json`

## Config Files
- `config/profile.json` — Your personal info, skills, work history (used for form filling)
- `config/search-queries.json` — Search criteria (edit to add/modify searches)
- `config/ats-selectors.json` — CSS selectors for each ATS system

## Common Operations

### Add a new search query
Edit `config/search-queries.json` and add an entry to the queries array.

### Skip a job
Update the tracker: set status to 'skipped' with a note.

### Re-process a job
Change its status back to 'discovered' in the tracker.

## Troubleshooting

### Node version errors
Always use `npx -y node@20` to run anything. The system Node is v18 which is too old.

### LinkedIn blocking scraping
The scraper returns partial data. Try again later or use a different IP.

### Playwright browser not installed
Run: `npx playwright install chromium`

### SQLite errors
Delete `data/tracker.db` and re-run search to recreate.
