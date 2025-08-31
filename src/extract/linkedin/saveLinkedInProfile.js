// src/extract/linkedin/linkedinScrapper.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config();
puppeteer.use(StealthPlugin());

// ---------------- Path Setup ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COOKIES_PATH = resolve(__dirname, 'linkedin-cookies.json');
const USER_PROFILE_PATH = resolve(__dirname, 'linkedin-profile');

// Ensure profile folder exists
if (!fs.existsSync(USER_PROFILE_PATH)) fs.mkdirSync(USER_PROFILE_PATH, { recursive: true });

// ---------------- LinkedIn Credentials ----------------
const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL || "rupeshshresthatech@gmail.com";
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD || "Bankstown@110";

if (!LINKEDIN_EMAIL || !LINKEDIN_PASSWORD) {
  throw new Error("Please set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in your .env file");
}

// ---------------- LinkedIn Login ----------------
export async function loginLinkedIn(headless = false) {
  const browser = await puppeteer.launch({
    headless:false,
    userDataDir: USER_PROFILE_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ]
  });

  const page = await browser.newPage();

  // Load cookies if available
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
    await page.setCookie(...cookies);
    console.log('Loaded cookies from backup file.');
  }

  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  const usernameInput = await page.$('#username');
  if (usernameInput) {
    console.log('Logging into LinkedIn...');
    await page.type('#username', LINKEDIN_EMAIL, { delay: 100 });
    await page.type('#password', LINKEDIN_PASSWORD, { delay: 100 });
    await page.click('button[type="submit"]');
  } else {
    console.log('Existing LinkedIn session detected — skipping login form.');
  }

  console.log('Solve any CAPTCHA or verification manually if prompted...');
  await page.waitForSelector('#global-nav', { timeout: 0 });

  // Save cookies after login
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  console.log('Cookies saved to', COOKIES_PATH);

  await browser.close();
  console.log('LinkedIn login complete. Session persisted!');
}

// ---------------- Job Scraping Example ----------------
export async function scrapeLinkedInJobs(headless = true) {
  await loginLinkedIn(headless);

  const browser = await puppeteer.launch({
    headless,
    userDataDir: USER_PROFILE_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ]
  });

  const page = await browser.newPage();

  // Example: navigate to LinkedIn job search
  await page.goto('https://www.linkedin.com/jobs/search/?keywords=software%20developer', { waitUntil: 'domcontentloaded' });

  console.log('LinkedIn jobs page loaded. You can now extract job cards or links.');

  // Example: extract job titles (simplified)
  const jobs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.base-card__title')).map(el => el.textContent.trim());
  });

  console.log('Jobs found:', jobs.length);
  console.log(jobs);

  await browser.close();
}
