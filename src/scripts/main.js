import { scrapeJobs as scrapeSeekJobs } from '../extract/scrapperSeek.js';
import { scrapeLinkedInJobs } from '../extract/linkedin/linkedinScrapper.js';
import { processQueue } from '../worker/processQueue.js';
import { sendSlackMessageVmRunning } from "../integrate/slack.js";

export async function main() {
  await sendSlackMessageVmRunning("Data processing started");

  try {

      try {
        await scrapeSeekJobs();
      } catch (err) {
        console.error("LinkedIn scraping failed, continuing with queue processing...", err);
      }

      try {
        await scrapeLinkedInJobs();
      } catch (err) {
        console.error("LinkedIn scraping failed, continuing with queue processing...", err);
      }


    // 3️⃣ Process queued jobs (AI + Slack)
    console.log('Processing queued jobs...');
    await processQueue();  // runs only after all scraping is done
    console.log('All queued jobs processed. Main finished.');

  } catch (err) {
    console.error('Error during scheduled job flow:', err);
  }
}
