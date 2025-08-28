import { main } from "./src/scripts/main.js";

const INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes
const START_HOUR = 7;  // 7 AM Sydney time
const END_HOUR = 17;   // 5 PM Sydney time

async function runRepeatedly() {
    console.log(`Starting job/resume analysis every ${INTERVAL_MS / 60000} minutes, only between ${START_HOUR}:00 and ${END_HOUR}:00 Sydney time.`);

    while (true) {
        // Get current Sydney hour directly
        const now = new Date();
        const currentHour = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: 'numeric', hour12: false }).format(now);
        const currentHourNum = Number(currentHour);

        const currentTime = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);

        if (currentHourNum >= START_HOUR && currentHourNum < END_HOUR) {
            console.log(`\n--- Running analysis at ${currentTime} Sydney ---`);
            try {
                await main();
                console.log("Run completed successfully.");
            } catch (err) {
                console.error("Run failed:", err);
            }
        } else {
            console.log(`\n--- Outside working hours (${currentTime} Sydney) — skipping run ---`);
        }

        await new Promise(res => setTimeout(res, INTERVAL_MS));
    }
}

runRepeatedly();
