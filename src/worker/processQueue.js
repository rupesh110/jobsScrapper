// worker/processQueue.js
import { getPendingJob, markJobDone, markJobFailed } from '../data/queuedb.js';
import { extractPdfTextFromBlob } from '../assets/resume.js';
import { compareJobWithResume } from '../ai/gemini.js';
import { formatJobMessage, sendSlackMessageIfGood, sendSlackMessageVmRunning } from '../integrate/slack.js';

const sleep = (ms) => new Promise(res => setTimeout(res, ms));
const BATCH_SIZE = 2;       // Number of jobs per batch
const THROTTLE_MS = 4000;   // Base delay between AI calls (ms)
let isRunning = false;      // Prevent overlapping runs
let pauseUntil = 0;         // Timestamp until which queue is paused due to 429 errors
let backoffMultiplier = 1;  // Exponential backoff factor

export async function processQueue() {
    if (isRunning) {
        console.log('Queue processor is already running. Skipping this run.');
        return;
    }
    isRunning = true;

    console.log('Starting queue processor...');
    await sendSlackMessageVmRunning('Queue processing started');

    const resumeText = await extractPdfTextFromBlob();
    const jobsBatch = [];
    let job;

    while ((job = getPendingJob())) {
        // Pause if we're under Gemini rate limit
        if (Date.now() < pauseUntil) {
            const waitMs = pauseUntil - Date.now();
            console.log(`Pausing queue for ${Math.ceil(waitMs/1000)}s due to Gemini quota limit.`);
            await sleep(waitMs);
        }

        jobsBatch.push(job);

        if (jobsBatch.length >= BATCH_SIZE) {
            await processBatch(jobsBatch, resumeText);
            jobsBatch.length = 0; // clear batch
        }
    }

    if (jobsBatch.length > 0) {
        await processBatch(jobsBatch, resumeText);
    }

    console.log('Queue is empty. Exiting queue processor.');
    await sendSlackMessageVmRunning('Queue processing finished');
    isRunning = false;
}

// Process a batch of jobs sequentially with throttling
async function processBatch(batch, resumeText) {
    for (const job of batch) {
        // console.log("-------------------------------------------------------------------------------------------");
        // console.log("Processing job from queue:", JSON.stringify(job, null, 2));
        // console.log("-------------------------------------------------------------------------------------------");

        try {
            const aiResult = await callGeminiWithRetries(job.description, resumeText);

            if (!aiResult || aiResult.matchPercent === undefined) {
                console.warn(`Skipping job due to invalid AI result: ${job.title}`);
                markJobFailed(job.id, 'Invalid AI response');
                continue;
            }

            const message = formatJobMessage(job, aiResult);

            // Send Slack notification only if matchPercent >= 50
            await sendSlackMessageIfGood(aiResult, message);

            markJobDone(job.id, job.description || 'No description available');

            console.log(`Completed job: ${job.title} at ${job.company} and ${job.description}`);

            // Throttle AI calls to avoid rate-limit issues
            await sleep(THROTTLE_MS + Math.random() * 1000);

        } catch (err) {
            console.error(`Failed job: ${job.title} at ${job.company}`, err.message);
            markJobFailed(job.id, err.message);
            await sleep(1000);
        }
    }
}

// Call Gemini with retries and exponential backoff on 429
async function callGeminiWithRetries(jobDescription, resumeText, maxRetries = 3) {
    let attempts = 0;
    let localBackoff = backoffMultiplier;

    while (attempts <= maxRetries) {
        try {
            const aiResult = await compareJobWithResume(jobDescription, resumeText);
            if (aiResult && aiResult.matchPercent !== undefined) {
                backoffMultiplier = 1; // reset global backoff on success
                return aiResult;
            }
        } catch (err) {
            if (err?.code === 429 || err?.status === 'RESOURCE_EXHAUSTED') {
                const waitTime = 60000 * localBackoff; // base 60s * multiplier
                console.warn(`Gemini quota exceeded for job "${jobDescription?.slice(0,30)}...". Pausing queue for ${waitTime/1000}s.`);
                pauseUntil = Date.now() + waitTime;
                await sleep(waitTime);
                localBackoff *= 2;           // exponential backoff
                backoffMultiplier = localBackoff; // persist for next jobs
            } else {
                console.warn(`Gemini call failed for job "${jobDescription?.slice(0,30)}..." (attempt ${attempts + 1}): ${err.message}`);
                await sleep(2000 + Math.random() * 1000);
            }
        }
        attempts++;
    }

    console.error(`All Gemini attempts failed for job: ${jobDescription?.slice(0,30)}...`);
    return {
        suitable: false,
        resumeImprovements: [],
        matchPercent: 0,
        chanceCategory: "low",
        summary: "Failed to generate assessment after retries"
    };
}
