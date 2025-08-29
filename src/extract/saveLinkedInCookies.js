import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

puppeteer.use(StealthPlugin());

const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL ||"rupeshshresthatech@gmail.com" ;
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD ||"Bankstown@110"; 
const COOKIE_PATH = './linkedin-cookies.json';

(async () => {
const browser = await puppeteer.launch({
  headless: false,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process', // maybe needed for small VMs
    '--disable-gpu'
  ]
});

  const page = await browser.newPage();

  console.log("Open LinkedIn login...");
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  // Only fill if first time
  if (!fs.existsSync(COOKIE_PATH)) {
    await page.type('#username', LINKEDIN_EMAIL, { delay: 100 });
    await page.type('#password', LINKEDIN_PASSWORD, { delay: 100 });
    await page.click('button[type="submit"]');
  }

  // Wait for manual puzzle completion
  console.log('Solve any puzzle manually if prompted...');
  await page.waitForSelector('#global-nav', { timeout: 0 }); // wait until fully logged in

  // Save cookies after login
  const cookies = await page.cookies();
  await fs.promises.writeFile(COOKIE_PATH, JSON.stringify(cookies, null, 2));
  console.log('Cookies saved successfully!');

  await browser.close();
})();
