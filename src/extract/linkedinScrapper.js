import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import dotenv from 'dotenv';
import { hasVisited, markVisited, getAllJobs } from '../data/index.js';
import { sendSlackMessageVmRunning } from '../integrate/slack.js';
import { loginLinkedIn } from './saveLinkedInProfile.js';

dotenv.config();
puppeteer.use(StealthPlugin());

const COOKIE_PATH = './src/extract/linkedin-cookies.json';
const USER_DATA_DIR = './src/extract/linkedin-profile';
const delay = ms => new Promise(res => setTimeout(res, ms));

// ---------------- Puzzle Handling ----------------
async function checkForPuzzle(page) {
  const puzzleSelectors = [
    'form[action*="checkpoint"]',
    '.captcha-internal',
    '#input__email_verification_pin'
  ];
  for (const sel of puzzleSelectors) if (await page.$(sel)) return true;
  return false;
}

async function handlePuzzleWithWait(page, context = 'page/job') {
  if (await checkForPuzzle(page)) {
    const message = `LinkedIn puzzle detected on ${context}. Please check manually. Waiting 30s.`;
    console.warn(message);
    await sendSlackMessageVmRunning(message);
    await delay(30000);
    return true;
  }
  return false;
}

// ---------------- Safe Navigation ----------------
async function safeGoto(page, url, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); return true; }
    catch (err) { attempt++; console.warn(`Navigation failed ${url}, attempt ${attempt}: ${err.message}`); if (attempt>maxRetries) return false; await delay(5000); }
  }
}

// ---------------- Ensure Session / Login ----------------
async function ensureSession(page) {
  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    
    const usernameInput = await page.$('#username');
    if (usernameInput) {
      console.log('LinkedIn session expired, logging in again...');
      await loginLinkedIn(true);
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    }

    // Restore cookies if session exists
    if (fs.existsSync(COOKIE_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH));
      await page.setCookie(...cookies);
      console.log('Cookies restored for scraping.');
    }
  } catch (err) {
    console.warn('Failed to ensure session. Logging in again...', err.message);
    await loginLinkedIn(true);
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
  }
}

// ---------------- Main Scraper ----------------
export async function scrapeLinkedInJobs() {
  const allJobs = await getAllJobs();
  console.log(`Loaded ${allJobs.length} jobs into local DB from Cosmos.`);

  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: USER_DATA_DIR,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas', '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // ---------------- Ensure login/session ----------------
  await ensureSession(page);

  const urls = [
    'https://www.linkedin.com/jobs/search/?keywords=software%20engineer&f_TPR=r3600'
  ];

  const newJobs = [];
  const seenUrls = new Set();

  for (const url of urls) {
    console.log("Opening search URL:", url);
    const searchLoaded = await safeGoto(page, url);
    if (!searchLoaded || await handlePuzzleWithWait(page, 'search page')) continue;

    try { await page.waitForSelector('li[data-occludable-job-id]', { timeout: 15000 }); }
    catch { console.warn('No job listings found or page load failed.'); continue; }

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
      const cleanUrl = job.url.split('#')[0].split('?')[0];
      if (!cleanUrl || hasVisited(cleanUrl) || seenUrls.has(cleanUrl)) continue;
      seenUrls.add(cleanUrl);

      const jobLoaded = await safeGoto(page, cleanUrl);
      if (!jobLoaded || await handlePuzzleWithWait(page, `job ${job.title}`)) {
        console.log('Session may have expired. Re-logging in...');
        await loginLinkedIn(true);
        await safeGoto(page, cleanUrl);
      }

      try { await page.waitForSelector('.jobs-description__container', { timeout: 15000 }); }
      catch { console.warn(`No description container for ${job.title}`); }

      await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight / 2));
      job.description = await page.evaluate(() => {
        const descEl = document.querySelector('.jobs-description__container');
        return descEl ? descEl.innerText.trim() : 'No description available';
      });

      markVisited({ ...job, url: cleanUrl });
      newJobs.push({ ...job, url: cleanUrl });
      console.log(`Fetched job: ${job.title} at ${job.company}`);
      await delay(2000);
    }
  }

  await browser.close();
  return newJobs;
}
