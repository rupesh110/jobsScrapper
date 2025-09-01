// src/data/jobQueue.js
import Database from 'better-sqlite3';
import { normalizeUrl } from './index.js'; // Ensure normalizeUrl is exported from your main data/index.js

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
    slack_sent INTEGER DEFAULT 0,  -- 0 = not sent, 1 = sent
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`).run();

// ---------------- Queue Operations ----------------

// Add a new job to the queue or update existing one
export function enqueueJob(job) {
  const normalized = normalizeUrl(job.url);
  db.prepare(`
    INSERT INTO job_queue (url, title, company, description, slack_sent)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(url) DO UPDATE SET
      title = excluded.title,
      company = excluded.company,
      description = excluded.description,
      status = 'pending',
      slack_sent = 0,
      updated_at = datetime('now')
  `).run(
    normalized,
    job.title,
    job.company,
    job.description || 'No description available'
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

// Optional: remove a job from the queue
export function removeJob(id) {
  db.prepare(`DELETE FROM job_queue WHERE id = ?`).run(id);
}

// Check if Slack message has already been sent
export function isSlackSent(id) {
  const row = db.prepare(`SELECT slack_sent FROM job_queue WHERE id = ?`).get(id);
  return row?.slack_sent === 1;
}

// Mark that Slack message has been sent
export function markSlackSent(id) {
  db.prepare(`
    UPDATE job_queue
    SET slack_sent = 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(id);
}

// Optional: fetch all pending jobs (useful for batch processing)
export function getAllPendingJobs() {
  return db.prepare(`
    SELECT * FROM job_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
  `).all();
}
