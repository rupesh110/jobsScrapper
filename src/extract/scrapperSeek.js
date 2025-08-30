// src/extract/scrapperSeek.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { hasVisited, markVisited, getAllJobs } from '../data/index.js';
import { enqueueJob } from '../data/queuedb.js';

puppeteer.use(StealthPlugin());

function normalizeUrl(url) {
  return url ? url.split('#')[0].split('?')[0] : '';
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function scrapeJobs() {
  const allJobs = await getAllJobs();
  console.log(`Loaded ${allJobs.length} jobs into local DB from Cosmos`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
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
    'https://www.seek.com.au/software-developer-jobs?daterange=1',
    'https://www.seek.com.au/software-developer-jobs'
  ];

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

    // Scroll a bit to load more jobs
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
    console.log(`Top ${jobs.length} jobs from ${url}`);

    for (let job of jobs) {
      const cleanUrl = normalizeUrl(job.url);
      if (!cleanUrl || hasVisited(cleanUrl)) continue;

      markVisited({ ...job, url: cleanUrl });

      try {
        await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait explicitly for job description container
        try {
          await page.waitForSelector(
            'div[data-automation="jobAdDetails"], .job-description, div[data-automation="jobAd"]',
            { timeout: 15000 }
          );
        } catch {
          console.warn(`Description container not found for ${job.title}`);
        }

        const description = await page.evaluate(() => {
          const el = document.querySelector('div[data-automation="jobAdDetails"]') ||
                     document.querySelector('.job-description') ||
                     document.querySelector('div[data-automation="jobAd"]');
          return el ? el.innerText.trim() : 'No description available';
        });

        job.description = description;
        enqueueJob({ ...job, url: cleanUrl, description });
        // console.log("-------------------------------------------------------------------------------------------");
        // console.log(`Queued job from seek: ${job.title} at ${job.company}, ${description}`);
        // console.log("-------------------------------------------------------------------------------------------");

      } catch (err) {
        console.warn(`Failed to fetch description for ${job.title}: ${err.message}`);
        enqueueJob({ ...job, url: cleanUrl, description: 'No description available' });
      }

      // Random delay to simulate human behavior
      await sleep(1000 + Math.random() * 1500);
    }
  }

  await browser.close();
  console.log('Seek scraping complete.');
}
