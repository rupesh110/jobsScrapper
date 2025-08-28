import Database from 'better-sqlite3';

const db = new Database('jobs.db');

db.prepare(`
  CREATE TABLE IF NOT EXISTS visited_jobs (
    url TEXT PRIMARY KEY,
    title TEXT,
    company TEXT,
    visited_at TEXT
  )
`).run();

export function normalizeUrl(url) {
  if (!url) return '';
  return url.split('#')[0].split('?')[0];
}

export function hasVisited(url) {
  const normalized = normalizeUrl(url);
  const row = db.prepare(`SELECT url FROM visited_jobs WHERE url = ?`).get(normalized);
  return !!row;
}

export function markVisited(job) {
  const normalized = normalizeUrl(job.url);
  db.prepare(`
    INSERT OR REPLACE INTO visited_jobs (url, title, company, visited_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(normalized, job.title, job.company);
}

export function getAllJobs() {
  return db.prepare(`SELECT * FROM visited_jobs`).all();
}
