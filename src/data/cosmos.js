import { CosmosClient } from "@azure/cosmos";
import dotenv from 'dotenv';
dotenv.config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;


const client = new CosmosClient({ endpoint, key });
const database = client.database("scrappedDB");
const container = database.container("jobsData");

function getCosmosId(url) {
  return Buffer.from(url).toString('base64'); // URL-safe ID
}

export async function markVisitedCosmos(job) {
  try {
    await container.items.upsert({
      id: getCosmosId(job.url), // Use normalized URL as unique ID
       url: job.url,
      title: job.title,
      company: job.company,
      description: job.description || '',
      visitedAt: new Date().toISOString(),
    });
    console.log("Cosmos DB updated successfully");
  } catch (err) {
    console.error("Cosmos update failed:", err.message);
  }
}

export async function getAllJobsCosmos() {
  try {
    const { resources } = await container.items
      .query("SELECT * FROM c ORDER BY c.visitedAt DESC")
      .fetchAll();
    return resources;
  } catch (err) {
    console.error("Cosmos fetch failed:", err.message);
    return [];
  }
}
