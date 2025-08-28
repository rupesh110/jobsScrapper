import { main } from "./src/scripts/main.js";

const INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes
const START_HOUR = 7;  // 7 AM
const END_HOUR = 17;   // 5 PM

async function runRepeatedly() {
    console.log(`Starting job/resume analysis every ${INTERVAL_MS / 60000} minutes, only between ${START_HOUR}:00 and ${END_HOUR}:00.`);

    while (true) {
        const now = new Date();
        const currentHour = now.getHours();

        if (currentHour >= START_HOUR && currentHour < END_HOUR) {
            console.log(`\n--- Running analysis at ${now.toLocaleTimeString()} ---`);
            try {
                await main();
                console.log("Run completed successfully.");
            } catch (err) {
                console.error("Run failed:", err);
            }
        } else {
            console.log(`\n--- Outside working hours (${now.toLocaleTimeString()}) — skipping run ---`);
        }

        // Wait for the interval before checking again
        await new Promise(res => setTimeout(res, INTERVAL_MS));
    }
}

runRepeatedly();
