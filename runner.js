import { main } from "./src/scripts/main.js";

const START_HOUR = 7;  // 7 AM Sydney time
const END_HOUR = 18;   // 6 PM Sydney time

function getRandomInterval() {
    const minMinutes = 25;
    const maxMinutes = 35;
    const minutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
    return minutes * 60 * 1000; // convert to milliseconds
}

async function runRepeatedly() {
    console.log(`Starting job/resume analysis with random intervals between 25-35 minutes, only between ${START_HOUR}:00 and ${END_HOUR}:00 Sydney time.`);

    while (true) {
        const now = new Date();
        const currentHour = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: 'numeric', hour12: false }).format(now);
        const currentHourNum = Number(currentHour);

        const currentTime = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);

        // if (currentHourNum >= START_HOUR && currentHourNum < END_HOUR) {
        //     console.log(`\n--- Running analysis at ${currentTime} Sydney ---`);
        //     try {
        //         await main();
        //         console.log("Run completed successfully.");
        //     } catch (err) {
        //         console.error("Run failed:", err);
        //     }
        // } else {
        //     console.log(`\n--- Outside working hours (${currentTime} Sydney) — skipping run ---`);
        // }

                 try {
                await main();
                console.log("Run completed successfully.");
            } catch (err) {
                console.error("Run failed:", err);
            }

        const randomInterval = getRandomInterval();
        console.log(`Next run in ${(randomInterval / 60000).toFixed(2)} minutes.`);
        await new Promise(res => setTimeout(res, randomInterval));
    }
}

runRepeatedly();
