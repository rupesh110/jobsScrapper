// jobs.js
import * as localDb from './db.js';
import { markVisitedCosmos, getAllJobsCosmos } from './cosmos.js';

export const normalizeUrl = localDb.normalizeUrl;

export function hasVisited(url) {
  return localDb.hasVisited(url);
}

// Mark job as visited in local DB and optionally in Cosmos
export async function markVisited(job, syncToCosmos = true) {
  const normalizedJob = { ...job, url: normalizeUrl(job.url) };

  // Always mark in local DB
  localDb.markVisited(normalizedJob);
  console.log("Job marked in local DB:", normalizedJob.title);

  // Sync to Cosmos only if needed
  if (syncToCosmos) {
    try {
      await markVisitedCosmos(normalizedJob);
      console.log("Job marked in Cosmos DB:", normalizedJob.title);
    } catch (err) {
      console.error("Cosmos update failed:", err.message);
    }
  }
}

// Get all jobs: prefer local DB, fallback to Cosmos
export async function getAllJobs() {
  let localJobs = localDb.getAllJobs();

  if (localJobs.length > 0) {
    return localJobs;
  }

  // Local DB empty → fetch from Cosmos
  const cosmosJobs = await getAllJobsCosmos();

  // Populate local DB (do NOT sync back to Cosmos)
  cosmosJobs.forEach(job => localDb.markVisited(job));
  console.log("Local DB populated from Cosmos:", cosmosJobs.length, "jobs");

  return cosmosJobs;
}
