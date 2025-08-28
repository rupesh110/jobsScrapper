import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { hasVisited, markVisited, getAllJobs } from '../data/index.js';

puppeteer.use(StealthPlugin());

function normalizeUrl(url) {
  return url ? url.split('#')[0].split('?')[0] : '';
}

// Helper sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function scrapeJobs() {
  const allJobs = await getAllJobs();
  console.log(`Loaded ${allJobs.length} jobs into local DB from Cosmos`);

  const browser = await puppeteer.launch({
    headless: "new", // <-- run headless on cloud VM
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer"
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:119.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15'
  ];
  await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);

  const urls = [
    'https://www.seek.com.au/software-developer-jobs?daterange=1'
  ];

  const newJobs = [];
  const seenUrls = new Set();

  for (const url of urls) {
    console.log("Opening:", url);

    let retries = 3;
    while (retries > 0) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        break;
      } catch (err) {
        console.warn(`Failed to load ${url}, retries left: ${retries - 1}`);
        retries--;
        if (retries === 0) throw err;
      }
    }

    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await sleep(1500);

    let jobs = await page.evaluate(() => {
      const cards = document.querySelectorAll('article[data-automation="normalJob"]');
      return Array.from(cards).map(card => {
        const title = card.querySelector('a[data-automation="jobTitle"]')?.innerText || 'No title';
        const company = card.querySelector('a[data-automation="jobCompany"]')?.innerText || 'No company';
        const url = card.querySelector('a[data-automation="jobTitle"]')?.href || '';
        return { title, company, url };
      });
    });

    jobs = jobs.slice(0, 20);
    console.log(`Top ${jobs.length} jobs from ${url}:`, jobs);

    for (let job of jobs) {
      const cleanUrl = normalizeUrl(job.url);

      if (hasVisited(cleanUrl) || seenUrls.has(cleanUrl)) {
        console.log(`Skipping already visited job: ${job.title}`);
        continue;
      }
      seenUrls.add(cleanUrl);

      try {
        const jobPage = await browser.newPage();
        await jobPage.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
        await jobPage.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await jobPage.evaluate(() => window.scrollBy(0, window.innerHeight / 2));
        await sleep(1000 + Math.random() * 2000);

        job.description = await jobPage.evaluate(() => {
          const descEl = document.querySelector('[data-automation="jobAdDetails"]');
          return descEl ? descEl.innerText.trim() : 'No description available';
        });

        markVisited({ ...job, url: cleanUrl });
        newJobs.push({ ...job, url: cleanUrl });

        console.log(`Fetched description for: ${job.title}`);
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

// (async () => {
//   const jobs = await scrapeJobs();
//   console.log("Total new jobs scraped:", jobs.length);
// })();
