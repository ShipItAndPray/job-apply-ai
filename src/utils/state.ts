import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const MEMORY_DIR = path.join(PROJECT_ROOT, 'data', 'memory');
const STATE_FILE = path.join(MEMORY_DIR, 'session-state.json');
const PENDING_FILE = path.join(MEMORY_DIR, 'pending-reviews.json');

export interface SessionState {
  lastUpdated: string;
  lastAction: string;
  searchesCompleted: number;
  totalJobsTracked: number;
  applicationsInQueue: number;
  applicationsSubmitted: number;
  newJobsFound: number;
  errors: string[];
}

function ensureDir(): void {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

export function loadSessionState(): SessionState {
  ensureDir();
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  }
  return {
    lastUpdated: new Date().toISOString(),
    lastAction: 'none',
    searchesCompleted: 0,
    totalJobsTracked: 0,
    applicationsInQueue: 0,
    applicationsSubmitted: 0,
    newJobsFound: 0,
    errors: [],
  };
}

export async function updateSessionState(updates: Partial<SessionState>): Promise<void> {
  ensureDir();
  const current = loadSessionState();
  const updated = {
    ...current,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(updated, null, 2));
}

export interface PendingReview {
  jobId: string;
  company: string;
  position: string;
  matchScore: number;
  tailoredResumePath: string;
  coverLetterPath: string;
  reviewStatus: 'awaiting_approval' | 'approved' | 'skipped';
  addedAt: string;
}

export function loadPendingReviews(): PendingReview[] {
  ensureDir();
  if (fs.existsSync(PENDING_FILE)) {
    const data = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));
    return data.pendingReview || [];
  }
  return [];
}

export function savePendingReviews(reviews: PendingReview[]): void {
  ensureDir();
  fs.writeFileSync(PENDING_FILE, JSON.stringify({ pendingReview: reviews }, null, 2));
}

export function addPendingReview(review: PendingReview): void {
  const reviews = loadPendingReviews();
  reviews.push(review);
  savePendingReviews(reviews);
}

export function removePendingReview(jobId: string): void {
  const reviews = loadPendingReviews().filter((r) => r.jobId !== jobId);
  savePendingReviews(reviews);
}
