# Data Tracking & Cover Letter Management

## What We Track

Every job application is tracked in SQLite (`data/tracker.db`) with full history:

### Per Application
| Field | Description |
|-------|-------------|
| `id` | Unique job ID (MD5 hash) |
| `job_url` | Original LinkedIn job URL |
| `apply_url` | External application URL (Workday, Greenhouse, etc.) |
| `company` | Company name |
| `position` | Job title |
| `location` | Job location |
| `status` | Pipeline status (discovered → submitted) |
| `ats_system` | Detected ATS (workday, greenhouse, lever, etc.) |
| `match_score` | How well your resume matches the JD (0-100) |
| `job_description_path` | Path to saved full JD |
| `tailored_resume_path` | Path to the tailored resume used for THIS application |
| `cover_letter_path` | Path to the cover letter used for THIS application |
| `discovered_at` | When we first found the job |
| `scraped_at` | When we scraped the full JD |
| `tailored_at` | When we created the tailored resume |
| `applied_at` | When we submitted the application |
| `notes` | Any notes about the application |
| `error_log` | Errors encountered during processing |

### Per Search Run
| Field | Description |
|-------|-------------|
| `query_keyword` | Search keyword used |
| `query_location` | Location searched |
| `results_count` | Total results found |
| `new_jobs_found` | New jobs (not duplicates) |
| `run_at` | When the search was run |

## File Organization

```
data/
├── tracker.db                    # SQLite database with all application records
├── jobs/
│   ├── {id}.json                 # Basic job listing from search
│   └── {id}-details.json         # Full scraped job description
├── resumes/
│   └── {id}/
│       ├── resume.txt            # Tailored resume for THIS specific job
│       └── cover_letter.txt      # Tailored cover letter for THIS specific job
├── screenshots/
│   ├── {id}-pre-submit.png       # Screenshot of filled form before submitting
│   └── {id}-post-submit.png      # Screenshot after submission confirmation
└── memory/
    ├── session-state.json        # Pipeline state for session continuity
    └── pending-reviews.json      # Jobs awaiting human review
```

## Cover Letter Approach

Cover letters are:
- **Professional and thoughtful** — not aggressive or generic
- **Tailored per job** — each cover letter references the specific role, company, and how the candidate's experience aligns
- **Highlights genuine strengths** — references specific achievements and experience from your profile
- **Saved permanently** — every cover letter is saved at `data/resumes/{jobId}/cover_letter.txt` and linked in the tracker DB
- **Auditable** — you can always go back and see exactly what was sent to each company

## Querying the Tracker

The tracker supports:
```typescript
tracker.getAll()                    // All applications
tracker.getByStatus('submitted')    // All submitted apps
tracker.getByStatus('discovered')   // Jobs not yet processed
tracker.getStats()                  // { total, byStatus, byATS }
tracker.getById(jobId)              // Full details for one job
```

## Verifying What Was Sent

For any submitted application:
1. Find the job in tracker: `tracker.getById(jobId)`
2. Read the tailored resume: `cat data/resumes/{id}/resume.txt`
3. Read the cover letter: `cat data/resumes/{id}/cover_letter.txt`
4. View the pre-submit screenshot: `open data/screenshots/{id}-pre-submit.png`
5. View the post-submit screenshot: `open data/screenshots/{id}-post-submit.png`
