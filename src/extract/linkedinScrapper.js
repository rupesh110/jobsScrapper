import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { hasVisited, markVisited, getAllJobs } from '../data/index.js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

puppeteer.use(StealthPlugin());

const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL;
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD;
const COOKIE_PATH = './linkedin_cookies.json';

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15'
];
const randomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function safeGoto(page, url, retries = 3) {
  while (retries > 0) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      return;
    } catch (err) {
      retries--;
      console.log(`Failed to load ${url}, retries left: ${retries}`);
      if (retries === 0) throw err;
      await delay(2000 + Math.random() * 2000);
    }
  }
}

function normalizeUrl(url) {
  return url ? url.split('#')[0].split('?')[0] : '';
}

export async function scrapeLinkedInJobs(headless = true) {
  const allJobs = await getAllJobs();
  console.log(`Loaded ${allJobs.length} jobs into local DB from Cosmos`);

  const browser = await puppeteer.launch({
    headless, // true for VM / cloud, false for local debug
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent(randomUserAgent());

  console.log("Opening LinkedIn...");

  // Load cookies if they exist
  if (fs.existsSync(COOKIE_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf-8'));
    await page.setCookie(...cookies);
    console.log('Loaded LinkedIn cookies, skipping login.');
    await safeGoto(page, 'https://www.linkedin.com/feed/');
    await page.waitForTimeout(3000); // wait a bit for page to load
  } else {
    await safeGoto(page, 'https://www.linkedin.com/login');

    // Handle pre-login popups
    const popupSelectors = ['button[aria-label="Dismiss"]', 'button[aria-label="Close"]', 'button.artdeco-dismiss'];
    for (const sel of popupSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        console.log(`Closing popup: ${sel}`);
        await btn.click();
        await delay(1000);
        break;
      }
    }

    // Type credentials
    await page.type('#username', LINKEDIN_EMAIL, { delay: 100 });
    await page.type('#password', LINKEDIN_PASSWORD, { delay: 100 });
    await page.click('button[type="submit"]');

    try {
      await page.waitForSelector('input[placeholder="Search"]', { timeout: 120000 });
      console.log("Logged in successfully!");

      // Save cookies for future runs
      const cookies = await page.cookies();
      fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
      console.log("Saved LinkedIn cookies for future runs.");
    } catch (err) {
      console.error("Login may have failed or took too long. Exiting scraper.");
      await browser.close();
      return [];
    }
  }

  // --- LinkedIn job search URLs ---
  const urls = [
    'https://www.linkedin.com/jobs/search/?keywords=software%20engineer&f_TPR=r3600',
  ];

  const newJobs = [];
  const seenUrls = new Set();

  for (const url of urls) {
    console.log("Opening search URL:", url);
    await safeGoto(page, url);
    await page.waitForSelector('li[data-occludable-job-id]', { timeout: 60000 });
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await delay(1500);

    const jobs = await page.evaluate(() => {
      const cards = document.querySelectorAll('li[data-occludable-job-id]');
      return Array.from(cards).slice(0, 10).map(card => {
        const linkEl = card.querySelector('a.job-card-container__link');
        const companyEl = card.querySelector('div.artdeco-entity-lockup__subtitle span');
        return {
          title: linkEl?.innerText.trim() || 'No title',
          company: companyEl?.innerText.trim() || 'No company',
          url: linkEl ? linkEl.href : ''
        };
      });
    });

    for (let job of jobs) {
      const cleanUrl = normalizeUrl(job.url);
      if (hasVisited(cleanUrl) || seenUrls.has(cleanUrl)) continue;
      seenUrls.add(cleanUrl);

      try {
        const jobPage = await browser.newPage();
        await jobPage.setUserAgent(randomUserAgent());
        await delay(1000 + Math.random() * 2000);
        await safeGoto(jobPage, job.url);

        await jobPage.evaluate(() => window.scrollBy(0, document.body.scrollHeight / 2));
        await delay(1000 + Math.random() * 2000);

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
