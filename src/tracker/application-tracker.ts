import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DB_PATH = path.join(PROJECT_ROOT, 'data', 'tracker.db');

export type ApplicationStatus =
  | 'discovered'
  | 'scraped'
  | 'resume_tailored'
  | 'form_started'
  | 'review_pending'
  | 'submitted'
  | 'rejected'
  | 'interview'
  | 'offer'
  | 'skipped';

export interface Application {
  id: string;
  job_url: string;
  apply_url: string | null;
  company: string;
  position: string;
  location: string | null;
  salary_range: string | null;
  job_type: string | null;
  remote_type: string | null;
  status: ApplicationStatus;
  ats_system: string | null;
  match_score: number | null;
  discovered_at: string;
  scraped_at: string | null;
  tailored_at: string | null;
  applied_at: string | null;
  response_at: string | null;
  job_description_path: string | null;
  tailored_resume_path: string | null;
  cover_letter_path: string | null;
  notes: string | null;
  error_log: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobInput {
  id: string;
  jobUrl: string;
  applyUrl?: string;
  company: string;
  position: string;
  location?: string;
  salaryRange?: string;
  jobType?: string;
  remoteType?: string;
  discoveredAt: string;
}

export class ApplicationTracker {
  private db: Database.Database;

  constructor(dbPath: string = DB_PATH) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        job_url TEXT NOT NULL,
        apply_url TEXT,
        company TEXT NOT NULL,
        position TEXT NOT NULL,
        location TEXT,
        salary_range TEXT,
        job_type TEXT,
        remote_type TEXT,
        status TEXT NOT NULL DEFAULT 'discovered',
        ats_system TEXT,
        match_score INTEGER,
        discovered_at TEXT NOT NULL,
        scraped_at TEXT,
        tailored_at TEXT,
        applied_at TEXT,
        response_at TEXT,
        job_description_path TEXT,
        tailored_resume_path TEXT,
        cover_letter_path TEXT,
        notes TEXT,
        error_log TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS search_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query_keyword TEXT,
        query_location TEXT,
        query_filters TEXT,
        results_count INTEGER,
        new_jobs_found INTEGER,
        run_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
      CREATE INDEX IF NOT EXISTS idx_applications_company ON applications(company);
      CREATE INDEX IF NOT EXISTS idx_applications_job_url ON applications(job_url);
    `);
  }

  addJob(job: JobInput): boolean {
    const existing = this.db.prepare('SELECT 1 FROM applications WHERE job_url = ?').get(job.jobUrl);
    if (existing) return false;

    this.db.prepare(`
      INSERT OR IGNORE INTO applications (id, job_url, apply_url, company, position, location, salary_range, job_type, remote_type, status, discovered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'discovered', ?)
    `).run(
      job.id,
      job.jobUrl,
      job.applyUrl || null,
      job.company,
      job.position,
      job.location || null,
      job.salaryRange || null,
      job.jobType || null,
      job.remoteType || null,
      job.discoveredAt
    );
    return true;
  }

  updateStatus(id: string, status: ApplicationStatus, notes?: string): void {
    const timestampMap: Record<string, string> = {
      scraped: 'scraped_at',
      resume_tailored: 'tailored_at',
      submitted: 'applied_at',
    };

    const timestampField = timestampMap[status];
    if (timestampField) {
      this.db.prepare(
        `UPDATE applications SET status = ?, ${timestampField} = datetime('now'), notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?`
      ).run(status, notes || null, id);
    } else {
      this.db.prepare(
        `UPDATE applications SET status = ?, notes = COALESCE(?, notes), updated_at = datetime('now') WHERE id = ?`
      ).run(status, notes || null, id);
    }
  }

  setAtsSystem(id: string, atsSystem: string): void {
    this.db.prepare('UPDATE applications SET ats_system = ?, updated_at = datetime(\'now\') WHERE id = ?').run(atsSystem, id);
  }

  setMatchScore(id: string, score: number): void {
    this.db.prepare('UPDATE applications SET match_score = ?, updated_at = datetime(\'now\') WHERE id = ?').run(score, id);
  }

  setResumePaths(id: string, resumePath: string, coverLetterPath?: string): void {
    this.db.prepare(
      'UPDATE applications SET tailored_resume_path = ?, cover_letter_path = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(resumePath, coverLetterPath || null, id);
  }

  setApplyUrl(id: string, applyUrl: string): void {
    this.db.prepare('UPDATE applications SET apply_url = ?, updated_at = datetime(\'now\') WHERE id = ?').run(applyUrl, id);
  }

  setJobDescriptionPath(id: string, jdPath: string): void {
    this.db.prepare('UPDATE applications SET job_description_path = ?, updated_at = datetime(\'now\') WHERE id = ?').run(jdPath, id);
  }

  setError(id: string, errorLog: string): void {
    this.db.prepare('UPDATE applications SET error_log = ?, updated_at = datetime(\'now\') WHERE id = ?').run(errorLog, id);
  }

  getByStatus(status: ApplicationStatus): Application[] {
    return this.db.prepare('SELECT * FROM applications WHERE status = ? ORDER BY discovered_at DESC').all(status) as Application[];
  }

  getAll(): Application[] {
    return this.db.prepare('SELECT * FROM applications ORDER BY discovered_at DESC').all() as Application[];
  }

  getById(id: string): Application | undefined {
    return this.db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as Application | undefined;
  }

  isDuplicate(jobUrl: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM applications WHERE job_url = ?').get(jobUrl);
  }

  getStats(): { total: number; byStatus: Record<string, number>; byATS: Record<string, number> } {
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM applications').get() as any).count;
    const statusRows = this.db.prepare('SELECT status, COUNT(*) as count FROM applications GROUP BY status').all() as any[];
    const atsRows = this.db.prepare(
      "SELECT COALESCE(ats_system, 'unknown') as ats, COUNT(*) as count FROM applications GROUP BY ats_system"
    ).all() as any[];

    const byStatus: Record<string, number> = {};
    for (const r of statusRows) byStatus[r.status] = r.count;

    const byATS: Record<string, number> = {};
    for (const r of atsRows) byATS[r.ats] = r.count;

    return { total, byStatus, byATS };
  }

  getRecentSearchRuns(limit: number = 10): any[] {
    return this.db.prepare('SELECT * FROM search_runs ORDER BY run_at DESC LIMIT ?').all(limit);
  }

  logSearchRun(keyword: string, location: string, filters: string, resultsCount: number, newJobsFound: number): void {
    this.db.prepare(
      'INSERT INTO search_runs (query_keyword, query_location, query_filters, results_count, new_jobs_found) VALUES (?, ?, ?, ?, ?)'
    ).run(keyword, location, filters, resultsCount, newJobsFound);
  }

  close(): void {
    this.db.close();
  }
}
