// src/extract/linkedin/linkedinScraper.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { hasVisited, markVisited, getAllJobs } from '../../data/index.js';
import { enqueueJob } from '../../data/queuedb.js';
import { sendSlackMessageVmRunning } from '../../integrate/slack.js';
import { ensureSession } from './helpers/sessionManager.js';
import { safeGoto } from './helpers/navigation.js';
import { handlePuzzleWithWait } from './helpers/puzzleHandler.js';
import { humanInteract } from './helpers/humanBehavior.js';
import { visitRandomPage } from './helpers/randomVisits.js';

puppeteer.use(StealthPlugin());

export async function scrapeLinkedInJobs() {
  const allJobs = await getAllJobs();
  console.log(`Loaded ${allJobs.length} jobs into local DB from Cosmos.`);

  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: './src/extract/linkedin/linkedin-profile',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await ensureSession(page);

  const urls = [
    'https://www.linkedin.com/jobs/search/?keywords=software%20engineer&f_TPR=r3600'
  ];

  const seenUrls = new Set();

  for (const url of urls) {
    console.log("Opening search URL:", url);
    const searchLoaded = await safeGoto(page, url);
    if (!searchLoaded || await handlePuzzleWithWait(page, sendSlackMessageVmRunning, 'search page')) continue;

    try {
      await page.waitForSelector('li[data-occludable-job-id]', { timeout: 15000 });
    } catch {
      console.warn('No job listings found or page load failed.');
      continue;
    }

    // Perform human-like actions on search results
    await humanInteract(page, 4); 

    const jobs = await page.evaluate(() => {
      const cards = document.querySelectorAll('li[data-occludable-job-id]');
      return Array.from(cards).slice(0, 20).map(card => {
        const linkEl = card.querySelector('a.job-card-container__link');
        const companyEl = card.querySelector('div.artdeco-entity-lockup__subtitle span');
        return {
          title: linkEl?.innerText.trim() || 'No title',
          company: companyEl?.innerText.trim() || 'No company',
          url: linkEl?.href || ''
        };
      });
    });

    for (let job of jobs) {
      const cleanUrl = job.url.split('#')[0].split('?')[0];
      if (!cleanUrl || hasVisited(cleanUrl) || seenUrls.has(cleanUrl)) continue;
      seenUrls.add(cleanUrl);

      const jobLoaded = await safeGoto(page, cleanUrl);
      if (!jobLoaded || await handlePuzzleWithWait(page, sendSlackMessageVmRunning, `job ${job.title}`)) {
        console.log('Session may have expired. Re-logging in...');
        await ensureSession(page); 
        await safeGoto(page, cleanUrl);
      }

      try {
        await page.waitForSelector('.jobs-description__container', { timeout: 15000 });
      } catch {
        console.warn(`No description container for ${job.title}`);
      }

      // Human-like interaction on job page
      await humanInteract(page, 5);

      job.description = await page.evaluate(() => {
        const descEl = document.querySelector('.jobs-description__container');
        return descEl ? descEl.innerText.trim() : 'No description available';
      });

      markVisited({ ...job, url: cleanUrl });
      enqueueJob({ ...job, url: cleanUrl }); // enqueue directly
      console.log(`Queued job: ${job.title} at ${job.company}`);

      // Chance to visit random LinkedIn pages
      await visitRandomPage(page, 0.3, 3); 
    }
  }

  await browser.close();
}
