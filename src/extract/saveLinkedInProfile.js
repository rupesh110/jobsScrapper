import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();
puppeteer.use(StealthPlugin());

const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL || "rupeshshresthatech@gmail.com";
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD || "Bankstown@110";
const COOKIES_PATH = './linkedin-cookies.json';

export async function loginLinkedIn(headless = false) {
  const browser = await puppeteer.launch({
    headless,
    userDataDir: './linkedin-profile',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();

  // Load cookies if they exist (extra safeguard)
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
    console.log('Existing LinkedIn session found — skipping login form.');
  }

  console.log('Solve any puzzle manually if prompted...');
  await page.waitForSelector('#global-nav', { timeout: 0 });

  // Save cookies as backup
  const cookies = await page.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  console.log('Cookies saved to', COOKIES_PATH);

  console.log('LinkedIn login complete. Session persisted!');
  await browser.close();
}
