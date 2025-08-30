// src/extract/helpers/humanBehavior.js
export const randomDelay = (min, max) =>
  new Promise(res => setTimeout(res, min + Math.random() * (max - min)));

export async function humanMouseMove(page, steps = 20) {
    const viewport = page.viewport();
    for (let i = 0; i < steps; i++) {
        const x = Math.floor(Math.random() * viewport.width);
        const y = Math.floor(Math.random() * viewport.height);
        await page.mouse.move(x, y, { steps: 2 + Math.floor(Math.random() * 3) });
        // Micro jitter
        await page.mouse.move(x + Math.random() * 5, y + Math.random() * 5, { steps: 1 });
        await randomDelay(50, 150);
    }
}

export async function humanScroll(page, times = 3) {
    const totalScrolls = times + Math.floor(Math.random() * 3);
    for (let i = 0; i < totalScrolls; i++) {
        const scrollBy = 200 + Math.floor(Math.random() * 300);
        await page.evaluate(y => window.scrollBy(0, y), scrollBy);
        // Random scroll up occasionally
        if (Math.random() < 0.2) await page.evaluate(y => window.scrollBy(0, -y / 2), scrollBy);
        await randomDelay(500, 1500);
    }
}

export async function humanHover(page, selector) {
    try {
        const el = await page.$(selector);
        if (el) {
            const box = await el.boundingBox();
            if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
            await randomDelay(300, 700);
        }
    } catch {}
}

export async function humanClickRandomly(page) {
    if (Math.random() < 0.1) { // 10% chance
        const viewport = page.viewport();
        const x = Math.floor(Math.random() * viewport.width);
        const y = Math.floor(Math.random() * viewport.height);
        await page.mouse.click(x, y, { delay: 50 + Math.random() * 150 });
        await randomDelay(500, 1000);
    }
}

export async function humanReadText(page, selector, minTime = 1000, maxTime = 3000) {
    try {
        const el = await page.$(selector);
        if (!el) return;
        const text = await page.evaluate(el => el.innerText, el);
        const readTime = Math.min(Math.max(text.length * (50 + Math.random() * 50), minTime), maxTime);
        await randomDelay(readTime, readTime + 500);
    } catch {}
}

export async function humanType(page, selector, text) {
    try {
        const el = await page.$(selector);
        if (!el) return;
        for (const char of text) {
            await el.type(char, { delay: 80 + Math.random() * 100 });
        }
        await randomDelay(200, 500);
    } catch {}
}

export async function humanTabSwitch(page) {
    if (Math.random() < 0.05) { // 5% chance to switch tab
        await page.keyboard.down('Control');
        await page.keyboard.press('Tab');
        await page.keyboard.up('Control');
        await randomDelay(1000, 2000);
    }
}

export async function humanInteract(page, scrollTimes = 3, descriptionSelector = null) {
    await humanMouseMove(page, 10 + Math.floor(Math.random() * 10));
    await humanScroll(page, scrollTimes);
    await humanClickRandomly(page);
    if (descriptionSelector) await humanReadText(page, descriptionSelector);
    await humanTabSwitch(page);
    await randomDelay(800, 2000);
}
