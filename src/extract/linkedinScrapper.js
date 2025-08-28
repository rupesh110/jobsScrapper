import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { hasVisited, markVisited, getAllJobs } from '../data/index.js';
import dotenv from 'dotenv';
dotenv.config();

puppeteer.use(StealthPlugin());

const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL;
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD;

function normalizeUrl(url) {
  return url ? url.split('#')[0].split('?')[0] : '';
}

// User agents for random rotation
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15'
];
const randomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];

export async function scrapeLinkedInJobs() {
  const allJobs = await getAllJobs();
  console.log(`Loaded ${allJobs.length} jobs into local DB from Cosmos`);

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent(randomUserAgent());

  console.log("Opening LinkedIn login...");
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  // --- Handle potential pre-login popup ---
  try {
    const popupCloseSelectors = [
      'button[aria-label="Dismiss"]',
      'button[aria-label="Close"]',
      'button.artdeco-dismiss'
    ];

    for (const sel of popupCloseSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        console.log(`Pre-login popup detected, clicking ${sel}...`);
        await btn.click();
        await page.waitForTimeout(1000);
        break;
      }
    }
  } catch (err) {
    console.log("No pre-login popup detected, continuing...");
  }

  // --- Type credentials ---
  await page.type('#username', LINKEDIN_EMAIL, { delay: 100 });
  await page.type('#password', LINKEDIN_PASSWORD, { delay: 100 });
  await page.click('button[type="submit"]');

  // Wait for post-login element
  await page.waitForSelector('input[placeholder="Search"]', { timeout: 120000 });
  console.log("Logged in successfully!");

  // --- LinkedIn search URLs ---
  const urls = [
    'https://www.linkedin.com/jobs/search/?keywords=software%20engineer&f_TPR=r3600',
  ];

  const newJobs = [];
  const seenUrls = new Set();

  for (const url of urls) {
    console.log("Opening search URL:", url);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('a.job-card-container__link', { timeout: 60000 });
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await new Promise(r => setTimeout(r, 1500));

    const jobs = await page.evaluate(() => {
      const jobCards = document.querySelectorAll('li[data-occludable-job-id]');
      return Array.from(jobCards).slice(0, 10).map(card => {
        const linkEl = card.querySelector('a.job-card-container__link');
        const companyEl = card.querySelector('div.artdeco-entity-lockup__subtitle span');

        const title = linkEl?.innerText.trim() || 'No title';
        const company = companyEl?.innerText.trim() || 'No company';
        const url = linkEl ? linkEl.href : '';

        return { title, company, url };
      });
    });

    for (let job of jobs) {
      const cleanUrl = normalizeUrl(job.url);
      if (hasVisited(cleanUrl) || seenUrls.has(cleanUrl)) {
        console.log(`Skipping already visited job: ${job.title}`);
        continue;
      }

      seenUrls.add(cleanUrl);

      try {
        const jobPage = await browser.newPage();
        await jobPage.setUserAgent(randomUserAgent());
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        await jobPage.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await jobPage.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

        job.description = await jobPage.evaluate(() => {
          const descEl = document.querySelector('.jobs-description__container');
          return descEl ? descEl.innerText.trim() : 'No description available';
        });

        markVisited({ ...job, url: cleanUrl });
        newJobs.push({ ...job, url: cleanUrl });

        console.log(`Fetched job: ${job.title} at ${job.company}`);
        await jobPage.close();
      } catch (err) {
        console.warn(`Failed to fetch ${job.url}:`, err.message);
        job.description = 'Failed to load description';
      }
    }
  }

  await browser.close();
  return newJobs;
}
