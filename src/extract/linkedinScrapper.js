import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { hasVisited, markVisited, getAllJobs } from '../data/index.js';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

puppeteer.use(StealthPlugin());

const COOKIE_PATH = path.resolve('./src/extract/linkedin-cookies.json');

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15'
];

const randomUserAgent = () => userAgents[Math.floor(Math.random() * userAgents.length)];
const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function safeGoto(page, url, retries = 3) {
  if (!url) throw new Error('Cannot navigate to empty URL');
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

  if (!fs.existsSync(COOKIE_PATH)) {
    console.error('Cookies file not found! Please upload linkedin-cookies.json.');
    return [];
  }

  const browser = await puppeteer.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--single-process',             
      '--disable-background-networking',
      '--disable-renderer-backgrounding'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent(randomUserAgent());

  // Load cookies
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf-8'));
  await page.setCookie(...cookies);
  console.log('Loaded LinkedIn cookies.');

  await safeGoto(page, 'https://www.linkedin.com/feed/');
  await delay(3000);

  if (page.url().includes('/login')) {
    console.warn('Cookies are expired or invalid. Please upload fresh cookies.');
    await browser.close();
    return [];
  }

  console.log('Successfully logged in via cookies.');

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
      console.log(job)
      const cleanUrl = normalizeUrl(job.url);
      if (!cleanUrl) {
        console.warn(`Skipping job "${job.title}" because URL is invalid or empty.`);
        continue;
      }
      if (hasVisited(cleanUrl) || seenUrls.has(cleanUrl)) continue;
      seenUrls.add(cleanUrl);

      try {
        await safeGoto(page, cleanUrl);
        await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight / 2));
        await delay(1000 + Math.random() * 2000);

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
