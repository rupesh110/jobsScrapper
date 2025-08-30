// src/data/jobQueue.js
import Database from 'better-sqlite3';
import { normalizeUrl } from './index.js'; // make sure normalizeUrl is exported from your main data/index.js

const db = new Database('queue.db');

// ---------------- Job Queue table ----------------
db.prepare(`
  CREATE TABLE IF NOT EXISTS job_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE,
    title TEXT,
    company TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`).run();

// Add a new job to the queue
export function enqueueJob(job) {
  const normalized = normalizeUrl(job.url);
  db.prepare(`
    INSERT OR IGNORE INTO job_queue (url, title, company, description)
    VALUES (?, ?, ?, ?)
  `).run(
    normalized,
    job.title,
    job.company,
    job.description || 'No description available' // add description
  );
}


// Fetch the next pending job from the queue
export function getPendingJob() {
  return db.prepare(`
    SELECT * FROM job_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
  `).get();
}

// Mark a job as done with its description
export function markJobDone(id, description) {
  db.prepare(`
    UPDATE job_queue
    SET description = ?, status = 'done', updated_at = datetime('now')
    WHERE id = ?
  `).run(description, id);
}

// Mark a job as failed with an error message
export function markJobFailed(id, errorMessage) {
  db.prepare(`
    UPDATE job_queue
    SET status = 'failed', description = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(errorMessage, id);
}

// Optional: remove a job from the queue after processing
export function removeJob(id) {
  db.prepare(`DELETE FROM job_queue WHERE id = ?`).run(id);
}
