# job-apply-ai

AI-powered job application pipeline. Search jobs, tailor resumes with AI, auto-fill ATS forms using Playwright.

Built with Claude Code as the AI backbone — the skills system turns Claude into your job application agent.

## What It Does

1. **Search** — Pull job listings from LinkedIn, Greenhouse, Lever
2. **Filter** — LLM-powered filtering removes bad matches (wrong level, no sponsorship, etc.)
3. **Tailor** — AI generates keyword-optimized resumes matched to each job description
4. **Apply** — Playwright browser automation fills Greenhouse, Lever, and Workday forms
5. **Track** — SQLite database tracks every application through the pipeline

## Supported ATS Systems

| ATS | Auto-Detect | Form Fill | Status |
|-----|------------|-----------|--------|
| Greenhouse | ✅ URL + DOM | ✅ Full | Production |
| Lever | ✅ URL + DOM | ✅ Full | Production |
| Workday | ✅ URL + DOM | 🔧 Partial | Beta |
| iCIMS | ✅ URL | 🔧 Generic | Beta |
| SmartRecruiters | ✅ URL | 🔧 Generic | Beta |
| Ashby | ✅ URL + DOM | 🔧 Generic | Beta |
| Any other | Fallback | 🔧 Generic | Best-effort |

## Quick Start

### Prerequisites
- Node.js 20+
- Claude Code CLI (for AI-powered features)

### Setup

```bash
git clone https://github.com/ShipItAndPray/job-apply-ai.git
cd job-apply-ai
npm install
npx playwright install chromium

# Copy and customize your profile
cp config/profile.example.json config/profile.json
# Edit config/profile.json with YOUR information
```

### Usage with Claude Code

The real power is using this with Claude Code's skills system:

```bash
# Copy skills to your Claude Code skills directory
cp -r skills/* ~/.claude/skills/

# Then in Claude Code:
claude "search for senior backend engineer jobs"
claude "tailor my resume for this job at Stripe"
claude "apply to the top 5 matching jobs"
claude "run the full pipeline"
```

### Usage as a Library

```typescript
import { searchJobsFromConfig } from './src/search/job-searcher.js';
import { detectATSFromUrl } from './src/ats/detector.js';
import { computeMatchScore } from './src/tailor/resume-tailor.js';

// Search
const results = await searchJobsFromConfig();

// Detect ATS
const ats = detectATSFromUrl('https://boards.greenhouse.io/company/jobs/123');
// → { system: 'greenhouse', confidence: 0.95 }

// Score resume match
const { score, matched, missing } = computeMatchScore(resumeText, jobDescription);
```

## Architecture

```
src/
├── ats/                    # ATS form handlers
│   ├── base-handler.ts     # Abstract base with safe fill/click/upload
│   ├── detector.ts         # URL + DOM ATS detection
│   ├── greenhouse.ts       # Greenhouse-specific handler
│   ├── lever.ts            # Lever-specific handler
│   └── generic.ts          # Fallback regex-matching handler
├── pipeline/
│   └── orchestrator.ts     # 5-step pipeline with human review checkpoints
├── scraper/
│   └── job-detail-scraper.ts  # Playwright-based job page scraper
├── search/
│   └── job-searcher.ts     # LinkedIn job search
├── tailor/
│   └── resume-tailor.ts    # Keyword extraction + match scoring + LLM prompt gen
├── tracker/
│   └── application-tracker.ts  # SQLite CRUD for application lifecycle
└── utils/
    └── state.ts            # Session state persistence

config/
├── profile.example.json    # Your application profile (copy to profile.json)
├── ats-selectors.json      # CSS selectors for 6 ATS systems
├── greenhouse-profile.example.json  # Greenhouse field mappings
├── workday-profile.example.json     # Workday field mappings + learnings
├── standard-answers.json   # Common ATS question answers
└── search-queries.json     # LinkedIn search queries

skills/                     # Claude Code skill files
├── search-jobs/
├── job-filters/
├── tailor-resume/
├── impress-resume/
├── cover-letter/
├── apply-jobs/
└── master-apply/
```

## How the Generic Handler Works

The `GenericHandler` is the secret weapon. When it encounters an unknown ATS form, it:

1. Scans ALL visible `<input>`, `<select>`, `<textarea>` elements
2. Builds a "descriptor" from each field's label, placeholder, name, id, and aria-label
3. Regex-matches descriptors against known patterns (name, email, phone, linkedin, etc.)
4. Auto-fills matching fields from your profile
5. Handles checkboxes (terms/consent) and dropdowns (authorization, demographics)

This means it works on almost any job application form, not just the big ATS platforms.

## Pipeline Status Flow

```
discovered → scraped → resume_tailored → form_started → review_pending → submitted → interview → offer
```

## Safety Features

- **Semi-auto mode**: Pauses for human review before submitting (default)
- **Screenshot checkpoints**: Before and after submission
- **Skip-submit flag**: Fill forms without clicking submit (for testing)
- **Duplicate detection**: Won't apply to the same job twice

## Contributing

PRs welcome. The most impactful contributions:
- New ATS handlers (iCIMS full support, SmartRecruiters, etc.)
- Better keyword extraction for resume tailoring
- Additional search sources (Indeed, Glassdoor)

## License

MIT

## Credits

Built by [@ShipItAndPray](https://x.com/ShipItAndPray) using Claude Code.
