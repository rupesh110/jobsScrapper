// worker/processQueue.js
import { getPendingJob, markJobDone, markJobFailed } from '../data/queuedb.js';
import { extractPdfTextFromBlob } from '../assets/resume.js';
import { compareJobWithResume } from '../ai/gemini.js';
import { formatJobMessage, sendSlackMessageIfGood, sendSlackMessageVmRunning } from '../integrate/slack.js';

const sleep = (ms) => new Promise(res => setTimeout(res, ms));
const BATCH_SIZE = 2;        // Number of jobs to process in a batch
const THROTTLE_MS = 4000;    // Base delay between AI calls (ms)
let isRunning = false;       // Prevent overlapping runs

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
        console.log(`Processing job from queue: ${job.title} at ${job.company}`);

        try {
            const aiResult = await callGeminiWithRetries(job, resumeText);
            if (!aiResult || aiResult.matchPercent === undefined) {
                console.warn(`Skipping job due to invalid AI result: ${job.title}`);
                markJobFailed(job.id, 'Invalid AI response');
                continue;
            }

            const message = formatJobMessage(job, aiResult);

            // Send Slack notification only if matchPercent >= 50
            await sendSlackMessageIfGood(aiResult, message);

            markJobDone(job.id, job.description || 'No description available');

            console.log(`Completed job: ${job.title} at ${job.company}`);

            // Throttle AI calls to avoid hallucination or rate-limit issues
            await sleep(THROTTLE_MS + Math.random() * 1000);

        } catch (err) {
            console.error(`Failed job: ${job.title} at ${job.company}`, err.message);
            markJobFailed(job.id, err.message);
            await sleep(1000);
        }
    }
}

// Call Gemini with retries and small delay
async function callGeminiWithRetries(job, resumeText, maxRetries = 2) {
    let attempts = 0;
    while (attempts <= maxRetries) {
        try {
            const aiResult = await compareJobWithResume(job, resumeText);
            if (aiResult && aiResult.matchPercent !== undefined) return aiResult;
        } catch (err) {
            console.warn(`Gemini call failed for ${job.title} (attempt ${attempts + 1}): ${err.message}`);
        }
        attempts++;
        await sleep(1000 + Math.random() * 500);
    }
    return null;
}
