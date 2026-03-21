/**
 * Semi-Auto Pipeline Orchestrator
 *
 * Chains: Search → Scrape JD → Tailor Resume → Open Browser → Fill Form → Review → Submit → Track
 *
 * Two review checkpoints:
 *   1. After resume tailoring — user reviews resume + cover letter + match score
 *   2. After form filling — user reviews screenshot before submission
 *
 * Design philosophy:
 *   - Not aggressive: professional, thoughtful cover letters that highlight genuine strengths
 *   - Track everything: every resume, cover letter, and submission is saved and linked in the tracker
 *   - Semi-auto first: always pause for human review before submitting
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium, type Browser, type Page } from 'playwright';

import { ApplicationTracker, type ApplicationStatus } from '../tracker/application-tracker.js';
import { scrapeJobDetails, type JobDetails } from '../scraper/job-detail-scraper.js';
import {
  extractKeywords,
  computeMatchScore,
  saveTailoredDocuments,
  generateTailoringPrompt,
} from '../tailor/resume-tailor.js';
import { detectATSFromUrl, detectATSFromDOM, type ATSSystem } from '../ats/detector.js';
import { GreenhouseHandler } from '../ats/greenhouse.js';
import { LeverHandler } from '../ats/lever.js';
import { GenericHandler } from '../ats/generic.js';
import { type ApplicationProfile } from '../ats/base-handler.js';
import { updateSessionState, addPendingReview } from '../utils/state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineResult {
  jobId: string;
  company: string;
  position: string;
  status: 'submitted' | 'review_pending' | 'skipped' | 'error';
  matchScore: number;
  atsSystem: string;
  error?: string;
}

export interface PipelineOptions {
  mode: 'semi-auto' | 'full-auto';
  minMatchScore: number;       // Skip jobs below this score (default: 40)
  headless: boolean;           // Run browser headless? (default: false for semi-auto)
  screenshotBeforeSubmit: boolean;  // Take screenshot before submitting
  skipSubmit: boolean;         // If true, fill form but don't click submit (for testing)
}

const DEFAULT_OPTIONS: PipelineOptions = {
  mode: 'semi-auto',
  minMatchScore: 40,
  headless: false,
  screenshotBeforeSubmit: true,
  skipSubmit: true,  // Safety: default to not auto-submitting
};

// ---------------------------------------------------------------------------
// Profile loader
// ---------------------------------------------------------------------------

function loadProfile(): ApplicationProfile {
  const profilePath = path.join(PROJECT_ROOT, 'config', 'profile.json');
  return JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
}

// ---------------------------------------------------------------------------
// ATS Handler factory
// ---------------------------------------------------------------------------

function getATSHandler(system: ATSSystem, page: Page, profile: ApplicationProfile) {
  switch (system) {
    case 'greenhouse':
      return new GreenhouseHandler(page, profile);
    case 'lever':
      return new LeverHandler(page, profile);
    default:
      return new GenericHandler(page, profile);
  }
}

// ---------------------------------------------------------------------------
// Step 1: Scrape job details
// ---------------------------------------------------------------------------

export async function stepScrapeJob(
  tracker: ApplicationTracker,
  jobId: string,
  jobUrl: string
): Promise<JobDetails | null> {
  console.log(`\n[pipeline] Step 1: Scraping job details for ${jobId}...`);

  try {
    const details = await scrapeJobDetails(jobUrl);

    // Save full JD to data/jobs/
    const jdPath = path.join(PROJECT_ROOT, 'data', 'jobs', `${jobId}-details.json`);
    fs.writeFileSync(jdPath, JSON.stringify(details, null, 2));

    tracker.updateStatus(jobId, 'scraped');
    tracker.setJobDescriptionPath(jobId, jdPath);

    if (details.applyUrl && details.applyUrl !== jobUrl) {
      tracker.setApplyUrl(jobId, details.applyUrl);
    }

    console.log(`[pipeline]   Title: ${details.title}`);
    console.log(`[pipeline]   Company: ${details.company}`);
    console.log(`[pipeline]   Apply URL: ${details.applyUrl}`);
    console.log(`[pipeline]   Description length: ${details.description.length} chars`);

    return details;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[pipeline]   Failed to scrape: ${errMsg}`);
    tracker.setError(jobId, `Scrape failed: ${errMsg}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 2: Compute match score and generate tailoring prompt
// ---------------------------------------------------------------------------

export function stepAnalyzeMatch(
  tracker: ApplicationTracker,
  jobId: string,
  jobDescription: string,
  resumeText: string
): { score: number; matched: string[]; missing: string[]; keywords: ReturnType<typeof extractKeywords> } {
  console.log(`\n[pipeline] Step 2: Analyzing match for ${jobId}...`);

  const keywords = extractKeywords(jobDescription);
  const { score, matched, missing } = computeMatchScore(resumeText, jobDescription);

  tracker.setMatchScore(jobId, Math.round(score));

  console.log(`[pipeline]   Match score: ${Math.round(score)}/100`);
  console.log(`[pipeline]   Matched keywords (${matched.length}): ${matched.slice(0, 10).join(', ')}${matched.length > 10 ? '...' : ''}`);
  console.log(`[pipeline]   Missing keywords (${missing.length}): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '...' : ''}`);

  return { score, matched, missing, keywords };
}

// ---------------------------------------------------------------------------
// Step 3: Save tailored resume + cover letter (human provides the tailored content)
// ---------------------------------------------------------------------------

export function stepSaveTailoredDocuments(
  tracker: ApplicationTracker,
  jobId: string,
  tailoredResume: string,
  coverLetter: string
): { resumePath: string; coverLetterPath: string } {
  console.log(`\n[pipeline] Step 3: Saving tailored documents for ${jobId}...`);

  const { resumePath, coverLetterPath } = saveTailoredDocuments(jobId, tailoredResume, coverLetter);

  tracker.setResumePaths(jobId, resumePath, coverLetterPath);
  tracker.updateStatus(jobId, 'resume_tailored');

  console.log(`[pipeline]   Resume saved: ${resumePath}`);
  console.log(`[pipeline]   Cover letter saved: ${coverLetterPath}`);

  return { resumePath, coverLetterPath };
}

// ---------------------------------------------------------------------------
// Step 4: Detect ATS and fill form
// ---------------------------------------------------------------------------

export async function stepFillApplication(
  tracker: ApplicationTracker,
  jobId: string,
  applyUrl: string,
  resumePath: string,
  coverLetterPath: string | undefined,
  options: PipelineOptions = DEFAULT_OPTIONS
): Promise<{ browser: Browser; page: Page; atsSystem: ATSSystem; screenshotPath?: string } | null> {
  console.log(`\n[pipeline] Step 4: Opening application for ${jobId}...`);
  console.log(`[pipeline]   URL: ${applyUrl}`);

  // Detect ATS from URL first
  let atsResult = detectATSFromUrl(applyUrl);
  console.log(`[pipeline]   ATS detected (URL): ${atsResult.system} (confidence: ${atsResult.confidence})`);

  const browser = await chromium.launch({
    headless: options.headless,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();

  try {
    await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000); // Let dynamic content load

    // If URL detection was inconclusive, try DOM detection
    if (atsResult.system === 'unknown') {
      atsResult = await detectATSFromDOM(page, applyUrl);
      console.log(`[pipeline]   ATS detected (DOM): ${atsResult.system} (confidence: ${atsResult.confidence})`);
    }

    tracker.setAtsSystem(jobId, atsResult.system);
    tracker.updateStatus(jobId, 'form_started');

    // Get the right handler
    const profile = loadProfile();
    const handler = getATSHandler(atsResult.system, page, profile);

    // Fill the form
    console.log(`[pipeline]   Filling personal info...`);
    await handler.fillPersonalInfo();

    console.log(`[pipeline]   Uploading resume...`);
    await handler.uploadResume(resumePath);

    if (coverLetterPath) {
      console.log(`[pipeline]   Uploading cover letter...`);
      await handler.uploadCoverLetter(coverLetterPath);
    }

    console.log(`[pipeline]   Filling custom questions...`);
    await handler.fillCustomQuestions();

    // Screenshot before submit
    let screenshotPath: string | undefined;
    if (options.screenshotBeforeSubmit) {
      const screenshotDir = path.join(PROJECT_ROOT, 'data', 'screenshots');
      if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
      screenshotPath = path.join(screenshotDir, `${jobId}-pre-submit.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[pipeline]   Screenshot saved: ${screenshotPath}`);
    }

    tracker.updateStatus(jobId, 'review_pending');

    return { browser, page, atsSystem: atsResult.system, screenshotPath };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[pipeline]   Form filling failed: ${errMsg}`);
    tracker.setError(jobId, `Form fill failed: ${errMsg}`);
    await browser.close();
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 5: Submit (only after human approval in semi-auto mode)
// ---------------------------------------------------------------------------

export async function stepSubmit(
  tracker: ApplicationTracker,
  jobId: string,
  page: Page,
  browser: Browser,
  atsSystem: ATSSystem
): Promise<boolean> {
  console.log(`\n[pipeline] Step 5: Submitting application for ${jobId}...`);

  try {
    // Find and click submit button based on ATS
    const submitSelectors: Record<string, string[]> = {
      greenhouse: ['#submit_app', 'button[type="submit"]'],
      lever: ['button[type="submit"]', '.btn-submit'],
      workday: ['button[data-automation-id="submit"]', 'button[type="submit"]'],
      generic: ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("Submit")'],
    };

    const selectors = submitSelectors[atsSystem] || submitSelectors.generic;

    for (const selector of selectors) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        console.log(`[pipeline]   Clicked submit: ${selector}`);

        // Wait for confirmation
        await page.waitForTimeout(3000);

        // Take post-submit screenshot
        const screenshotDir = path.join(PROJECT_ROOT, 'data', 'screenshots');
        const postScreenshot = path.join(screenshotDir, `${jobId}-post-submit.png`);
        await page.screenshot({ path: postScreenshot, fullPage: true });
        console.log(`[pipeline]   Post-submit screenshot: ${postScreenshot}`);

        tracker.updateStatus(jobId, 'submitted');
        return true;
      }
    }

    console.log(`[pipeline]   Could not find submit button`);
    tracker.setError(jobId, 'Submit button not found');
    return false;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[pipeline]   Submit failed: ${errMsg}`);
    tracker.setError(jobId, `Submit failed: ${errMsg}`);
    return false;
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Full pipeline for a single job (semi-auto — pauses for human review)
// ---------------------------------------------------------------------------

export async function processJobSemiAuto(
  jobId: string,
  jobUrl: string,
  options: Partial<PipelineOptions> = {}
): Promise<PipelineResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const tracker = new ApplicationTracker();
  const app = tracker.getById(jobId);

  const result: PipelineResult = {
    jobId,
    company: app?.company || 'Unknown',
    position: app?.position || 'Unknown',
    status: 'error',
    matchScore: 0,
    atsSystem: 'unknown',
  };

  try {
    // Step 1: Scrape
    const details = await stepScrapeJob(tracker, jobId, jobUrl);
    if (!details || !details.description) {
      result.error = 'Failed to scrape job details';
      return result;
    }

    result.company = details.company || result.company;
    result.position = details.title || result.position;

    // Step 2: Analyze match
    const resumeBasePath = path.join(PROJECT_ROOT, 'templates', 'resume-base.txt');
    const resumeText = fs.readFileSync(resumeBasePath, 'utf-8');
    const analysis = stepAnalyzeMatch(tracker, jobId, details.description, resumeText);
    result.matchScore = Math.round(analysis.score);

    // Skip if below threshold
    if (analysis.score < opts.minMatchScore) {
      console.log(`\n[pipeline] Match score ${Math.round(analysis.score)} is below threshold ${opts.minMatchScore}. Skipping.`);
      tracker.updateStatus(jobId, 'skipped', `Match score too low: ${Math.round(analysis.score)}`);
      result.status = 'skipped';
      return result;
    }

    // Generate tailoring prompt for Claude to use
    const prompt = generateTailoringPrompt({
      jobId,
      jobDescription: details.description,
      companyName: details.company,
      jobTitle: details.title,
      baseResumePath: resumeBasePath,
    });

    // Add to pending reviews — Claude session will handle the actual tailoring
    addPendingReview({
      jobId,
      company: result.company,
      position: result.position,
      matchScore: result.matchScore,
      tailoredResumePath: '',
      coverLetterPath: '',
      reviewStatus: 'awaiting_approval',
      addedAt: new Date().toISOString(),
    });

    // Print the tailoring prompt for the user/Claude session
    console.log('\n' + '='.repeat(80));
    console.log('CHECKPOINT 1: RESUME TAILORING REVIEW');
    console.log('='.repeat(80));
    console.log(`\nJob: ${result.position} @ ${result.company}`);
    console.log(`Match Score: ${result.matchScore}/100`);
    console.log(`\nMatched Keywords: ${analysis.matched.join(', ')}`);
    console.log(`Missing Keywords: ${analysis.missing.join(', ')}`);
    console.log(`\nApply URL: ${details.applyUrl}`);
    console.log(`\n--- TAILORING PROMPT ---`);
    console.log(prompt);
    console.log('--- END PROMPT ---\n');
    console.log('Pipeline paused. Use the tailoring prompt above to generate a tailored resume and cover letter.');
    console.log('Then call stepSaveTailoredDocuments() followed by stepFillApplication().');

    result.status = 'review_pending';
    result.atsSystem = detectATSFromUrl(details.applyUrl).system;

    // Update session state
    await updateSessionState({
      lastAction: `analyzed_job_${jobId}`,
      applicationsInQueue: tracker.getByStatus('review_pending').length,
    });

    return result;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    result.error = errMsg;
    tracker.setError(jobId, errMsg);
    return result;
  } finally {
    tracker.close();
  }
}

// ---------------------------------------------------------------------------
// Process a batch of discovered jobs
// ---------------------------------------------------------------------------

export async function processBatch(
  limit: number = 10,
  options: Partial<PipelineOptions> = {}
): Promise<PipelineResult[]> {
  const tracker = new ApplicationTracker();
  const discovered = tracker.getByStatus('discovered');
  tracker.close();

  const batch = discovered.slice(0, limit);
  console.log(`\n[pipeline] Processing batch of ${batch.length} jobs (${discovered.length} total discovered)...\n`);

  const results: PipelineResult[] = [];
  for (const job of batch) {
    const result = await processJobSemiAuto(job.id, job.job_url, options);
    results.push(result);
    console.log(`\n[pipeline] ${job.id}: ${result.status} (score: ${result.matchScore})\n`);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Get pipeline summary
// ---------------------------------------------------------------------------

export function getPipelineSummary(): string {
  const tracker = new ApplicationTracker();
  const stats = tracker.getStats();
  const pending = tracker.getByStatus('review_pending');
  const submitted = tracker.getByStatus('submitted');
  tracker.close();

  let summary = '\n=== Pipeline Summary ===\n';
  summary += `Total jobs tracked: ${stats.total}\n`;
  for (const [status, count] of Object.entries(stats.byStatus)) {
    summary += `  ${status}: ${count}\n`;
  }

  if (pending.length > 0) {
    summary += `\nAwaiting Review (${pending.length}):\n`;
    for (const p of pending) {
      summary += `  - ${p.position} @ ${p.company} (score: ${p.match_score})\n`;
    }
  }

  if (submitted.length > 0) {
    summary += `\nSubmitted (${submitted.length}):\n`;
    for (const s of submitted) {
      summary += `  - ${s.position} @ ${s.company} | Applied: ${s.applied_at}\n`;
      if (s.tailored_resume_path) summary += `    Resume: ${s.tailored_resume_path}\n`;
      if (s.cover_letter_path) summary += `    Cover letter: ${s.cover_letter_path}\n`;
    }
  }

  return summary;
}
