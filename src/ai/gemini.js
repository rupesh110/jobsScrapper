import fetch from "node-fetch";
import dotenv from 'dotenv';
dotenv.config();

const aiKey = process.env.GEMINI_KEY; // Replace with your Gemini API key

/**
 * Compare a single job with resume using Gemini
 * @param {Object} job - Job object {title, company, description}
 * @param {string} resumeText - Full text of the candidate's resume
 * @returns {Promise<Object>} - JSON object with suitability, improvements, matchPercent, chanceCategory, summary
 */
export async function compareJobWithResume(job, resumeText) {
  // Trim resume if too long to avoid empty responses
  const maxResumeLength = 2000; // characters
  const trimmedResume = resumeText.length > maxResumeLength 
    ? resumeText.slice(0, maxResumeLength) + '...'
    : resumeText;

  const prompt = `
You are a career assistant AI.

Candidate resume:
${trimmedResume}

Job opening:
${job.title} at ${job.company}

Job description:
${job.description}

Compare the candidate's resume with this job description. STRICTLY RETURN a JSON object with all fields included even if some values are 0 or "low".

Example output:
{
  "suitable": true,
  "resumeImprovements": ["Highlight Python experience", "Include project metrics"],
  "matchPercent": 85,
  "chanceCategory": "high",
  "summary": "Candidate skills match the job well, with minor improvements suggested."
}

Analyze this job and resume now. Do not include any text outside the JSON object. Do not wrap JSON in markdown.
`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": aiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();
    let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    console.log("From Gemini:", aiText);

    // Clean code fences if present
    aiText = aiText.replace(/^```json\s*/, "").replace(/```$/, "").trim();

    try {
      const result = JSON.parse(aiText);
      // Ensure all fields exist with defaults
      return {
        suitable: result.suitable ?? false,
        resumeImprovements: result.resumeImprovements ?? [],
        matchPercent: result.matchPercent ?? 0,
        chanceCategory: result.chanceCategory ?? "low",
        summary: result.summary ?? "No summary available"
      };
    } catch (err) {
      console.error(`Failed to parse AI JSON for job: ${job.title}`, err, aiText);
      return {
        suitable: false,
        resumeImprovements: [],
        matchPercent: 0,
        chanceCategory: "low",
        summary: "Failed to generate assessment"
      };
    }
  } catch (err) {
    console.error(`Error calling Gemini for job: ${job.title}`, err);
    return {
      suitable: false,
      resumeImprovements: [],
      matchPercent: 0,
      chanceCategory: "low",
      summary: "Failed to generate assessment"
    };
  }
}
