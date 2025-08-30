// navigation.js
const delay = ms => new Promise(res => setTimeout(res, ms));

export async function safeGoto(page, url, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      return true;
    } catch (err) {
      attempt++;
      console.warn(`Navigation failed ${url}, attempt ${attempt}: ${err.message}`);
      if (attempt > maxRetries) return false;
      await delay(5000);
    }
  }
}
export { delay };
