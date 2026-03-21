# Greenhouse ATS — Complete Application Guide

## Overview
Greenhouse is a single-page ATS used by many tech companies. Unlike Workday (multi-step), Greenhouse presents all fields on **one page** and uses standard HTML form elements. Each company's Greenhouse URL is either:
- Hosted: `job-boards.greenhouse.io/{company}/jobs/{jobId}`
- Embedded: Greenhouse form in an iframe inside the company's careers page

## URL Patterns
- Direct board: `https://job-boards.greenhouse.io/{company}/jobs/{jobId}`
- Legacy board: `https://boards.greenhouse.io/{company}/jobs/{jobId}`
- Embedded iframe: Company careers page with `src="...greenhouse.io..."`

## Key Advantage: Greenhouse Autofill
Greenhouse has two native autofill mechanisms — **always use these first**:

### 1. Resume Parse Autofill (Primary)
- Upload resume **before** filling other fields
- Greenhouse parses the PDF/DOCX and attempts to fill: first name, last name, email, phone, location, LinkedIn URL, work history
- Wait 3-5 seconds after upload for parse to complete
- Then verify each field — some may be wrong or empty — and correct/fill as needed

### 2. LinkedIn Autofill Button (Secondary)
- Many Greenhouse forms have an "Autofill with LinkedIn" button at the top
- Selector: `a[data-source="linkedin"]`, or button/link with text "AutoFill with LinkedIn"
- Clicking triggers a LinkedIn OAuth popup — **handle popup separately or skip in headless**
- If LinkedIn autofill popup appears, close it and proceed with manual fill instead
- **Recommendation**: Skip LinkedIn autofill in automation, rely on resume parse + manual fill

## Application Flow

### Step 1: Navigate to Job Page
- Go to the Greenhouse URL
- Wait for `#first_name` to appear (confirms form is loaded)
- If no `#first_name`, check for iframes from `greenhouse.io`
- If still no form, look for an "Apply" button and click it

### Step 2: Autofill — Upload Resume First
- Upload resume to `input[type="file"]#resume` or first `input[type="file"]`
- Wait 3-5 seconds for Greenhouse to parse and autofill fields
- Take screenshot to see what was autofilled

### Step 3: Fill / Verify Personal Info
After resume autofill, verify and fill any remaining personal info:
- `#first_name` — First Name
- `#last_name` — Last Name
- `#email` — Email
- `#phone` — Phone (from config/profile.json phone field)
- `input[name*='linkedin' i]` — LinkedIn URL (from config/profile.json linkedinUrl)
- `input[name*='preferred' i]` — Preferred Name (from config/profile.json preferredName)
- `input[name*='location' i]` or `input[name*='city' i]` — Location

### Step 4: Upload Cover Letter (Optional)
- If `input[type="file"]#cover_letter` exists, upload cover letter PDF
- Some companies require it; many don't have the field

### Step 5: Custom Questions
Greenhouse appends company-specific questions below the standard fields. Common types:

#### Select Dropdowns (native `<select>`)
| Pattern in ID/Name | Answer |
|---|---|
| `authorized`, `authorization` | "Yes" |
| `sponsor` | "Yes" (user requires sponsorship) |
| `veteran` | "I am not a protected veteran" |
| `disability` | "No, I Don't Have a Disability" |
| `gender` | "Male" |
| `race`, `ethnicity` | "Decline To Self Identify" |
| `hear`, `source`, `referral` | "LinkedIn" |
| `country` | "United States" |

#### Text Inputs
| Pattern in Label | Answer |
|---|---|
| `salary`, `compensation` | From config/profile.json salaryExpectation |
| `linkedin` | From config/profile.json linkedinUrl |
| `website`, `portfolio` | From config/profile.json linkedinUrl or portfolioUrl |
| `github`, `gitlab` | From config/profile.json githubUrl or gitlabUrl |
| `location`, `city` | From config/profile.json location |
| `start date`, `available` | `2 weeks` |
| `years of experience` | From config/profile.json yearsOfExperience |
| `preferred name` | From config/profile.json preferredName |

#### Checkboxes
- Any checkbox with "agree", "consent", "acknowledge", "terms" in its label → check it

### Step 6: EEO / Demographic Questions
Greenhouse has a standardized EEO section at the bottom (separate from custom questions):
- **Race**: Various selects — match "Decline to Self Identify" or "Asian"
- **Gender**: "Male"
- **Veteran**: "I am not a protected veteran"
- **Disability**: "No, I don't have a disability"
- These are wrapped in a `fieldset` or `.field` with `[name*="race"]`, `[name*="gender"]` etc.

### Step 7: Review & Screenshot
- Take full-page screenshot before submitting
- Scroll to bottom to verify all fields visible
- Check for any validation errors (red borders, error messages)

### Step 8: Submit
- Submit button: `#submit_app` or `input[type="submit"]` or `button[type="submit"]`
- After click, wait 5+ seconds for submission confirmation
- Confirmation page typically shows "Thank you for your application" or similar
- Take screenshot after submission for records
- Log to `data/tracker.db`

## Technical Notes

### Form Element Types
| Element | How to Handle |
|---|---|
| Standard `<input>` | `.fill(value)` |
| Native `<select>` | `.selectOption({ label: value })` or by value |
| File upload | `.setInputFiles(filePath)` |
| Checkbox | `.check({ force: true })` |
| Radio buttons | `.click()` the target option |
| Textarea | `.fill(value)` |

### Greenhouse Uses Standard HTML
Unlike Workday (custom components), Greenhouse uses **native HTML** elements:
- `<select>` not custom divs
- Standard `<input>` with IDs
- `<label for="id">` associations
- No `data-automation-id` needed

### Wait Times
- Page load: `waitUntil: 'domcontentloaded'` + 3s wait
- After resume upload: 3-5 seconds for parse
- After submit: 5+ seconds for confirmation

### Iframe Handling
Some companies embed Greenhouse in an iframe:
- Check `page.frames()` for any frame with `greenhouse.io` in URL
- Operate on that frame, not main page
- All selectors work the same way within the frame

### Selectors for Standard Fields
```
#first_name              — First Name
#last_name               — Last Name
#email                   — Email
#phone                   — Phone
input[name*='linkedin' i] — LinkedIn URL
input[id*='preferred' i]  — Preferred Name
#resume                  — Resume file input
#cover_letter            — Cover letter file input
#submit_app              — Submit button
```

## Error Handling
- If `#first_name` not found → check for iframe, then click Apply button
- If resume upload fails → try `input[type="file"]` (first file input fallback)
- If select option not found → try partial match on option text
- Validation errors appear as red borders or `.error` class divs

## Company-Specific Learnings

### Pair Team (pairteam)
- URL: `https://job-boards.greenhouse.io/pairteam/jobs/{jobId}`
- Has preferred name field: `input[name*='preferred' i]`
- Has GitHub field: `input[name*='github' i]`
- Standard EEO section present

*(Add more companies as you encounter them)*

## Embed Form Approach (Preferred for Automation)

### Why Embed Forms
The **embed form** is the most reliable automation approach because:
- It's a plain HTML `<form>` with standard POST — no JavaScript SPA
- No API key needed (unlike the Greenhouse POST API which requires the company's private key)
- Same form structure across ALL Greenhouse companies
- Anti-bot fields are populated by the browser naturally

### Embed Form URL Pattern
```
https://boards.greenhouse.io/embed/job_app?for={company-slug}&token={jobId}
```
Example: `https://boards.greenhouse.io/embed/job_app?for=sofi&token=7581360003`

### Form POST Action
```
POST https://boards.greenhouse.io/embed/{company-slug}/jobs/{jobId}
Content-Type: multipart/form-data
```

### Field Naming Convention
All form fields follow this naming pattern:
```
# Standard fields
job_application[first_name]
job_application[last_name]
job_application[email]
job_application[phone]

# Custom questions (N = 0-based index)
job_application[answers_attributes][N][question_id]          — hidden, auto-populated
job_application[answers_attributes][N][text_value]            — for text inputs
job_application[answers_attributes][N][boolean_value]         — for Yes/No selects (1=Yes, 0=No)
job_application[answers_attributes][N][answer_selected_options_attributes][M][question_option_id] — for option selects/checkboxes

# Demographic/EEO (optional)
job_application[demographic_answers][][question_id]
job_application[demographic_answers][][answer_id]
```

### Boolean Value Mapping
Greenhouse boolean selects use numeric values:
- `1` = Yes
- `0` = No
- The `<select>` element name contains `boolean_value`

### Option ID Structure
For non-boolean selects (like Country), options have company-specific numeric IDs:
```html
<option value="152162632003">United States of America</option>
<option value="152162633003">Argentina</option>
```
Match by option text, not by value.

### Anti-Bot Fields
The embed form includes these hidden/auto-populated fields:
- `fingerprint` — browser fingerprint hash
- `render_date` — when the form was rendered (ISO timestamp)
- `page_load_time` — milliseconds from page load to submission
- `security_code` — server-generated token
- `dev_field_1` — honeypot field (leave empty!)

**Strategy**: Use Playwright to load the real page (these fields auto-populate via JS), fill the form, then let the user click Submit manually. This naturally handles all anti-bot measures.

### Form Filler Script
Use `scripts/fill-greenhouse-form.cjs` for automation:
```bash
npx -y node@20 scripts/fill-greenhouse-form.cjs <company-slug> <job-id> <resume-pdf> [cover-letter-pdf]
```

The script:
1. Opens the embed form URL in a real browser
2. Fills standard fields (#first_name, #last_name, #email, #phone)
3. Uploads resume (first `input[type="file"]`), waits 4s for parse
4. Uploads cover letter (second `input[type="file"]`)
5. Fills LinkedIn/Website by matching label text
6. Iterates all `.field` containers to fill custom questions:
   - Matches label text against regex patterns in ANSWER_MAP
   - Handles text inputs, boolean selects, option selects, checkboxes
7. Keeps browser open for user to review and click Submit

### Greenhouse APIs (Reference)

#### Public Jobs API (no auth)
```
GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
```
Returns all jobs with full descriptions.

#### Questions API (no auth)
```
GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{id}?questions=true
```
Returns form fields with types, options, required status.

#### Application POST API (requires company API key — NOT usable)
```
POST https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{id}
Authorization: Basic {company-api-key}
```
We don't have company API keys, so use the embed form approach instead.

## Company-Specific Learnings

### SoFi
- Slug: `sofi`
- 32 Java+Spring jobs found (as of Feb 2026)
- Custom questions include: work authorization, sponsorship, commute, SoFi/Galileo employee status, FINRA licenses, SMS consent, home address, preferred name
- Country select has company-specific option IDs (not standard country codes)
- FINRA license question may appear as both select and checkbox depending on the role
- Boolean selects: Sponsorship=Yes(1), Authorization=Yes(1), Commute=Yes(1), SoFi employee=No(0)

### Pair Team (pairteam)
- URL: `https://job-boards.greenhouse.io/pairteam/jobs/{jobId}`
- Has preferred name field: `input[name*='preferred' i]`
- Has GitHub field: `input[name*='github' i]`
- Standard EEO section present

*(Add more companies as you encounter them)*

## Credentials
Greenhouse does **not** require account creation — applications are submitted as a guest with email + resume. No credential storage needed.

## Tracker Fields
When logging to `data/tracker.db`:
```sql
INSERT INTO applications (job_id, company, title, ats, url, status, applied_at, resume_path, cover_letter_path, screenshot_path)
VALUES (?, ?, ?, 'greenhouse', ?, 'submitted', datetime('now'), ?, ?, ?)
```
