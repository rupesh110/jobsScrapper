import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
dotenv.config();

puppeteer.use(StealthPlugin());

const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL || "rupeshshresthatech@gmail.com";
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD || "Bankstown@110"; 

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: './linkedin-profile', // persist session
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });

  const page = await browser.newPage();
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  // Only type if first login
  const usernameInput = await page.$('#username');
  if (usernameInput) {
    await page.type('#username', LINKEDIN_EMAIL, { delay: 100 });
    await page.type('#password', LINKEDIN_PASSWORD, { delay: 100 });
    await page.click('button[type="submit"]');
  }

  console.log('Solve any puzzle manually if prompted...');
  await page.waitForSelector('#global-nav', { timeout: 0 }); // wait until fully logged in

  console.log('LinkedIn login complete. Browser profile saved!');
  await browser.close();
})();
