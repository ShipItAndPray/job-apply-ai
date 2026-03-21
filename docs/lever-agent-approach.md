# Lever Agent Form Filler — Architecture & Approach

## Problem
Hardcoded scripts with CSS selectors break on every new form. Regex pattern matching can't handle context-specific questions. No visual validation means silent failures.

## Solution: Claude Vision Controls Everything

The LLM is the brain. Playwright is the hands. **No DOM parsing assumptions. No hardcoded selectors.**

### Core Loop
```
1. Navigate to Lever apply page
2. Upload resume (Lever auto-parses some fields)
3. LOOP:
   a. Screenshot the full page
   b. Send screenshot + accessibility tree + field dump to Claude Vision
   c. Claude returns JSON with actions: fill, select, click, radio, check, upload
   d. Script executes actions using semantic Playwright locators (getByLabel, by name, by text)
   e. Screenshot again → Claude checks for more fields / errors
   f. When Claude says "ready" → move to verification phase
4. VERIFY: Screenshot → Claude Vision checks: all filled? errors? correct data?
5. FIX: If issues → Claude provides fix actions → execute → re-verify (max 3 rounds)
6. SUBMIT: Click submit → screenshot → Claude verifies success
```

### Key Design Decisions

1. **Claude Vision reads the form visually** — not DOM parsing. Works on ANY HTML structure.
2. **Accessibility tree + field dump sent as context** — gives Claude name/id attributes for targeting.
3. **Multi-strategy element finding**: name attr → id → getByLabel → getByPlaceholder → aria-label → text proximity → CSS selector. If one fails, next one tries.
4. **Multi-turn conversation** — Claude sees history of what it already did. Avoids re-filling.
5. **Claude generates ALL fill actions at once** — not one field at a time. Efficient.
6. **Visual verification is mandatory** — catches anything the DOM approach would miss.
7. **Max 30 steps safety limit** — prevents infinite loops.
8. **Human-like delays** — random 200-600ms between actions, longer "thinking" pauses.

### Phases
- `fill` — Claude identifies empty fields and tells us what to fill
- `verify` — Claude visually checks the completed form
- `post_submit` — Claude verifies submission success

### Element Finding Strategies (in order)
1. `[name="..."]` — most reliable for form fields
2. `#id` — by element ID
3. `getByLabel(text)` — Playwright semantic locator
4. `getByPlaceholder(text)` — fallback
5. `getByRole(role, {name})` — ARIA role
6. `[aria-label*="..."]` — accessible label
7. Text proximity — find label text, walk up DOM to nearest input
8. CSS selector — last resort

### Radio Button Finding
1. By name + value attributes
2. By name, then match label text
3. By group label text in container, then option text
4. By any radio with matching label text (broadest)

### Files
- **Script**: `scripts/lever-agent-fill.cjs`
- **Job list**: `data/jobs/lever-jobs.json` (from scan-lever3.cjs)
- **Results**: `data/jobs/lever-applications/{slug}/`
  - `job-info.json` — job metadata
  - `step-{NN}.png` — screenshot at each step
  - `step-{NN}-{phase}.json` — Claude's response at each step
  - `result.json` — final result (success/fail, actions taken, errors)
- **Resume**: First DOCX found in `data/jobs/apply-tier2/*/resume.docx`

### Profile Data
All applicant data is loaded from `config/profile.json`. Claude knows:
- Personal info (name, email, phone, location, LinkedIn, GitHub)
- Work history (from profile)
- Education (from profile)
- Demographics (from profile)
- Standard answers (from `config/standard-answers.json`)
- Cover letter style instructions

### Cost
- ~3-5 Claude Sonnet calls per job (fill + verify + possible fix)
- ~$0.05-0.10 per job with screenshots
- 62 jobs = ~$3-6 total

### Running
```bash
cd /path/to/job-apply-ai

# Test on first 3 jobs (no submit)
node scripts/lever-agent-fill.cjs

# Test specific URL
node scripts/lever-agent-fill.cjs --url https://jobs.lever.co/whoop/516fa6c8-6f45-415f-acda-e5ad5336aca5/apply

# Submit mode with offset/limit
node scripts/lever-agent-fill.cjs --submit --offset 0 --limit 10
```

### Generating Job List
```bash
cd /private/tmp && node scan-lever3.cjs  # prints to stdout
# Save structured JSON to lever-jobs.json (need modified script that outputs JSON)
```
