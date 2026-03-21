---
name: master-apply
description: End-to-end job application pipeline. Orchestrates all skills in order — search, filter, resume, apply. Use when the user says "start the pipeline", "run the full pipeline", "apply to everything", "batch apply", or "master apply".
---

# Master Apply — Full Pipeline Orchestrator

Runs the complete job application pipeline from search to submission. **The LLM makes every decision. Scripts are just tools to fetch data — never to make choices.**

## Core Principles

### LLM Is The Brain, Scripts Are Hands
- **Scripts** fetch data, submit forms, read files — they are tools
- **The LLM** reads JDs, decides what to apply to, evaluates fit, writes answers, verifies forms
- **NEVER** let a script decide whether to apply, what to answer, or whether a form is ready
- **NEVER** auto-submit based on a script's output — the LLM must visually verify every form

### Validate Every Assumption
- **Don't assume a field means what you think** — read the full question, read the options
- **Don't assume "Yes" is always right** — some questions are traps ("Have you been convicted?", "Are you under investigation?")
- **Don't assume a form is complete** — take a screenshot and look at it before submitting
- **Don't assume a job is a good match** — read the full JD, not just the title
- **Don't assume already-applied is correct** — verify the log entry matches this exact job

### Protect The User — STOP AND ASK If:
- A question could **incriminate** the user (legal trouble, criminal history, investigations, lawsuits, fraud)
- A question asks about **ongoing legal proceedings**, regulatory actions, or government investigations
- A question asks the user to **waive rights** (arbitration, class action, legal claims)
- A question asks about **financial crimes**, insider trading, money laundering, sanctions violations
- A question asks about **conflicts of interest** in a way that could create legal liability
- A question seems designed to **trap or trick** (double negatives, confusing wording)
- A question is about **health conditions**, medications, or medical history beyond standard disability disclosure
- You're **not 100% sure** what the correct answer is — better to ask than guess wrong
- Any question you haven't seen before that feels **risky or unusual**

**When in doubt: STOP. Show the user the question. Ask what to answer. Never guess on sensitive questions.**

## The Pipeline

```
Step 1: SEARCH  →  Pull job listings (scripts fetch, LLM extracts slugs)
Step 2: FILTER  →  LLM reads each JD, decides keep/remove, scores & orders
Step 3: RESUME  →  LLM generates tailored resume per job
Step 4: APPLY   →  LLM fills forms via Playwright MCP, visually verifies, submits
Step 5: TRACK   →  Log results, save every answer given
```

## Step 1: Search Jobs (`search-jobs` skill)

**Check existing pools first** — don't re-search if data is fresh:
```
data/jobs/swe-usa-jobs.json        — Greenhouse jobs
data/jobs/lever-jobs.json          — Lever jobs
data/jobs/search-results-latest.json
data/company-slugs.json            — growing registry of company slugs
```

Use scripts to pull data, but the LLM decides:
- Are these results fresh enough or do we need to re-pull?
- Did we discover any new company slugs? → Add to registry
- Are there companies we should target that aren't in the registry yet?

**Output:** Job listings in `data/jobs/`

## Step 2: Filter Jobs (`job-filters` skill)

**The LLM reads every job description.** No regex, no keyword matching, no scripts deciding.

For each job, the LLM:
1. Reads the full JD (from API response or by scraping the URL)
2. Understands what the person would actually do day-to-day
3. Decides: developer role? → keep. Non-developer? → remove
4. Checks: already applied? → skip (verify against `data/applications-log.json`)
5. Checks: sponsorship possible? → read the actual JD text, don't assume
6. Scores 0-100 based on how well it matches the applicant's background (read `config/profile.json`)
7. Orders by score: Tier 1 → Tier 2 → Tier 3

**Output:** `data/jobs/filtered-ready.json` with scored, ordered jobs

## Step 3: Generate Resumes (`impress-resume` skill)

For each job, in priority order:

**Always use `impress-resume` for every job, every tier.** No tailor-resume, no base resume. Every application gets a deeply researched, role-by-role rewritten resume.

| Tier | Resume Depth |
|------|-------------|
| Tier 1-3 (top 300) | Deep research, web search company + tech, full 5-role rewrite |
| Tier 4-7 (301-700) | Standard depth, use resumeStrategy notes, rewrite top 3 roles |
| Tier 8-10 (701-1000) | Use resumeStrategy notes, rewrite top 2 roles |

**Parallelize with subagents:**
- Spawn 3-5 subagents, each generating resumes for a batch of jobs
- Subagents need: Read, Write, Bash, WebSearch — NOT Playwright
- Each saves to `data/resumes/{company-slug}-{jobId}/[Name]_Resume.docx`

**Cover letters:** Only if the application form requires one (most don't).

**Output:** `data/resumes/{company-slug}-{jobId}/` folders with .docx resume per job

## Step 4: Apply (`apply-jobs` skill)

For each job with a generated resume:

1. **Re-check** `data/applications-log.json` — already applied? Skip.
2. Navigate to application URL via Playwright MCP
3. Take snapshot → **LLM reads and understands** the form
4. Upload resume
5. **LLM fills each field** using applicant profile — reading each question carefully
6. **STOP on any dangerous/unusual question** — show user, ask for answer
7. Screenshot → **LLM visually verifies** every field before submitting
8. Submit (or pause for user approval)
9. Screenshot post-submit → **LLM verifies** submission success
10. Save answers to `data/resumes/{company-slug}-{jobId}/answers.json`
11. Log to `data/applications-log.json`

**The LLM must visually verify the form via screenshot before EVERY submission. No blind submits.**

## Step 5: Track Results

After each application:
- Update `data/applications-log.json`
- Save `answers.json` next to the resume (every question and every answer)
- Report progress: X submitted, Y failed, Z remaining

## Orchestration Modes

### Full pipeline:
```
1. Load or create filtered-ready.json
2. For each job in score order:
   a. Re-check already-applied → skip if yes
   b. Generate resume (subagent if parallel, or inline)
   c. Apply via Playwright MCP — LLM fills, verifies, submits
   d. Log result and all answers
3. Report final stats
```

### Batch mode (N jobs at a time):
```
User says: "apply to the next 20 jobs"
1. Take top 20 unprocessed from filtered-ready.json
2. Generate 20 resumes (parallel subagents: 4 agents × 5 jobs each)
3. Apply 20 jobs — LLM fills each one, verifies each one
4. Report: 18 submitted, 1 failed, 1 had unusual question (paused for user)
```

### Single job:
```
User says: "apply to this job: [URL]"
1. Scrape JD from URL → extract slug → add to registry
2. LLM reads JD, confirms it's a good fit
3. Generate impress-resume
4. Apply via Playwright MCP
5. Log result
```

## Parallel Subagent Strategy

**What runs in parallel (subagents):**
- Resume generation — 3-5 subagents, each doing a batch
- JD reading for filtering — multiple subagents reading JDs simultaneously

**What runs sequentially (main agent):**
- Form filling via Playwright MCP — one browser, one agent at a time
- Submission and verification — LLM must visually confirm each one

## Questions That Require User Approval

**ALWAYS stop and ask the user before answering:**

| Category | Examples |
|----------|---------|
| Criminal/legal | "Have you ever been convicted?", "Are you under investigation?", "Any pending charges?" |
| Financial crimes | "Have you been sanctioned?", "Any SEC violations?", "Insider trading?" |
| Waivers/rights | "Do you agree to mandatory arbitration?", "Waive right to class action?" |
| Non-standard NDAs | "Will you sign our proprietary IP agreement?" |
| Health/medical | Anything beyond standard ADA disability disclosure |
| Tricky wording | Double negatives, confusing phrasing, questions designed to trap |
| Unknown questions | Anything not in the standard answer set that feels risky |

**Safe to auto-answer (from config/profile.json and config/standard-answers.json):**
- Name, email, phone, address, LinkedIn, website
- Work authorization, sponsorship needed
- Standard EEO demographics (gender, race, veteran, disability)
- Salary expectation (from profile)
- How heard, willing to relocate
- Previously worked at company, non-compete
- Self-assessment scales (always highest/best option unless profile says otherwise)

## Key Files

```
Pipeline data:
  data/jobs/filtered-ready.json       — filtered & scored jobs
  data/applications-log.json          — all submitted applications (dedup)
  data/resumes/{slug}-{id}/           — per-job folder with resume + answers
  data/company-slugs.json             — growing slug registry

Config:
  config/profile.json                 — applicant data
  config/standard-answers.json        — standard ATS answers
  config/search-queries.json          — LinkedIn search queries
  templates/resume-base.txt           — source-of-truth resume

Skills (in order):
  search-jobs    → Pull job listings, grow slug registry
  job-filters    → LLM reads JDs, filters & scores
  impress-resume → LLM generates tailored resume
  cover-letter   → LLM generates cover letter (only if required)
  apply-jobs     → LLM fills & submits via Playwright MCP
```

## Rules

1. **LLM decides everything** — scripts fetch data, LLM makes choices
2. **Validate every assumption** — read the actual question, don't guess
3. **STOP on dangerous questions** — anything that could incriminate or create legal liability → ask user
4. **Visually verify every form** — screenshot before submit, LLM checks it
5. **Never duplicate** — check already-applied before every action
6. **Filter before resume** — don't waste time on bad matches
7. **Resume before apply** — never apply without a tailored resume
8. **Score order** — best matches first (Tier 1 → 2 → 3)
9. **Log everything** — every application, every answer, every result
10. **Grow the slug registry** — every URL you see, extract and save the slug
11. **Re-check the log between batches** — it grows as we work
12. **Report progress** — after every batch, show submitted/failed/remaining
13. **When in doubt, ask** — it's always safer to pause and ask the user than to guess wrong
