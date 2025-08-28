import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

puppeteer.use(StealthPlugin());

const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL || "rupeshshresthatech@gmail.com";
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD || "Bankstown@110"; 
(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log("Opening LinkedIn login...");
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  await page.type('#username', LINKEDIN_EMAIL, { delay: 100 });
  await page.type('#password', LINKEDIN_PASSWORD, { delay: 100 });
  await page.click('button[type="submit"]');

  // Wait until login completes
  await page.waitForSelector('input[placeholder="Search"]', { timeout: 120000 });
  console.log('Logged in successfully!');

  // Save cookies
  const cookies = await page.cookies();
  await fs.promises.writeFile('linkedin-cookies.json', JSON.stringify(cookies, null, 2));
  console.log('Cookies saved!');

  await browser.close();
})();
