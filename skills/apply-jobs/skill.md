---
name: apply-jobs
description: Apply to jobs using Playwright MCP browser automation. Use when the user says "apply to jobs", "start applying", "submit application", "fill this form", or "batch apply". Works with Greenhouse, Lever, Workday, and any ATS.
---

# Apply to Jobs — Parallel Greenhouse Pipeline

Automated job application pipeline using Playwright MCP browsers.

## Quick Start

```bash
node scripts/next-job.cjs --list             # See pending jobs (with full dedup)
node scripts/next-job.cjs agent-N            # Claim next job (atomic, deduped)
node scripts/progress-update.cjs JOB_ID submitted  # Mark done
node scripts/next-job.cjs --reset-stale      # Reset stuck in_progress jobs
```

## MANDATORY: Deduplication Before Every Claim

**NEVER pick a job manually from progress.json.** ALWAYS use `next-job.cjs` which:
1. Checks `data/jobs/progress.json` (submitted + in_progress companies)
2. Checks `data/applications-log.json`
3. Atomically claims the job (prevents race conditions between parallel agents)

```bash
# Correct way to claim a job:
node scripts/next-job.cjs agent-1
# Returns JSON with jobId, company, title, url — use these values
```

If `next-job.cjs` returns nothing → no jobs available, stop.

## Architecture

- **10 headless browsers**: `playwright-1` through `playwright-10` (headless, isolated)
- **1 headed browser**: `playwright` (no number) — for email security codes
- **Progress tracker**: `data/jobs/progress.json` — single source of truth
- **Atomic locks**: `data/jobs/locks/{jobId}.lock` — prevents duplicate claims

## Parallel Application Flow (10 agents)

### CRITICAL: Submit As You Go
**Do NOT wait for all 10 agents to finish filling before submitting.** As each agent completes form filling:
1. Immediately click Submit on that form
2. Check email for its security code
3. Enter the code and confirm submission
4. Update progress.json
5. Claim the next job for that agent

This maximizes throughput and avoids security code expiry (codes expire in ~10 minutes).

### Phase 1: Claim & Navigate (all 10 in parallel)
For each agent `playwright-N`:
1. `node scripts/progress-claim.cjs agent-N` → get next pending job
2. Navigate to job URL in `playwright-N`
3. Wait for page load

### Phase 2: Fill Forms (all 10 in parallel)
Each agent fills its form using profile data from `config/profile.json`:
- **Greenhouse (job-boards.greenhouse.io)**: Use `page.evaluate()` for same-origin forms
- **Greenhouse (embedded iframe)**: Use accessibility refs (`browser_type`, `browser_click`) — can't use `page.evaluate()` cross-origin
- **Lever**: Vision-based — screenshot + click coordinates
- **Workday**: Use `config/workday-profile.json`, `data-automation-id` selectors

### Phase 3: Security Codes — THE CRITICAL WORKFLOW

**Greenhouse requires email verification codes. Codes expire in ~10 minutes. Speed is everything.**

#### Step-by-step for each form:
1. **Fill form completely** — all fields, resume upload, demographics, EEO
2. **Click Submit** — this triggers Greenhouse to email a security code
3. **Immediately check the verification email inbox**
4. **Extract the code** — match by company name + most recent timestamp
5. **Enter the code** in the form:
   - **8-box pattern**: Set each `#security-input-0` through `#security-input-7` using native value setter + input/change events
   - **Single textbox**: Set `#security_code` with native value setter
   - **Cross-origin iframe**: Use Playwright MCP `browser_type` with `slowly: true` on the first textbox ref
6. **Click Submit again** — verify "Thank you" confirmation page
7. **Update progress**: `node scripts/progress-update.cjs JOB_ID submitted`

#### Code entry patterns:

**Same-origin 8-box:**
```javascript
const code = 'ABCD1234';
for (let i = 0; i < 8; i++) {
  const el = document.getElementById('security-input-' + i);
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  nativeSetter.call(el, code[i]);
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.dispatchEvent(new Event('change', {bubbles: true}));
}
```

**Same-origin single input:**
```javascript
const input = document.querySelector('#security_code');
const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
nativeSetter.call(input, 'ABCD1234');
input.dispatchEvent(new Event('input', {bubbles: true}));
input.dispatchEvent(new Event('change', {bubbles: true}));
```

**Cross-origin iframe:**
```
// Use Playwright MCP accessibility ref for first security input box
browser_type(ref='<first-box-ref>', text='ABCD1234', slowly=true)
// Auto-distributes across all 8 boxes
```

#### Critical rules:
- **Enter codes within 5 minutes of receiving them** — they expire fast
- **One code per form** — don't reuse codes across forms
- **If code is invalid**: The form's submit button gets disabled. Must reload the page and re-fill the form to get a fresh code
- **Don't batch codes** — process each form's code immediately after clicking submit

### Phase 4: Track Results
```bash
node scripts/progress-update.cjs JOB_ID submitted   # Success
node scripts/progress-update.cjs JOB_ID failed "reason"  # Failure
node scripts/progress-status.cjs  # Dashboard
```

### Screenshot Storage — MANDATORY
**ALL screenshots must be saved inside the job's resume folder or data/screenshots/.**

```
Pre-submit screenshot:  data/resumes/{company}-{jobId}/form-before-submit.png
Confirmation screenshot: data/resumes/{company}-{jobId}/confirmation.png
General screenshots:     data/screenshots/{company}-{jobId}-{description}.png
```

## Form Filling — Key Knowledge

### Greenhouse (job-boards.greenhouse.io / boards.greenhouse.io)
- **Phone Country**: MUST select country code (e.g. "United States +1") from the combobox dropdown before submitting. Missing this causes validation error and wasted time. Type "United States" slowly, wait for dropdown, click the option.
- **Select2 dropdowns**: Use `selectOption(value, { force: true })` — hidden native selects
- **Boolean selects**: `name` contains `boolean_value`, value `"1"` = Yes, `"0"` = No
- **Location autocomplete**: `#location_autocomplete_root input`, type slowly, wait 2.5-3.5s, click first `li`
- **Anti-bot**: Use gaussian delays, variable typing speed — never fill too fast
- **Resume**: DOCX only
- **"Male"/"Female"**: Exact match first, then startsWith, then includes with `!startsWith('fe')` guard

### Lever
- Vision-based: screenshot → read visually → click/type by coordinates
- Launch with `--force-device-scale-factor=1` to prevent Retina 2x mismatch
- One action at a time — screenshot after every click/type
- Radio buttons: click the text label, not the tiny circle

### Workday
- Uses `data-automation-id` attributes for all elements
- "Create Account" / "Sign In" buttons need `{ force: true }` click
- SPA — use `domcontentloaded` + `waitForTimeout(5000-8000)`, NOT `networkidle`
- Dropdowns: click `button[aria-haspopup='listbox']`, then `[role='option']`

## Key Files
- Profile: `config/profile.json`
- Standard answers: `config/standard-answers.json`
- Workday profile: `config/workday-profile.json`
- Greenhouse profile: `config/greenhouse-profile.json`
- Resume base: `templates/resume-base.txt` / `templates/resume-base.docx`
- Progress: `data/jobs/progress.json`
- Tracker DB: `data/tracker.db`

## Rules
- Track EVERY application in progress.json via progress-update.cjs
- Cover letters: impressive and professional, NEVER aggressive
- Sponsorship: answer truthfully per your profile
- Fill ALL fields — never leave blanks
- Don't re-login — keep browser sessions alive
- Stay within current tier — don't mix tiers in a batch
- After each batch: check learnings, update approach
