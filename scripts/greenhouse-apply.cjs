#!/usr/bin/env node
/**
 * Apply to Greenhouse jobs using Playwright browser automation.
 *
 * Usage:
 *   node scripts/greenhouse-apply.cjs                           # Apply to first job in filtered list
 *   node scripts/greenhouse-apply.cjs --url <greenhouse-url>    # Apply to specific job URL
 *   node scripts/greenhouse-apply.cjs --limit 5                 # Apply to first 5 jobs
 *   node scripts/greenhouse-apply.cjs --dry-run                 # Fill form but don't submit
 *
 * Reads profile from config/profile.json
 * Reads jobs from data/jobs/greenhouse-filtered.json
 * Logs results to data/applications-log.json
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const PROFILE_PATH = path.join(BASE, 'config', 'profile.json');
const FILTERED_PATH = path.join(BASE, 'data', 'jobs', 'greenhouse-filtered.json');
const LOG_PATH = path.join(BASE, 'data', 'applications-log.json');
const SCREENSHOTS_DIR = path.join(BASE, 'data', 'screenshots');

// Parse args
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}
const SPECIFIC_URL = getArg('--url');
const LIMIT = parseInt(getArg('--limit') || '1', 10);
const DRY_RUN = args.includes('--dry-run');

// Load profile
if (!fs.existsSync(PROFILE_PATH)) {
  console.error(`Missing ${PROFILE_PATH}. Copy profile.example.json and fill in your details.`);
  process.exit(1);
}
const profile = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8'));

// Ensure dirs
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(LOG_PATH))) fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });

// Load application log
function loadLog() {
  if (fs.existsSync(LOG_PATH)) return JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  return [];
}
function saveLog(log) {
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

// Safe helpers
async function safeFill(page, selector, value) {
  try {
    const el = page.locator(selector).first();
    if (await el.count() === 0) return false;
    await el.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await el.click({ timeout: 3000 });
    await el.fill(value, { timeout: 5000 });
    return true;
  } catch { return false; }
}

async function safeSelect(page, selector, value) {
  try {
    const el = page.locator(selector).first();
    if (await el.count() === 0) return false;
    await el.selectOption(value, { timeout: 5000 });
    return true;
  } catch {
    try {
      const el = page.locator(selector).first();
      await el.selectOption({ label: value }, { timeout: 5000 });
      return true;
    } catch { return false; }
  }
}

async function safeUpload(page, selector, filePath) {
  try {
    const el = page.locator(selector).first();
    if (await el.count() === 0) return false;
    await el.setInputFiles(filePath, { timeout: 10000 });
    return true;
  } catch { return false; }
}

// Greenhouse form filler
async function fillGreenhouseForm(page, profile) {
  const p = profile.personal;
  const auth = profile.authorization;
  const exp = profile.experience;

  console.log('  Filling personal info...');
  await safeFill(page, '#first_name', p.firstName);
  await safeFill(page, '#last_name', p.lastName);
  await safeFill(page, '#email', p.email);
  await safeFill(page, '#phone', p.phone);
  await safeFill(page, "input[name*='linkedin' i]", p.linkedIn);
  await safeFill(page, "input[name*='location' i], input[name*='city' i]", `${p.location.city}, ${p.location.state}`);
  await safeFill(page, "input[name*='github' i]", p.github || '');
  await safeFill(page, "input[name*='website' i]", p.website || p.linkedIn);

  // Resume upload
  console.log('  Uploading resume...');
  const resumePath = resolveResumePath(profile);
  if (resumePath) {
    const uploaded = await safeUpload(page, "input[type='file']#resume", resumePath)
      || await safeUpload(page, "input[type='file'][name*='resume' i]", resumePath)
      || await safeUpload(page, "input[type='file']", resumePath);
    if (uploaded) {
      console.log(`  ✅ Resume uploaded: ${path.basename(resumePath)}`);
      await page.waitForTimeout(3000); // wait for Greenhouse to parse
    } else {
      console.log('  ⚠️  Could not find resume upload field');
    }
  }

  // Cover letter upload
  const coverPath = resolveCoverLetterPath(profile);
  if (coverPath) {
    const uploaded = await safeUpload(page, "input[type='file']#cover_letter", coverPath)
      || await safeUpload(page, "input[type='file'][name*='cover' i]", coverPath);
    if (uploaded) console.log('  ✅ Cover letter uploaded');
  }

  // Custom questions — authorization
  console.log('  Filling custom questions...');
  const authVal = auth.authorizedToWork ? 'Yes' : 'No';
  const sponsorVal = auth.requiresSponsorship ? 'Yes' : 'No';
  await safeSelect(page, "select[name*='authorized' i]", authVal);
  await safeSelect(page, "select[name*='authorization' i]", authVal);
  await safeSelect(page, "select[name*='sponsor' i]", sponsorVal);

  // Salary
  await safeFill(page, "input[name*='salary' i]", String(exp.desiredSalary?.min || ''));

  // Years of experience
  await safeFill(page, "input[name*='years' i][name*='experience' i]", String(exp.totalYears));
  await safeSelect(page, "select[name*='years' i]", String(exp.totalYears));

  // Demographics (voluntary)
  const demo = profile.demographics || {};
  if (demo.veteranStatus) await safeSelect(page, "select[name*='veteran' i]", demo.veteranStatus);
  if (demo.disabilityStatus) await safeSelect(page, "select[name*='disability' i]", demo.disabilityStatus);
  if (demo.gender) await safeSelect(page, "select[name*='gender' i]", demo.gender);

  // Check consent/terms checkboxes
  const checkboxes = page.locator("input[type='checkbox']");
  const cbCount = await checkboxes.count();
  for (let i = 0; i < cbCount; i++) {
    const cb = checkboxes.nth(i);
    try {
      if (!(await cb.isVisible())) continue;
      if (await cb.isChecked()) continue;
      const id = await cb.getAttribute('id') || '';
      const name = await cb.getAttribute('name') || '';
      if (/terms|acknowledge|agree|consent|confirm/i.test(`${id} ${name}`)) {
        await cb.check({ timeout: 3000 });
      }
    } catch {}
  }

  console.log('  ✅ Form filling complete');
}

function resolveResumePath(profile) {
  const base = profile.documents?.resumeBasePath;
  if (!base) return null;

  // Try different formats
  const formats = profile.documents?.resumeFormats || ['pdf', 'docx', 'txt'];
  for (const fmt of formats) {
    const p = base.endsWith(`.${fmt}`) ? base : `${base}.${fmt}`;
    const resolved = path.isAbsolute(p) ? p : path.join(BASE, p);
    if (fs.existsSync(resolved)) return resolved;
  }

  // Try the base path as-is
  const resolved = path.isAbsolute(base) ? base : path.join(BASE, base);
  if (fs.existsSync(resolved)) return resolved;

  console.log(`  ⚠️  Resume not found at ${base}`);
  return null;
}

function resolveCoverLetterPath(profile) {
  const p = profile.documents?.coverLetterBase;
  if (!p) return null;
  const resolved = path.isAbsolute(p) ? p : path.join(BASE, p);
  return fs.existsSync(resolved) ? resolved : null;
}

// Main apply function
async function applyToJob(url, profile, dryRun) {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();
  const result = { url, status: 'error', error: null, screenshotPath: null };

  try {
    console.log(`\n🌐 Opening: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Check if we need to click "Apply" button first
    const applyBtn = page.locator("a:has-text('Apply'), button:has-text('Apply Now'), a.apply-btn").first();
    if (await applyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  Clicking Apply button...');
      await applyBtn.click();
      await page.waitForTimeout(2000);
    }

    // Check for iframe
    const iframe = page.frameLocator("iframe[src*='greenhouse']").first();
    let formPage = page;
    try {
      const iframeEl = page.locator("iframe[src*='greenhouse']").first();
      if (await iframeEl.count() > 0) {
        console.log('  Detected Greenhouse iframe, switching context...');
        formPage = iframe;
      }
    } catch {}

    // Fill the form
    await fillGreenhouseForm(formPage, profile);

    // Screenshot before submit
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(SCREENSHOTS_DIR, `greenhouse-${timestamp}-pre-submit.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    result.screenshotPath = screenshotPath;
    console.log(`  📸 Pre-submit screenshot: ${screenshotPath}`);

    if (dryRun) {
      console.log('  🔒 DRY RUN — skipping submit. Browser stays open for review.');
      result.status = 'dry_run';
      // Keep browser open for manual review
      console.log('  Press Ctrl+C to close when done reviewing.');
      await new Promise(() => {}); // hang until killed
    } else {
      // Submit
      const submitted = await (async () => {
        const selectors = ['#submit_app', "button[type='submit']", "input[type='submit']"];
        for (const sel of selectors) {
          try {
            const btn = formPage.locator(sel).first();
            if (await btn.isVisible({ timeout: 2000 })) {
              await btn.click();
              return true;
            }
          } catch {}
        }
        return false;
      })();

      if (submitted) {
        await page.waitForTimeout(5000);
        const postScreenshot = path.join(SCREENSHOTS_DIR, `greenhouse-${timestamp}-post-submit.png`);
        await page.screenshot({ path: postScreenshot, fullPage: true });
        console.log(`  📸 Post-submit screenshot: ${postScreenshot}`);
        result.status = 'submitted';
        console.log('  ✅ Application submitted!');
      } else {
        result.status = 'submit_failed';
        result.error = 'Could not find submit button';
        console.log('  ❌ Could not find submit button');
      }
    }
  } catch (e) {
    result.error = e.message;
    console.error(`  ❌ Error: ${e.message}`);
  } finally {
    if (!dryRun) await browser.close();
  }

  return result;
}

// Main
(async () => {
  let urls = [];

  if (SPECIFIC_URL) {
    urls = [SPECIFIC_URL];
  } else {
    if (!fs.existsSync(FILTERED_PATH)) {
      console.error(`Missing ${FILTERED_PATH}. Run greenhouse-pull.cjs and greenhouse-filter.cjs first.`);
      process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(FILTERED_PATH, 'utf8'));
    const log = loadLog();
    const appliedUrls = new Set(log.filter(l => l.status === 'submitted').map(l => l.url));

    const unapplied = (data.jobs || []).filter(j => !appliedUrls.has(j.applyUrl));
    urls = unapplied.slice(0, LIMIT).map(j => j.applyUrl);

    if (urls.length === 0) {
      console.log('No unapplied jobs found. Run greenhouse-pull.cjs to get fresh jobs.');
      process.exit(0);
    }
    console.log(`📋 ${unapplied.length} unapplied jobs, processing ${urls.length}`);
  }

  const log = loadLog();

  for (const url of urls) {
    const result = await applyToJob(url, profile, DRY_RUN);
    log.push({
      ...result,
      appliedAt: new Date().toISOString(),
      company: url.match(/boards\.greenhouse\.io\/([^/]+)/)?.[1] || 'unknown',
    });
    saveLog(log);
  }

  console.log(`\n🏁 Done. ${urls.length} job(s) processed.`);
})();
