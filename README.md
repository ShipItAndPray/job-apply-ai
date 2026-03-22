# job-apply-ai

AI-powered job application pipeline. Search jobs, tailor resumes, auto-fill ATS forms — all driven by Claude Code + Playwright MCP.

## How It Works

```
1. PULL     →  Scripts fetch 19K+ jobs from 929 Greenhouse companies
2. FILTER   →  Scripts filter down to matching engineering roles
3. TAILOR   →  Claude Code reads the JD, tailors your resume + cover letter
4. APPLY    →  Claude Code opens the form via Playwright MCP, fills it visually, you review + submit
5. TRACK    →  Every application logged with screenshots and documents
```

**The AI does the hard part.** Claude Code sees the actual form, reads labels, handles dropdowns, uploads your resume, and fills custom questions — no brittle CSS selectors. Scripts handle the mechanical parts (pulling job listings, filtering by title).

## Two Ways to Use This

### 1. Claude Code + Playwright MCP (Recommended)

This is the primary approach. Claude Code acts as your job application agent — it reads job descriptions, tailors your resume, opens the browser via Playwright MCP, visually fills every form field, and pauses for you to review before submitting.

```bash
# Setup
git clone https://github.com/ShipItAndPray/job-apply-ai.git
cd job-apply-ai
npm install && npx playwright install chromium
cp config/profile.example.json config/profile.json   # edit with YOUR info

# Copy skills into Claude Code
cp -r skills/* ~/.claude/skills/

# Then just talk to Claude Code:
claude "search for senior backend engineer jobs on greenhouse"
claude "tailor my resume for this Stripe backend engineer role"
claude "apply to this job"           # Claude opens browser, fills form, you review
claude "run the full pipeline"       # end-to-end: search → filter → tailor → apply
```

**Why this is better than scripts:**
- Claude **sees** the form visually — handles any layout, not just known selectors
- Claude **reads** custom questions and answers them intelligently from your profile
- Claude **adapts** when forms have unusual fields, iframes, or multi-step flows
- Claude **verifies** via screenshot before you submit — catches errors scripts miss
- Works on **any ATS**, not just Greenhouse/Lever/Workday

### 2. Scripts (For Batch Operations)

Scripts handle the parts that don't need AI — pulling thousands of job listings and filtering them by keywords.

```bash
# Pull jobs from 929 Greenhouse companies (last 7 days)
npm run pull                    # 19K+ jobs in ~3 minutes

# Filter to engineering roles
npm run filter                  # 19K → ~2,500 matching jobs

# Or do both at once
npm run pipeline                # pull + filter

# Apply with the script (simpler forms only, dry-run by default)
npm run apply                   # fills form, keeps browser open for review
npm run apply:submit            # actually submits

# Apply to a specific job URL
node scripts/greenhouse-apply.cjs --url "https://boards.greenhouse.io/stripe/jobs/123" --dry-run
```

## Supported ATS Systems

| ATS | Auto-Detect | Claude Code | Script | Status |
|-----|------------|-------------|--------|--------|
| Greenhouse | URL + DOM | Any form | Full auto-fill | Production |
| Lever | URL + DOM | Any form | Full auto-fill | Production |
| Workday | URL + DOM | Any form | Partial | Beta |
| iCIMS | URL | Any form | Generic | Beta |
| SmartRecruiters | URL | Any form | Generic | Beta |
| Ashby | URL + DOM | Any form | Generic | Beta |
| Any other | Fallback | **Still works** | Best-effort | — |

Claude Code + Playwright MCP works on **any** ATS because it reads the form visually. Scripts only work reliably on Greenhouse and Lever.

## Setup

### Prerequisites
- Node.js 20+
- [Claude Code CLI](https://claude.ai/claude-code) (for AI-powered features)
- Playwright MCP configured in Claude Code

### Install

```bash
git clone https://github.com/ShipItAndPray/job-apply-ai.git
cd job-apply-ai
npm install
npx playwright install chromium
```

### Configure Your Profile

```bash
cp config/profile.example.json config/profile.json
```

Edit `config/profile.json` with your real information:
- Name, email, phone, LinkedIn URL
- Work history, education, skills
- Authorization status (sponsorship, work authorization)
- Resume file path
- Desired salary, job preferences

### Configure Claude Code

Add Playwright MCP to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

Copy the skills:

```bash
cp -r skills/* ~/.claude/skills/
```

## What Each Skill Does

| Skill | Trigger | What Claude Does |
|-------|---------|-----------------|
| `search-jobs` | "search jobs", "find jobs" | Pulls from Greenhouse/Lever APIs, groups by company |
| `job-filters` | "filter jobs", "clean jobs" | LLM reads each JD, removes bad matches intelligently |
| `tailor-resume` | "tailor resume for X" | Extracts JD keywords, optimizes resume for ATS |
| `impress-resume` | "impressive resume for X" | Deep JD research, rewrites bullets to match, sounds human |
| `cover-letter` | "cover letter for X" | Job-specific cover letter with proof points |
| `apply-jobs` | "apply to this job" | Opens Playwright browser, fills form, screenshots, submits |
| `master-apply` | "run the pipeline" | Orchestrates all skills end-to-end |

## Architecture

```
scripts/                        # Batch automation (no AI needed)
├── greenhouse-pull.cjs         # Pull jobs from 929 companies
├── greenhouse-filter.cjs       # Filter by title keywords
└── greenhouse-apply.cjs        # Auto-fill forms (simple cases)

skills/                         # Claude Code skills (AI-powered)
├── search-jobs/                # Job discovery
├── job-filters/                # Intelligent filtering
├── tailor-resume/              # Resume optimization
├── impress-resume/             # Deep resume tailoring
├── cover-letter/               # Cover letter generation
├── apply-jobs/                 # Form filling via Playwright MCP
└── master-apply/               # Full pipeline orchestration

src/                            # TypeScript library
├── ats/                        # ATS detection + form handlers
│   ├── base-handler.ts         # Abstract base (safe fill/click/upload)
│   ├── detector.ts             # URL + DOM ATS detection (6 systems)
│   ├── greenhouse.ts           # Greenhouse handler
│   ├── lever.ts                # Lever handler
│   └── generic.ts              # Fallback: regex-matches ANY form field
├── pipeline/orchestrator.ts    # 5-step pipeline with review checkpoints
├── scraper/job-detail-scraper.ts
├── search/job-searcher.ts
├── tailor/resume-tailor.ts     # Keyword extraction + match scoring
├── tracker/application-tracker.ts  # SQLite tracker
└── utils/state.ts

config/
├── profile.example.json        # Your profile (copy to profile.json)
├── greenhouse-companies.json   # 929 company board slugs
├── ats-selectors.json          # CSS selectors for 6 ATS systems
├── greenhouse-profile.example.json
├── workday-profile.example.json
├── standard-answers.json       # Common ATS question answers
└── search-queries.json         # Search queries (customize these)
```

## How the Generic Handler Works

When Claude Code or the script encounters an unknown form, the `GenericHandler`:

1. Scans ALL visible `<input>`, `<select>`, `<textarea>` elements
2. Builds a descriptor from each field's label, placeholder, name, id, and aria-label
3. Regex-matches descriptors against known patterns (name, email, phone, etc.)
4. Auto-fills matching fields from your profile
5. Handles checkboxes (terms/consent) and dropdowns (authorization, demographics)

This means it works on almost any job application form, not just the big ATS platforms.

## Safety

- **Dry-run by default** — scripts fill forms but don't submit unless you pass `--submit`
- **Screenshot checkpoints** — before and after every submission
- **Semi-auto mode** — Claude Code always pauses for your review before clicking submit
- **Duplicate detection** — won't apply to the same job twice
- **Visual verification** — Claude sees the filled form and checks for errors before submitting

## Pipeline Status Flow

```
discovered → scraped → resume_tailored → form_started → review_pending → submitted → interview → offer
```

## Contributing

PRs welcome. High-impact contributions:
- New ATS handlers (iCIMS, SmartRecruiters full support)
- Better keyword extraction for resume tailoring
- Additional job sources (Indeed, Glassdoor, Ashby)
- More Greenhouse company slugs

## License

MIT

## Credits

Built by [@ShipItAndPray](https://x.com/ShipItAndPray) using Claude Code.
