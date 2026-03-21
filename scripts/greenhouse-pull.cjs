#!/usr/bin/env node
/**
 * Pull jobs from Greenhouse company boards.
 *
 * Usage:
 *   node scripts/greenhouse-pull.cjs                    # Pull jobs posted in last 7 days
 *   node scripts/greenhouse-pull.cjs --days 1           # Pull jobs posted today
 *   node scripts/greenhouse-pull.cjs --days 30          # Pull jobs posted in last 30 days
 *   node scripts/greenhouse-pull.cjs --slug stripe      # Pull from one company only
 *
 * Reads company slugs from config/greenhouse-companies.json
 * Outputs to data/jobs/greenhouse-jobs.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const SLUGS_PATH = path.join(BASE, 'config', 'greenhouse-companies.json');
const OUT_DIR = path.join(BASE, 'data', 'jobs');
const OUT_PATH = path.join(OUT_DIR, 'greenhouse-jobs.json');
const BATCH_SIZE = 20; // concurrent requests

// Parse args
const args = process.argv.slice(2);
const daysIdx = args.indexOf('--days');
const DAYS = daysIdx !== -1 ? parseInt(args[daysIdx + 1], 10) : 7;
const slugIdx = args.indexOf('--slug');
const SINGLE_SLUG = slugIdx !== -1 ? args[slugIdx + 1] : null;
const CUTOFF = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

// Load slugs
if (!fs.existsSync(SLUGS_PATH)) {
  console.error(`Missing ${SLUGS_PATH}. Run from project root.`);
  process.exit(1);
}
const slugsData = JSON.parse(fs.readFileSync(SLUGS_PATH, 'utf8'));
let slugs = slugsData.companies || [];

if (SINGLE_SLUG) {
  slugs = [SINGLE_SLUG];
}

console.log(`🔍 Pulling Greenhouse jobs from ${slugs.length} companies (last ${DAYS} days)...`);

// Ensure output dir
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function fetchJobs(slug) {
  return new Promise((resolve) => {
    const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
    const req = https.get(url, { timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const jobs = (parsed.jobs || [])
            .filter(job => {
              const updated = new Date(job.updated_at);
              return updated >= CUTOFF;
            })
            .map(job => ({
              id: String(job.id),
              title: job.title,
              company: slug,
              location: job.location ? job.location.name : 'Unknown',
              url: `https://boards.greenhouse.io/${slug}/jobs/${job.id}`,
              applyUrl: `https://boards.greenhouse.io/${slug}/jobs/${job.id}#app`,
              department: job.departments?.[0]?.name || '',
              updatedAt: job.updated_at,
              description: (job.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 2000),
            }));
          resolve({ slug, jobs, error: null });
        } catch (e) {
          resolve({ slug, jobs: [], error: `Parse error: ${e.message}` });
        }
      });
    });
    req.on('error', (e) => resolve({ slug, jobs: [], error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ slug, jobs: [], error: 'timeout' }); });
  });
}

async function processInBatches(slugList, batchSize) {
  const allJobs = [];
  let companiesWithJobs = 0;
  let errors = 0;

  for (let i = 0; i < slugList.length; i += batchSize) {
    const batch = slugList.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(fetchJobs));

    for (const result of results) {
      if (result.error) {
        errors++;
      }
      if (result.jobs.length > 0) {
        companiesWithJobs++;
        allJobs.push(...result.jobs);
      }
    }

    const progress = Math.min(i + batchSize, slugList.length);
    process.stdout.write(`\r  Progress: ${progress}/${slugList.length} companies | ${allJobs.length} jobs found | ${errors} errors`);
  }

  console.log(''); // newline
  return { allJobs, companiesWithJobs, errors };
}

(async () => {
  const start = Date.now();
  const { allJobs, companiesWithJobs, errors } = await processInBatches(slugs, BATCH_SIZE);

  // Sort by updated date (newest first)
  allJobs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  // Save
  const output = {
    pulledAt: new Date().toISOString(),
    cutoffDays: DAYS,
    totalCompanies: slugs.length,
    companiesWithJobs,
    totalJobs: allJobs.length,
    errors,
    jobs: allJobs,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Done in ${elapsed}s`);
  console.log(`   ${allJobs.length} jobs from ${companiesWithJobs} companies saved to ${OUT_PATH}`);
  console.log(`   ${errors} companies had errors (timeout/404/etc)`);

  // Print top companies by job count
  const byCompany = {};
  for (const job of allJobs) {
    byCompany[job.company] = (byCompany[job.company] || 0) + 1;
  }
  const sorted = Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log(`\n📊 Top companies by job count:`);
  for (const [company, count] of sorted) {
    console.log(`   ${company}: ${count} jobs`);
  }
})();
