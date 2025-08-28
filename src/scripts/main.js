import { scrapeJobs as scrapeSeekJobs } from '../extract/scrapperSeek.js';
import { scrapeLinkedInJobs } from '../extract/linkedinScrapper.js';
import { extractPdfTextFromBlob } from '../assets/resume.js';
import { compareJobWithResume } from '../ai/gemini.js';
import { formatJobMessage, sendSlackMessageIfGood } from '../integrate/slack.js';

export async function main() {
  console.log("--- Running scheduled job analysis ---");

  try {
    // 1️⃣ Scrape jobs from Seek
    const seekJobs = await scrapeSeekJobs();
    console.log(`Found ${seekJobs.length} new Seek jobs`);

    // // 2️⃣ Scrape jobs from LinkedIn
    // const linkedInJobs = await scrapeLinkedInJobs();
    // console.log(`Found ${linkedInJobs.length} new LinkedIn jobs`);

    // Combine all jobs
    const allJobs = [...seekJobs]//, ...linkedInJobs];
    if (!allJobs.length) {
      console.log("No new jobs to process.");
      return;
    }

    // 3️⃣ Extract resume text from Azure Blob
    console.log("Extracting PDF text from resume...");
    const resumeText = await extractPdfTextFromBlob();

    // 4️⃣ Analyze and send Slack notifications
    for (let job of allJobs) {
      console.log(`Analyzing: ${job.title} at ${job.company}`);
      const aiResult = await compareJobWithResume(job, resumeText);
      const message = formatJobMessage(job, aiResult);

      try {
        await sendSlackMessageIfGood(aiResult, message);
        console.log(`Processed Slack message for: ${job.title}`);
      } catch (err) {
        console.error(`Error sending Slack message for ${job.title}:`, err.message);
      }
    }

  } catch (err) {
    console.error("Error during scheduled job analysis:", err);
  }
}
