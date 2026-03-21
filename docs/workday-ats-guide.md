# Workday ATS — Complete Application Guide

## Overview
Workday is the most common ATS for Fortune 500 companies. Each company has its own Workday tenant (e.g., `dickssportinggoods.wd1.myworkdayjobs.com`). Each tenant requires a **separate account** (email + password).

## URL Patterns
- Job listing: `{company}.wd{N}.myworkdayjobs.com/{site}/job/{path}/{title}_{reqId}`
- Apply page: `.../{title}_{reqId}/apply`
- Manual apply: `.../{title}_{reqId}/apply/applyManually`
- Login: `.../{site}/login?redirect=...`

## Application Flow (6 Steps)

### Step 1: Create Account / Sign In
- **Fields**: Email, Password, Verify Password, "I Agree" checkbox
- **Automation IDs**: `email`, `password`, `verifyPassword`, `createAccountCheckbox`, `createAccountSubmitButton`
- **CRITICAL**: The submit button has a `click_filter` overlay div that intercepts clicks. Must click `[data-automation-id="click_filter"]` with `{ force: true }` or use JavaScript click.
- **IMPORTANT**: After account creation, Workday sends a **verification email**. User must click the link before sign-in works.
- **Sign-in fields**: `email`, `password`, `signInSubmitButton`
- **Existing account detection**: Check for "already exists" or "already registered" text, then switch to sign-in flow.

### Step 2: My Information
- **Common fields**:
  - `legalNameSection_firstName` — First Name
  - `legalNameSection_lastName` — Last Name
  - `addressSection_countryRegion` — Country dropdown
  - `addressSection_addressLine1` — Street Address
  - `addressSection_city` — City
  - `addressSection_region` — State dropdown
  - `addressSection_postalCode` — Zip Code
  - `phone-device-type` — Phone Type dropdown (Mobile/Home)
  - `phone-number` — Phone Number
- **Navigation**: `bottom-navigation-next-button`

### Step 3: My Experience
- **Resume upload**: Look for `input[type="file"]` or `[data-automation-id="file-upload-drop-zone"]`
- Resume formats accepted: PDF, DOCX
- **IMPORTANT — Resume dedup**: Before uploading, check if a resume is already attached (look for existing file entries). If one exists, delete it first, then upload the latest. Never leave duplicate resumes.
- After upload, Workday may auto-parse fields (work history, education)
- **Work experience fields**: `jobTitle`, `company`, `startDate`, `endDate`, `currentlyWorkHere`, `description`
  - ALWAYS fill out work experience from profile.json workHistory — don't leave as "No Response"
- **Education fields**: `school`, `degree`, `field-of-study`, `gpa`
  - ALWAYS fill out education from profile.json education — don't leave as "No Response"
- **Skills**: Fill out skills section from profile.json primarySkills + secondarySkills
- **Social Network URLs / LinkedIn URL**: Fill from `config/profile.json` linkedinUrl field
  - If there are additional social URL fields, add portfolio/award URLs from profile.json
- **Navigation**: `bottom-navigation-next-button`

### Step 4: Application Questions
- These vary per company but common ones include:
  - **Authorization to work**: "Are you authorized to work in the US?" → YES
  - **Sponsorship**: "Do you now or in the future require sponsorship?" → NO
  - **Salary expectations**: Use range from profile ($180K-$250K) BUT for lower-level roles, be flexible
  - **How did you hear**: "LinkedIn" or "Job Board"
  - **Start date**: "Immediately" or "2 weeks notice"
  - **Willing to relocate**: YES (if remote/flexible)
  - **Background check**: "Yes, I consent"
  - **Non-compete**: "No, I am not bound by a non-compete"
  - **Previous application**: Usually "No" unless you've applied before
  - **Criminal history**: "No" if applicable
  - **Age verification**: "Yes, I am 18 or older"

#### IMPORTANT: Answer Strategy
- Sponsorship: YES — user requires sponsorship. Always answer truthfully.
- ALWAYS say authorized to work in US
- For salary questions: give range that overlaps with their posted range
- For "years of experience" dropdowns: select the highest applicable bracket (14+ years)
- For clearance questions: "No" unless you have one — don't lie
- For relocation: "Yes" for remote roles

### Step 5: Voluntary Disclosures (EEO/OFCCP)
- **Veteran status**: "I am not a protected veteran"
- **Disability**: "No, I do not have a disability"
- **Gender**: Read from `config/profile.json` demographics section
- **Hispanic/Latino**: Read from `config/profile.json` demographics section
- **Race/Ethnicity**: Read from `config/profile.json` demographics section (exact option varies — look for matching text in the dropdown)
- **Arbitration checkbox**: Must check `#termsAndConditions--acceptTermsAndAgreements` — this resets each session
- **Gender**: Decline to self-identify (optional)
- **Race/Ethnicity**: Decline to self-identify (optional)
- These are legally required to be optional and cannot affect hiring decisions

### Step 6: Review & Submit
- Review all entered information
- Take screenshot BEFORE submitting
- Click submit button: `[data-automation-id="submitButton"]` or similar
- Take screenshot AFTER submitting for records

## Technical Notes

### Playwright Configuration
- Use `headless: false` — some Workday tenants block headless browsers
- Set realistic user agent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...`
- Use `waitUntil: 'domcontentloaded'` NOT `networkidle` — Workday SPA never truly goes idle
- Add `waitForTimeout(5000-8000)` after navigation for SPA rendering
- All form elements use `data-automation-id` attribute for selection

### Dropdown Handling
- Workday dropdowns are NOT native `<select>` elements
- They are custom div-based components
- To select: Click the dropdown → Type to filter → Press Enter or click the option
- Or use: `page.click('[data-automation-id="dropdownId"]')` → `page.keyboard.type('value')` → `page.keyboard.press('Enter')`

### File Upload
- Workday file uploads use a drop zone with a hidden `input[type="file"]`
- Use `fileInput.setInputFiles(filePath)` to upload
- Wait 5+ seconds after upload for parsing

### Error Recovery
- If form validation fails, Workday shows inline error messages
- Look for `[data-automation-id="errorMessage"]` or elements with `aria-invalid="true"`
- Required fields have `*` in their label text

### Credential Storage
- Store credentials in `data/credentials/workday-accounts.json`
- Each Workday tenant requires its own account
- Use a consistent strong password pattern across tenants (store in `data/credentials/workday-accounts.json`)
- Track account status: `pending_email_verification`, `verified`, `active`
