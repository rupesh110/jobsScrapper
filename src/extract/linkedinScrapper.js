import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { hasVisited, markVisited, getAllJobs } from '../data/index.js';
import dotenv from 'dotenv';
dotenv.config();

puppeteer.use(StealthPlugin());

export async function scrapeLinkedInJobs() {
  const allJobs = await getAllJobs();
  console.log(`Loaded ${allJobs.length} jobs into local DB from Cosmos`);

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: './linkedin-profile', // use saved session
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const urls = [
    'https://www.linkedin.com/jobs/search/?keywords=software%20engineer&f_TPR=r3600',
  ];

  const newJobs = [];
  const seenUrls = new Set();

  for (const url of urls) {
    console.log("Opening search URL:", url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.waitForSelector('li[data-occludable-job-id]', { timeout: 60000 });
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));

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

      try {
        await page.goto(cleanUrl, { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight / 2));

        job.description = await page.evaluate(() => {
          const descEl = document.querySelector('.jobs-description__container');
          return descEl ? descEl.innerText.trim() : 'No description available';
        });

        markVisited({ ...job, url: cleanUrl });
        newJobs.push({ ...job, url: cleanUrl });
        console.log(`Fetched job: ${job.title} at ${job.company}`);
      } catch (err) {
        console.warn(`Failed to fetch ${job.title} at ${job.company}:`, err.message);
        job.description = 'Failed to load description';
      }
    }
  }

  await browser.close();
  return newJobs;
}
