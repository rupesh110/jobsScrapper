// loginGmail.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import dotenv from 'dotenv';
import { sendSlackMessageVmRunning } from '../../integrate/slack.js';

dotenv.config();
puppeteer.use(StealthPlugin());

const GMAIL_EMAIL = process.env.GMAIL_EMAIL || "rupeshshresthatech@gmail.com";
const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD || "Bankstown@110";
const COOKIES_PATH = './src/extract/gmail-cookies.json';
const USER_DATA_DIR = './src/extract/gmail-profile';
const delay = ms => new Promise(res => setTimeout(res, ms));

async function handlePuzzle(page, context = 'Gmail login') {
  const selectors = [
    'form[action*="challenge"]',
    '#captchaimg',
    '#identifierId'
  ];
  for (const sel of selectors) {
    if (await page.$(sel)) {
      const msg = `Gmail puzzle detected on ${context}. Please check manually. Waiting 30s.`;
      console.warn(msg);
      await sendSlackMessageVmRunning(msg);
      await delay(30000);
      return true;
    }
  }
  return false;
}

export async function loginGmail(headless = false) {
  const browser = await puppeteer.launch({
    headless:false,
    userDataDir: USER_DATA_DIR,
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

  // Load cookies if they exist
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH));
    await page.setCookie(...cookies);
    console.log('Loaded Gmail cookies from backup file.');
  }

  await page.goto('https://accounts.google.com/signin', { waitUntil: 'domcontentloaded' });

  // Check if login is needed
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    console.log('Logging into Gmail...');
    await page.type('input[type="email"]', GMAIL_EMAIL, { delay: 200 });
    await page.click('#identifierNext');
    await delay(2000);


    const passwordInput = await page.$('input[type="password"]');
    if (passwordInput) {
      await page.type('input[type="password"]', GMAIL_PASSWORD, { delay: 200 });
      await page.click('#passwordNext');
    }
  } else {
    console.log('Existing Gmail session found — skipping login form.');
  }

  // Wait for inbox or manual verification
  console.log('Waiting for Gmail to load. Solve any puzzle manually if prompted...');
  await page.waitForSelector('div[role="main"]', { timeout: 0 }); // Inbox loaded

  // Save cookies for next session
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  console.log('Gmail cookies saved to', COOKIES_PATH);

  await browser.close();
  console.log('Gmail login complete. Session persisted!');
}
