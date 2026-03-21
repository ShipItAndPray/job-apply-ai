---
name: search-jobs
description: Search and pull job listings from LinkedIn, Greenhouse, and Lever. Use when the user says "search jobs", "find jobs", "pull jobs", "get jobs", "pull from greenhouse", "pull from lever", "refresh jobs", or "what jobs are out there".
---

# Search Jobs Skill

Pulls fresh job listings from LinkedIn, Greenhouse, and Lever. Deduplicates, removes already-applied, and saves a clean ready-to-process list.

## The Slug Registry — ALWAYS GROWING

**File:** `data/company-slugs.json`

Master list of every company slug we know on Greenhouse and Lever. Grows every time we see a URL from any source.

**RULE:** Every time you see a Greenhouse or Lever URL anywhere — search results, application logs, user messages, careers pages — extract the slug and add it to the registry.

```
https://boards.greenhouse.io/stripe/jobs/123       → greenhouse: "stripe"
https://job-boards.greenhouse.io/coinbase/jobs/456  → greenhouse: "coinbase"
https://jobs.lever.co/whoop/abc-def                → lever: "whoop"
```

**Rebuild from all existing data:**
```bash
node scripts/build-slug-registry.cjs
```

---

## Pull From Greenhouse

When user says "pull from greenhouse" or "refresh greenhouse":

### Step 1: Load all Greenhouse slugs
```javascript
const slugs = Object.keys(require('./data/company-slugs.json').greenhouse);
```

### Step 2: Hit every slug's API to get all open jobs with full JDs
```
GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
```

The `?content=true` returns the full job description HTML. No auth needed.

### Step 3: Parallelize
- Use subagents or parallel HTTP calls to pull from multiple slugs simultaneously
- Parallelize 10-20 at a time for speed
- Each call returns ALL open jobs at that company

### Step 4: Normalize every job to standard format
```json
{
  "id": "greenhouse job ID",
  "title": "Senior Backend Engineer",
  "company": "Stripe",
  "company_slug": "stripe",
  "location": "San Francisco, CA",
  "url": "https://boards.greenhouse.io/stripe/jobs/123",
  "source": "greenhouse",
  "ats": "greenhouse",
  "description": "Full JD HTML/text from API",
  "pulledAt": "2026-03-04T..."
}
```

### Step 5: Deduplicate and clean
- Remove jobs with same ID as any entry in `data/applications-log.json`
- Remove jobs with same (company + title) already in the log (catches reposted jobs)
- Remove exact duplicates (same job ID)

### Step 6: Save fresh copy
- Save ALL pulled jobs (before dedup): `data/jobs/greenhouse-all-{date}.json`
- Save clean ready-to-process list: `data/jobs/greenhouse-fresh.json` (only new, unapplied jobs)
- Update `data/jobs/swe-usa-jobs.json` with the merged latest data

---

## Pull From Lever

When user says "pull from lever" or "refresh lever":

### Step 1: Load all Lever slugs
```javascript
const slugs = Object.keys(require('./data/company-slugs.json').lever);
```

### Step 2: Hit every slug's API
```
GET https://api.lever.co/v0/postings/{slug}
```

Returns JSON array of all open positions with title, description, location, team. No auth needed.

### Step 3: Parallelize (same as Greenhouse)

### Step 4: Normalize to standard format
```json
{
  "id": "lever posting ID",
  "title": "Senior Software Engineer",
  "company": "Plaid",
  "company_slug": "plaid",
  "location": "San Francisco, CA",
  "url": "https://jobs.lever.co/plaid/{id}/apply",
  "source": "lever",
  "ats": "lever",
  "description": "Full JD from API",
  "pulledAt": "2026-03-04T..."
}
```

### Step 5: Deduplicate and clean (same as Greenhouse)

### Step 6: Save fresh copy
- Save ALL: `data/jobs/lever-all-{date}.json`
- Save clean: `data/jobs/lever-fresh.json`
- Update `data/jobs/lever-jobs.json` with merged latest

### Growing the Lever slug list
Lever has far fewer known slugs than Greenhouse. To grow it:
- Every LinkedIn search result with a `jobs.lever.co` URL → extract slug → add to registry
- Search: `site:jobs.lever.co software engineer` to discover Lever companies
- When user mentions a company, try `https://api.lever.co/v0/postings/{slug}` — if it returns data, add to registry
- Check competitor lists, "companies using Lever" directories

---

## Pull From LinkedIn

When user says "pull from linkedin" or "search linkedin":

### Step 1: Run search with configured queries
```bash
npx -y --quiet node@20 scripts/search-jobs.cjs
```

Or use `linkedin-jobs-search` MCP server for custom queries.

### Step 2: Scan EVERY result URL for Greenhouse/Lever slugs
This is critical — LinkedIn is how we discover new companies on Greenhouse and Lever.

For each job result:
- If apply URL contains `greenhouse.io/{slug}` → add slug to registry
- If apply URL contains `lever.co/{slug}` → add slug to registry
- If apply URL contains `myworkdayjobs.com` → note it (Workday, different flow)

### Step 3: Normalize, deduplicate, save
- LinkedIn results usually DON'T have full JDs — just title, company, location, URL
- The JD needs to be scraped separately (or we pull from Greenhouse/Lever API if we have the slug)
- Save: `data/jobs/linkedin-fresh.json`

### Step 4: Trigger Greenhouse/Lever pulls for any new slugs discovered
If LinkedIn search found new Greenhouse slugs we didn't have before:
- Add them to `data/company-slugs.json`
- Pull ALL their jobs via the Greenhouse API
- This turns a few LinkedIn results into potentially many more new jobs

---

## LinkedIn External ATS — Non-Easy-Apply Jobs

**User owns Easy Apply. We automate external ATS only.**

When user says "linkedin external jobs", "find linkedin external", "linkedin non-easy-apply":

### What is Non-Easy-Apply?
- **Easy Apply**: Form fills on LinkedIn itself — user handles these manually
- **External ATS**: Clicking Apply redirects to company's career page (Greenhouse, Lever, Workday, Ashby, etc.) — we automate these
- LinkedIn shows "Responses managed off LinkedIn" + Apply ↗ icon for external jobs

### Step 1: Search LinkedIn (No Auth Needed)
```javascript
const { query } = require('linkedin-jobs-api');
const results = await query({
  keyword: 'Senior Backend Engineer',
  location: 'United States',
  dateSincePosted: 'past week',
  limit: '25'
});
// Results have: position, company, location, jobUrl, agoTime
// jobUrl format: https://www.linkedin.com/jobs/view/{jobId}/
```

Extract jobId from each URL: `jobUrl.match(/view\/(\d+)/)?.[1]`

### Step 2: Get External Apply URL via Playwright
For each job:
```
1. Navigate to: https://www.linkedin.com/jobs/view/{jobId}/apply/
2. Take snapshot: browser_snapshot
3. Look for link containing "Apply to ... on company website" OR "Apply on company website"
4. If found → external job, capture the href URL
5. If only "Easy Apply" button found → skip (user handles these)
```

### Step 3: Detect ATS from External URL

```javascript
function detectATS(url) {
  if (url.includes('greenhouse.io') || url.includes('job-boards.greenhouse.io')) return 'greenhouse';
  if (url.includes('lever.co')) return 'lever';
  if (url.includes('myworkdayjobs.com') || url.includes('workday.com')) return 'workday';
  if (url.includes('ashbyhq.com')) return 'ashby';
  if (url.includes('rippling.com')) return 'rippling';
  if (url.includes('icims.com')) return 'icims';
  if (url.includes('jobvite.com')) return 'jobvite';
  if (url.includes('smartrecruiters.com')) return 'smartrecruiters';
  if (url.includes('taleo.net')) return 'taleo';
  if (url.includes('bamboohr.com')) return 'bamboohr';
  return 'unknown';
}
```

Also extract slugs from Greenhouse/Lever URLs and add to `data/company-slugs.json`.

### Step 4: Fetch Full JD
Once you have the external ATS URL, fetch the full JD:
- **Greenhouse**: `GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{jobId}?content=true`
- **Lever**: `GET https://api.lever.co/v0/postings/{slug}/{postingId}`
- **Workday/Others**: Scrape the career page directly via Playwright

### Step 5: Save to linkedin-external-fresh.json

```json
{
  "id": "linkedin-{jobId}",
  "linkedInJobId": "4382141809",
  "linkedInUrl": "https://www.linkedin.com/jobs/view/4382141809/",
  "externalUrl": "https://job-boards.greenhouse.io/acme/jobs/6253501",
  "ats": "greenhouse",
  "atsSlug": "acme",
  "atsJobId": "6253501",
  "title": "Lead Backend Engineer",
  "company": "Acme Corp",
  "location": "United States",
  "description": "Full JD text...",
  "pulledAt": "2026-03-07T...",
  "applyUrl": "https://job-boards.greenhouse.io/acme/jobs/6253501"
}
```

Save to: `data/jobs/linkedin-external-fresh.json`

### Step 6: Deduplicate
Remove any jobs already in:
- `data/applications-log.json`
- `data/jobs.applied`
- Previous linkedin-external results with same externalUrl

### Batching Strategy
- Process 5-10 jobs at a time (LinkedIn rate limits)
- Wait 2-3 seconds between job page navigations
- Use the same browser tab for all navigations — don't create new tabs per job

### Output Summary
```
LinkedIn External ATS Pull:
  Searched: 25 LinkedIn jobs
  External ATS (non-Easy-Apply): 14
  Easy Apply (skipped): 11
  Already applied (deduped): 2
  New jobs ready: 12

  By ATS:
    Greenhouse: 7
    Workday: 3
    Lever: 1
    Ashby: 1
    Unknown: 0

  Saved to: data/jobs/linkedin-external-fresh.json
─────────────────────────
Ready for: impress-resume → apply-jobs
```

### Apply Order (after pulling)
1. **Greenhouse** jobs first — fastest to apply, API gives full JD
2. **Lever** jobs second — also fast
3. **Workday** jobs third — requires more browser work
4. **Ashby/Others** — case by case via apply-jobs skill

---

## Discover New Slugs (Don't Miss Anyone)

The slug registry should keep growing. Actively hunt for new companies.

### Sources to mine for new slugs:

**Web searches:**
- `site:boards.greenhouse.io software engineer` → find Greenhouse companies
- `site:job-boards.greenhouse.io software engineer` → alternate Greenhouse domain
- `site:jobs.lever.co software engineer` → find Lever companies

**Curated lists:**
- Search: `"companies using greenhouse" list 2026`
- Search: `"companies using lever" list 2026`
- Search: `"best tech companies hiring" 2026 software engineer`
- Search: `"YC companies hiring" greenhouse`

**From job boards:**
- Hacker News "Who's Hiring" monthly threads — extract Greenhouse/Lever URLs
- Reddit r/cscareerquestions — job postings often link to Greenhouse/Lever
- BuiltIn.com, AngelList — career page links

**How to verify a slug:**
- Greenhouse: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs` — if it returns JSON, it's valid
- Lever: `https://api.lever.co/v0/postings/{slug}` — if it returns JSON array, it's valid

---

## Pull Everything (Full Refresh)

When user says "pull all jobs" or "refresh everything":

1. **LinkedIn search** → discover new company slugs
2. **Update registry** with any new slugs found
3. **Greenhouse API** → pull ALL jobs from ALL known slugs
4. **Lever API** → pull ALL jobs from ALL known slugs
5. **Merge all sources** → deduplicate across LinkedIn/Greenhouse/Lever
6. **Remove already-applied** → check against `data/applications-log.json`
7. **Save fresh master list** → `data/jobs/all-fresh-{date}.json`

---

## Tracking — Pull Jobs Keeps The Master List

**Pull jobs owns the complete job inventory. Filter jobs owns the decisions.**

Every pull:
1. Fetch ALL jobs from the platform (Greenhouse API, Lever API, LinkedIn)
2. Compare against the **previous master pull** to find what's NEW
3. Save the full master list (replaces previous)
4. Report: total jobs, new since last pull, removed since last pull

**The pull skill does NOT filter.** It pulls everything — all roles, all locations, all departments. The filter skill handles what to keep.

## Output Files

| File | What | Who Owns It |
|------|------|-------------|
| `data/jobs/greenhouse-master.json` | ALL Greenhouse jobs from latest pull | **search-jobs** (updated every pull) |
| `data/jobs/lever-master.json` | ALL Lever jobs from latest pull | **search-jobs** |
| `data/jobs/linkedin-master.json` | ALL LinkedIn results from latest pull | **search-jobs** |
| `data/jobs/linkedin-external-fresh.json` | LinkedIn non-Easy-Apply jobs with external ATS URLs | **search-jobs** |
| `data/jobs/filtered-ready.json` | Filtered, scored, ordered jobs | **job-filters** (separate skill) |
| `data/company-slugs.json` | Growing slug registry | **search-jobs** |

Print summary after pull:
```
Greenhouse Pull:
  Previous pull: X jobs from Y companies
  Current pull:  X jobs from Y companies
  NEW jobs:      X (not in previous pull)
  Removed jobs:  X (in previous but not current — taken down or filled)
  Total master:  X
─────────────────────────
Ready for filtering (run job-filters skill)
```

## After Pulling

Hand off to the pipeline:
1. **job-filters** → LLM reads each JD, scores & orders
2. **impress-resume** → Generate tailored resume per job
3. **apply-jobs** → Fill & submit via Playwright MCP

## Rules

1. **Always pull with full JDs** — use `?content=true` on Greenhouse API
2. **Always deduplicate** — by job ID AND by (company + title) fuzzy match
3. **Always remove already-applied** — check `data/applications-log.json` every time
4. **Always update the slug registry** — every URL you encounter, extract and save the slug
5. **Parallelize API calls** — 10-20 concurrent requests for speed
6. **Save raw AND clean copies** — raw for reference, clean for processing
7. **LinkedIn discovers, APIs complete** — LinkedIn finds companies, then pull ALL their jobs from API
8. **Don't filter during pull** — get everything, let the filter skill decide what's good
9. **Track what changed** — note which companies have new jobs since last pull

## Files
```
Slug registry:     data/company-slugs.json
Search queries:    config/search-queries.json
Search script:     scripts/search-jobs.cjs
Registry builder:  scripts/build-slug-registry.cjs
Job data:          data/jobs/
Application log:   data/applications-log.json
```
