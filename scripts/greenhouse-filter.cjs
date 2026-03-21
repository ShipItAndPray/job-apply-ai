#!/usr/bin/env node
/**
 * Filter Greenhouse jobs by title keywords.
 *
 * Usage:
 *   node scripts/greenhouse-filter.cjs                              # Use default filters
 *   node scripts/greenhouse-filter.cjs --include "backend,java"     # Custom include keywords
 *   node scripts/greenhouse-filter.cjs --exclude "manager,intern"   # Custom exclude keywords
 *   node scripts/greenhouse-filter.cjs --input data/jobs/greenhouse-jobs.json
 *
 * Reads from data/jobs/greenhouse-jobs.json (output of greenhouse-pull.cjs)
 * Outputs to data/jobs/greenhouse-filtered.json
 */

const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(BASE, 'data', 'jobs', 'greenhouse-jobs.json');
const OUT_PATH = path.join(BASE, 'data', 'jobs', 'greenhouse-filtered.json');

// Parse args
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}

const INPUT_PATH = getArg('--input') || DEFAULT_INPUT;

// Default title keywords to include (any match = keep)
const DEFAULT_INCLUDE = [
  'software engineer', 'backend', 'fullstack', 'full stack', 'full-stack',
  'platform engineer', 'infrastructure', 'devops', 'sre', 'site reliability',
  'staff engineer', 'principal engineer', 'senior engineer',
  'java', 'python', 'golang', 'node', 'typescript',
  'data engineer', 'ml engineer', 'machine learning',
  'cloud engineer', 'systems engineer',
];

// Default title keywords to exclude (any match = skip)
const DEFAULT_EXCLUDE = [
  'manager', 'director', 'vp ', 'vice president', 'head of',
  'intern', 'internship', 'co-op', 'apprentice',
  'recruiter', 'recruiting', 'talent',
  'sales', 'account executive', 'business development',
  'marketing', 'content', 'copywriter',
  'designer', 'ux ', 'ui ',
  'customer success', 'customer support', 'support engineer',
  'legal', 'counsel', 'attorney',
  'finance', 'accountant', 'controller',
  'hr ', 'human resources', 'people ops',
];

const includeStr = getArg('--include');
const excludeStr = getArg('--exclude');
const INCLUDE = includeStr ? includeStr.split(',').map(s => s.trim().toLowerCase()) : DEFAULT_INCLUDE;
const EXCLUDE = excludeStr ? excludeStr.split(',').map(s => s.trim().toLowerCase()) : DEFAULT_EXCLUDE;

// Load jobs
if (!fs.existsSync(INPUT_PATH)) {
  console.error(`Missing ${INPUT_PATH}. Run greenhouse-pull.cjs first.`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
const jobs = data.jobs || [];
console.log(`📋 Loaded ${jobs.length} jobs from ${INPUT_PATH}`);

// Filter
const filtered = [];
const skipped = { excluded: 0, noMatch: 0 };

for (const job of jobs) {
  const title = (job.title || '').toLowerCase();
  const dept = (job.department || '').toLowerCase();
  const combined = `${title} ${dept}`;

  // Check excludes first
  if (EXCLUDE.some(kw => combined.includes(kw))) {
    skipped.excluded++;
    continue;
  }

  // Check includes
  if (INCLUDE.some(kw => combined.includes(kw))) {
    filtered.push(job);
  } else {
    skipped.noMatch++;
  }
}

// Deduplicate by title + company
const seen = new Set();
const deduped = [];
for (const job of filtered) {
  const key = `${job.company}:${job.title}`.toLowerCase();
  if (!seen.has(key)) {
    seen.add(key);
    deduped.push(job);
  }
}

const dupes = filtered.length - deduped.length;

// Save
const output = {
  filteredAt: new Date().toISOString(),
  inputFile: INPUT_PATH,
  includeKeywords: INCLUDE,
  excludeKeywords: EXCLUDE,
  stats: {
    totalInput: jobs.length,
    excluded: skipped.excluded,
    noTitleMatch: skipped.noMatch,
    duplicatesRemoved: dupes,
    remaining: deduped.length,
  },
  jobs: deduped,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

console.log(`\n✅ Filtered results:`);
console.log(`   ${jobs.length} total → ${skipped.excluded} excluded → ${skipped.noMatch} no title match → ${dupes} dupes → ${deduped.length} remaining`);
console.log(`   Saved to ${OUT_PATH}`);

// Print breakdown by company
const byCompany = {};
for (const job of deduped) {
  byCompany[job.company] = (byCompany[job.company] || 0) + 1;
}
const sorted = Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 20);
console.log(`\n📊 Jobs by company:`);
for (const [company, count] of sorted) {
  console.log(`   ${company}: ${count}`);
}
