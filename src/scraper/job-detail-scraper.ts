import { chromium, Browser, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

export interface JobDetails {
  title: string;
  company: string;
  location: string;
  description: string;
  applyUrl: string;
  requirements: string[];
  salary: string;
  jobType: string;
  scrapedAt: string;
}

function emptyJobDetails(): JobDetails {
  return {
    title: '',
    company: '',
    location: '',
    description: '',
    applyUrl: '',
    requirements: [],
    salary: '',
    jobType: '',
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Extract text content from an element matching one of the given selectors.
 * Returns empty string if none match.
 */
async function extractText(page: Page, selectors: string[]): Promise<string> {
  for (const selector of selectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        const text = await el.textContent();
        if (text && text.trim().length > 0) {
          return text.trim();
        }
      }
    } catch {
      // selector not found, try next
    }
  }
  return '';
}

/**
 * Extract requirement bullet points from the job description text.
 * Looks for lines that start with bullet-like patterns or follow headings
 * such as "Requirements", "Qualifications", etc.
 */
function extractRequirements(descriptionText: string): string[] {
  const requirements: string[] = [];
  const lines = descriptionText.split('\n').map((l) => l.trim());

  let inRequirementsSection = false;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Detect section headings that indicate requirements
    if (
      /^(requirements|qualifications|what you('ll)? need|must have|minimum qualifications|basic qualifications|who you are)/i.test(
        line
      )
    ) {
      inRequirementsSection = true;
      continue;
    }

    // Detect section headings that end the requirements section
    if (
      inRequirementsSection &&
      /^(responsibilities|benefits|perks|about us|what we offer|nice to have|preferred|bonus|how to apply)/i.test(
        line
      )
    ) {
      inRequirementsSection = false;
      continue;
    }

    // Collect bullet points within the requirements section
    if (inRequirementsSection && line.length > 0) {
      // Strip leading bullet characters
      const cleaned = line.replace(/^[-*\u2022\u25E6\u25AA\u2023]\s*/, '');
      if (cleaned.length > 5) {
        requirements.push(cleaned);
      }
    }
  }

  return requirements;
}

/**
 * Try to extract salary information from the job description text.
 */
function extractSalary(descriptionText: string): string {
  // Match common salary patterns: $120,000, $120K-$150K, $120,000 - $150,000/year, etc.
  const salaryPatterns = [
    /\$[\d,]+(?:k|K)?\s*[-\u2013]\s*\$[\d,]+(?:k|K)?(?:\s*(?:\/|\s*per\s*)\s*(?:year|yr|annum|annually))?/,
    /\$[\d,]+(?:k|K)?(?:\s*(?:\/|\s*per\s*)\s*(?:year|yr|annum|annually|hour|hr))?/,
    /(?:salary|compensation|pay)\s*[:;]?\s*\$[\d,]+/i,
    /(?:USD|US\$)\s*[\d,]+\s*[-\u2013]\s*(?:USD|US\$)?\s*[\d,]+/i,
  ];

  for (const pattern of salaryPatterns) {
    const match = descriptionText.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  return '';
}

/**
 * Try to extract job type (Full-time, Part-time, Contract, etc.)
 */
function extractJobType(page: Page, descriptionText: string): Promise<string> {
  const jobTypes = [
    'Full-time',
    'Part-time',
    'Contract',
    'Temporary',
    'Internship',
    'Freelance',
    'Remote',
    'Hybrid',
    'On-site',
  ];

  const lowerDesc = descriptionText.toLowerCase();
  const found = jobTypes.filter((jt) => lowerDesc.includes(jt.toLowerCase()));

  return Promise.resolve(found.length > 0 ? found.join(', ') : '');
}

/**
 * Scrape full job details from a LinkedIn job posting URL.
 *
 * Launches a headless Chromium browser, navigates to the URL, and extracts
 * structured data from the page. If LinkedIn blocks the scrape or elements
 * are missing, partial data is returned with whatever was available.
 */
export async function scrapeJobDetails(jobUrl: string): Promise<JobDetails> {
  const details = emptyJobDetails();
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Navigate to the job URL with a reasonable timeout
    await page.goto(jobUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for the main content to appear. LinkedIn public job pages typically
    // render the description inside these containers.
    try {
      await page.waitForSelector(
        '.show-more-less-html__markup, .description__text, .top-card-layout__title',
        { timeout: 10000 }
      );
    } catch {
      // Page may have loaded with a different structure or been blocked.
      // Continue and extract whatever is available.
    }

    // --- Extract title ---
    details.title = await extractText(page, [
      '.top-card-layout__title',
      '.topcard__title',
      'h1.job-title',
      'h1',
    ]);

    // --- Extract company ---
    details.company = await extractText(page, [
      '.topcard__org-name-link',
      '.top-card-layout__company-name',
      '.topcard__flavor--black-link',
      'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
    ]);

    // --- Extract location ---
    details.location = await extractText(page, [
      '.topcard__flavor--bullet',
      '.top-card-layout__bullet',
      '.job-location',
    ]);

    // --- Extract full description ---
    details.description = await extractText(page, [
      '.show-more-less-html__markup',
      '.description__text',
      '.job-description',
      'section.description',
      '.core-section-container__content',
    ]);

    // --- Extract apply URL ---
    try {
      const applyButton = await page.$(
        'a.apply-button, a[data-tracking-control-name="public_jobs_apply-link-offsite"], a.topcard__link--apply'
      );
      if (applyButton) {
        const href = await applyButton.getAttribute('href');
        if (href) {
          details.applyUrl = href;
        }
      }
    } catch {
      // Apply button not found; fall back to the original URL
    }

    if (!details.applyUrl) {
      details.applyUrl = jobUrl;
    }

    // --- Derived fields ---
    details.requirements = extractRequirements(details.description);
    details.salary = extractSalary(details.description);
    details.jobType = await extractJobType(page, details.description);
    details.scrapedAt = new Date().toISOString();

    await context.close();
  } catch (error) {
    // If scraping fails entirely (network error, browser crash, etc.),
    // return whatever partial data we collected so far.
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(`[job-detail-scraper] Error scraping ${jobUrl}: ${errorMessage}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return details;
}

/**
 * Scrape multiple job URLs and return all results.
 * Processes sequentially to avoid overwhelming LinkedIn with parallel requests.
 */
export async function scrapeMultipleJobs(
  jobUrls: string[]
): Promise<Map<string, JobDetails>> {
  const results = new Map<string, JobDetails>();

  for (const url of jobUrls) {
    console.log(`[job-detail-scraper] Scraping: ${url}`);
    const details = await scrapeJobDetails(url);
    results.set(url, details);

    // Small delay between requests to be respectful
    if (jobUrls.indexOf(url) < jobUrls.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 3000));
    }
  }

  return results;
}

/**
 * Save scraped job details to a JSON file in data/jobs/{jobId}.json
 */
export function saveJobDetails(jobId: string, details: JobDetails): string {
  const outputDir = path.resolve(__dirname, '../../data/jobs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${jobId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(details, null, 2), 'utf-8');
  console.log(`[job-detail-scraper] Saved job details to ${outputPath}`);
  return outputPath;
}
