import fetch from "node-fetch";
import dotenv from 'dotenv';
dotenv.config();

const aiKey = process.env.GEMINI_KEY; // Your Gemini API key

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
You are a career assistant AI. Compare a candidate's resume with a job description.

Candidate resume:
${trimmedResume}

Job:
${job.title} at ${job.company}

Job description:
${job.description}

STRICT RULES:
1. Output ONLY a JSON object with exactly these fields: 
   - suitable (true/false)
   - resumeImprovements (array of strings, empty if none)
   - matchPercent (number 0-100)
   - chanceCategory ("low", "medium", "high")
   - summary (string, can be "No summary available")
2. Always include all fields, even if some values are 0, false, empty, or "low".
3. Do NOT include any text outside JSON, do NOT include markdown.
4. Use the resume and job description to calculate matchPercent, suggest improvements, and categorize chanceCategory.
5. If resume lacks relevant skills or experience, set suitable to false, matchPercent to 0-30, and chanceCategory to "low".
6. If resume partially matches the job, set matchPercent 31-69, chanceCategory "medium".
7. If resume closely matches the job, set matchPercent 70-100, chanceCategory "high".

Example output:
{
  "suitable": true,
  "resumeImprovements": ["Highlight JavaScript experience", "Include project metrics"],
  "matchPercent": 85,
  "chanceCategory": "high",
  "summary": "Candidate skills match the job well, with minor improvements suggested."
}

Analyze the resume against the job now.
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

    // Clean any code fences if present
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
