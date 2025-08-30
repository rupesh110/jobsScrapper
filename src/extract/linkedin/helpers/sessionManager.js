import fs from 'fs';
import { loginLinkedIn } from "../saveLinkedInProfile.js";

const COOKIE_PATH = './src/extract/linkedin/linkedin-cookies.json';

export async function ensureSession(page) {
  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    const usernameInput = await page.$('#username');
    if (usernameInput) {
      console.log('LinkedIn session expired, logging in again...');
      await loginLinkedIn(true);
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    }
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
