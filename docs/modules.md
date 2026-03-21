# Module Reference

## 1. Job Searcher (`src/search/job-searcher.ts`)

### What it does
Wraps the `linkedin-jobs-api` npm package to run batch job searches. Runs multiple keyword/location queries in parallel, deduplicates by job URL, and saves each result to `data/jobs/{id}.json`.

### Key exports
- `searchJobs(queries: SearchQuery[])` — Run searches, return deduplicated results
- `loadSearchQueries()` — Load queries from `config/search-queries.json`
- `searchJobsFromConfig()` — Convenience: load + search in one call

### SearchQuery interface
```typescript
{ keyword, location, dateSincePosted?, jobType?, remoteFilter?, salary?, experienceLevel?, limit?, sortBy? }
```

### JobListing interface
```typescript
{ id, position, company, location, postedDate, salary, jobUrl, source: 'linkedin', searchedAt }
```

### ID generation
MD5 hash of `company + position + jobUrl`, truncated to 12 chars.

---

## 2. JD Scraper (`src/scraper/job-detail-scraper.ts`)

### What it does
Uses Playwright to navigate to LinkedIn job URLs and extract the full job description, requirements, apply URL, salary, and job type. Uses anti-detection measures (custom user agent, disabled automation flags).

### Key exports
- `scrapeJobDetails(jobUrl: string)` — Scrape one job, returns `JobDetails`
- `scrapeMultipleJobs(urls: string[])` — Batch scrape with polite delays
- `saveJobDetails(jobId, details)` — Save to `data/jobs/{id}-details.json`

### CSS selectors used (with fallbacks)
- Title: `.top-card-layout__title`, `.topcard__title`, `h1`
- Company: `.topcard__org-name-link`, `.top-card-layout__company-name`
- Description: `.show-more-less-html__markup`, `.description__text`
- Apply button: `a.apply-button`, `a[data-tracking-control-name*="apply"]`

### Handles LinkedIn blocking gracefully
Returns partial data with whatever was extracted rather than throwing.

---

## 3. Resume Tailor (`src/tailor/resume-tailor.ts`)

### What it does
Analyzes job descriptions to extract keywords, computes match scores against the user's resume, and generates structured prompts for Claude to create tailored resumes and cover letters.

### Key exports
- `extractKeywords(jd)` — Returns `{ required, preferred, technologies }` from 200+ keyword dictionary across 7 categories
- `computeMatchScore(resume, jd)` — Returns `{ score (0-100), matched[], missing[] }`
- `generateTailoringPrompt(input)` — Creates a detailed prompt for Claude with the base resume, JD, and instructions
- `saveTailoredDocuments(jobId, resume, coverLetter)` — Saves to `data/resumes/{jobId}/`
- `parseTailoringResponse(input, llmResponse)` — Parses Claude's response into resume + cover letter

### Keyword categories
Programming languages, frameworks, tools, cloud services, methodologies, soft skills, industry terms

### Match score formula
`(matched_keywords / total_jd_keywords) * 100`

---

## 4. ATS Detector (`src/ats/detector.ts`)

### What it does
Identifies which Applicant Tracking System a job application URL belongs to.

### Key exports
- `detectATSFromUrl(url)` — Fast URL-only pattern matching (confidence 0.90-0.95)
- `detectATSFromDOM(page, url)` — Fallback DOM-based detection using Playwright Page (confidence 0.80-0.85)

### Supported ATS systems
| System | URL patterns | Confidence |
|--------|-------------|------------|
| Workday | myworkdayjobs.com, wd1-5.*.com | 0.95 |
| Greenhouse | boards.greenhouse.io | 0.95 |
| Lever | jobs.lever.co | 0.95 |
| iCIMS | *.icims.com | 0.90 |
| SmartRecruiters | jobs.smartrecruiters.com | 0.90 |
| Ashby | jobs.ashbyhq.com | 0.90 |

---

## 5. ATS Form Handlers

### Base Handler (`src/ats/base-handler.ts`)
Abstract class providing:
- `safeFill(selector, value)` — Fill input, returns false if not found
- `safeClick(selector)` — Click element, returns false if not found
- `safeSelect(selector, value)` — Select dropdown option
- `safeUpload(selector, filePath)` — Upload file
- `waitAndFill(selector, value, timeout?)` — Wait for element then fill
- `takeScreenshot(name)` — Save screenshot to `data/screenshots/`

### Greenhouse Handler (`src/ats/greenhouse.ts`)
Single-page form with standard HTML inputs. Fills: first name, last name, email, phone, LinkedIn, resume upload, cover letter upload, work authorization, demographics.

### Lever Handler (`src/ats/lever.ts`)
Similar to Greenhouse but uses combined full name field. Also fills current company and handles Lever-specific question patterns.

### Generic Handler (`src/ats/generic.ts`)
Smart fallback that scans all visible form fields, reads labels/placeholders/names, and matches them against 20+ field patterns using keyword matching. Handles textareas (logs for manual review) and auto-checks terms checkboxes.

---

## 6. Application Tracker (`src/tracker/application-tracker.ts`)

### What it does
SQLite-backed persistence tracking every job through the pipeline.

### Tables
- `applications` — One row per job with: id, URLs, company, position, location, status, ATS system, match score, timestamps, file paths, notes, errors
- `search_runs` — Log of every search query run

### Key methods
- `addJob(job)` — Insert new job (returns false if duplicate by URL)
- `updateStatus(id, status, notes?)` — Update status + auto-set timestamp
- `setMatchScore(id, score)`, `setAtsSystem(id, ats)`, `setResumePaths(id, resume, coverLetter)` — Field setters
- `getByStatus(status)`, `getAll()`, `getById(id)` — Queries
- `getStats()` — Returns `{ total, byStatus, byATS }`
- `isDuplicate(jobUrl)` — Check for existing entry

---

## 7. State Manager (`src/utils/state.ts`)

### What it does
Persists pipeline state to JSON files so any new Claude session can pick up where the last left off.

### Files
- `data/memory/session-state.json` — Overall pipeline state (last action, counts, errors)
- `data/memory/pending-reviews.json` — Jobs awaiting human review

### Key exports
- `loadSessionState()`, `updateSessionState(updates)` — Read/write session state
- `loadPendingReviews()`, `addPendingReview(review)`, `removePendingReview(jobId)` — Manage review queue

---

## 8. Orchestrator (`src/pipeline/orchestrator.ts`)

### What it does
The main pipeline coordinator. Chains all modules together with two review checkpoints.

### Key exports
- `processJobSemiAuto(jobId, jobUrl, options?)` — Process a single job through the pipeline
- `processBatch(limit?, options?)` — Process a batch of discovered jobs
- `stepScrapeJob(tracker, jobId, jobUrl)` — Individual pipeline step
- `stepAnalyzeMatch(tracker, jobId, jd, resume)` — Individual pipeline step
- `stepSaveTailoredDocuments(tracker, jobId, resume, coverLetter)` — Individual pipeline step
- `stepFillApplication(tracker, jobId, applyUrl, resumePath, coverLetterPath?, options?)` — Individual pipeline step
- `stepSubmit(tracker, jobId, page, browser, atsSystem)` — Individual pipeline step
- `getPipelineSummary()` — Human-readable status

### Review Checkpoints
1. **After match analysis** — Shows match score, keywords, and tailoring prompt. Pipeline pauses. User/Claude generates tailored resume and cover letter.
2. **After form filling** — Takes screenshot of filled form. Pipeline pauses. User approves or aborts before clicking submit.

### Default options
```typescript
{ mode: 'semi-auto', minMatchScore: 40, headless: false, screenshotBeforeSubmit: true, skipSubmit: true }
```
Note: `skipSubmit: true` by default for safety.
