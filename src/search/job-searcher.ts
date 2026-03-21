import linkedIn from 'linkedin-jobs-api';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface SearchQuery {
  keyword: string;
  location: string;
  dateSincePosted?: string;  // "past month", "past week", "24hr"
  jobType?: string;           // "full time", etc
  remoteFilter?: string;      // "remote", "hybrid", "on site"
  salary?: string;            // "40000", "60000", etc
  experienceLevel?: string;   // "senior", "director", etc
  limit?: string;             // default "25"
  sortBy?: string;            // "recent" or "relevant"
}

export interface JobListing {
  id: string;
  position: string;
  company: string;
  location: string;
  postedDate: string;
  salary: string;
  jobUrl: string;
  source: 'linkedin';
  searchedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const JOBS_DIR = path.join(PROJECT_ROOT, 'data', 'jobs');
const QUERIES_PATH = path.join(PROJECT_ROOT, 'config', 'search-queries.json');

/**
 * Generate a deterministic ID for a job listing by MD5-hashing
 * the concatenation of company + position + jobUrl.
 */
function generateJobId(company: string, position: string, jobUrl: string): string {
  const input = `${company}${position}${jobUrl}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

/**
 * Ensure the data/jobs directory exists.
 */
function ensureJobsDir(): void {
  if (!fs.existsSync(JOBS_DIR)) {
    fs.mkdirSync(JOBS_DIR, { recursive: true });
  }
}

/**
 * Save a single job listing to data/jobs/{jobId}.json.
 */
function saveJob(job: JobListing): void {
  const filePath = path.join(JOBS_DIR, `${job.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(job, null, 2), 'utf-8');
}

/**
 * Load search queries from config/search-queries.json.
 * Expects the JSON file to contain an array of SearchQuery objects.
 */
export function loadSearchQueries(): SearchQuery[] {
  const raw = fs.readFileSync(QUERIES_PATH, 'utf-8');
  const parsed = JSON.parse(raw);

  // Support both { "queries": [...] } wrapper and plain array
  const queries = Array.isArray(parsed) ? parsed : parsed.queries;

  if (!Array.isArray(queries)) {
    throw new Error(`Expected an array of search queries (or { "queries": [...] }) in ${QUERIES_PATH}`);
  }

  return queries as SearchQuery[];
}

// ---------------------------------------------------------------------------
// Core search logic
// ---------------------------------------------------------------------------

/**
 * Execute a single search query against the LinkedIn Jobs API.
 * Returns an array of JobListing objects. On failure the error is logged
 * and an empty array is returned so that other queries are not affected.
 */
async function runSingleSearch(query: SearchQuery): Promise<JobListing[]> {
  const searchedAt = new Date().toISOString();

  const queryOptions: Record<string, string> = {
    keyword: query.keyword,
    location: query.location,
    dateSincePosted: query.dateSincePosted ?? 'past month',
    jobType: query.jobType ?? '',
    remoteFilter: query.remoteFilter ?? '',
    salary: query.salary ?? '',
    experienceLevel: query.experienceLevel ?? '',
    limit: query.limit ?? '25',
    sortBy: query.sortBy ?? 'recent',
  };

  // Remove empty optional fields so the API ignores them.
  for (const key of Object.keys(queryOptions)) {
    if (queryOptions[key] === '') {
      delete queryOptions[key];
    }
  }

  try {
    const results = await linkedIn.query(queryOptions);

    if (!Array.isArray(results)) {
      console.error(`[job-searcher] Non-array response for keyword="${query.keyword}"`);
      return [];
    }

    return results.map((r: any) => {
      const position = r.position ?? '';
      const company = r.company ?? '';
      const jobUrl = r.jobUrl ?? '';
      const id = generateJobId(company, position, jobUrl);

      return {
        id,
        position,
        company,
        location: r.location ?? '',
        postedDate: r.agoTime ?? '',
        salary: r.salary ?? '',
        jobUrl,
        source: 'linkedin' as const,
        searchedAt,
      };
    });
  } catch (err) {
    console.error(
      `[job-searcher] Search failed for keyword="${query.keyword}" location="${query.location}":`,
      err,
    );
    return [];
  }
}

export interface SearchResult {
  jobs: JobListing[];
  totalFound: number;
  duplicatesRemoved: number;
}

/**
 * Run all provided search queries in parallel, deduplicate by job URL,
 * persist each unique job to disk, and return the results with stats.
 */
export async function searchJobs(queries: SearchQuery[]): Promise<SearchResult> {
  ensureJobsDir();

  console.log(`[job-searcher] Running ${queries.length} queries in parallel...`);

  // Run all queries in parallel; each handles its own errors internally.
  const resultSets = await Promise.all(queries.map(runSingleSearch));

  // Flatten all results.
  const allJobs: JobListing[] = [];
  for (const results of resultSets) {
    allJobs.push(...results);
  }
  const totalFound = allJobs.length;

  // Deduplicate by jobUrl.
  const seen = new Map<string, JobListing>();
  for (const job of allJobs) {
    if (!seen.has(job.jobUrl)) {
      seen.set(job.jobUrl, job);
    }
  }

  const uniqueJobs = Array.from(seen.values());
  const duplicatesRemoved = totalFound - uniqueJobs.length;

  console.log(
    `[job-searcher] Found ${uniqueJobs.length} unique jobs (${duplicatesRemoved} duplicates removed) across ${queries.length} queries.`,
  );

  // Persist each job individually.
  for (const job of uniqueJobs) {
    saveJob(job);
  }

  return { jobs: uniqueJobs, totalFound, duplicatesRemoved };
}

/**
 * Convenience entry point: loads queries from config and runs the search.
 */
export async function searchJobsFromConfig(): Promise<SearchResult> {
  const queries = loadSearchQueries();
  return searchJobs(queries);
}
