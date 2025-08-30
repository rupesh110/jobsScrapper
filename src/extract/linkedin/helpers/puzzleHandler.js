
const delay = ms => new Promise(res => setTimeout(res, ms));

export async function checkForPuzzle(page) {
  const selectors = [
    'form[action*="checkpoint"]',
    '.captcha-internal',
    '#input__email_verification_pin'
  ];
  for (const sel of selectors) if (await page.$(sel)) return true;
  return false;
}

export async function handlePuzzleWithWait(page, sendSlack, context = 'page/job') {
  if (await checkForPuzzle(page)) {
    const message = `LinkedIn puzzle detected on ${context}. Please check manually. Waiting 30s.`;
    console.warn(message);
    await sendSlack(message);
    await delay(30000);
    return true;
  }
  return false;
}
