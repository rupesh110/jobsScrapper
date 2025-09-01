import fetch from "node-fetch";
import dotenv from 'dotenv';
dotenv.config();

const aiKey = process.env.GEMINI_KEY;

/**
 * Compare a single job with a resume using Gemini
 * @param {Object} job - {title, company, description}
 * @param {string} resumeText - Full resume text
 * @returns {Promise<Object>} - {suitable, resumeImprovements, matchPercent, chanceCategory, summary}
 */
export async function compareJobWithResume(job, resumeText) {


  // console.log("------------------------------------------")
  // console.log("Props:", job, "--------------------", resumeText)
  // console.log("------------------------------------------")

  // Trim resume if too long
  const maxResumeLength = 3000;
  const trimmedResume = resumeText.length > maxResumeLength 
    ? resumeText.slice(0, maxResumeLength) + '...'
    : resumeText;

  const prompt = `
You are an expert career assistant AI. Compare a candidate's resume with a job description.

Candidate resume:
${trimmedResume}

Job:
${job.title} at ${job.company}

Job description:
${job.description}

STRICT JSON OUTPUT:
- Output ONLY a JSON object with fields: suitable, resumeImprovements, matchPercent, chanceCategory, summary
- Always include all fields, even if empty or false
- Do NOT include any text outside JSON

GUIDANCE:
1. Consider **transferable skills, learning potential, adaptability, and relevant achievements**, not just exact keyword matches.
2. Graduate or entry-level roles should value **curiosity, growth mindset, and foundational skills**.
3. Intermediate/experienced roles should value **specific technical skills and accomplishments**.
4. matchPercent: 0-30 = low, 31-69 = medium, 70-100 = high.
5. Adjust chanceCategory according to overall alignment, including transferable skills.
6. If resume partially matches, suggest improvements in resumeImprovements.

Example output:
{
  "suitable": true,
  "resumeImprovements": ["Highlight JavaScript experience", "Include project metrics"],
  "matchPercent": 75,
  "chanceCategory": "high",
  "summary": "Candidate skills are relevant and transferable, with minor improvements suggested."
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
    //console.log("From Gemini:", JSON.stringify(data, null, 2));

    // Clean code fences if present
    aiText = aiText.replace(/^```json\s*/, "").replace(/```$/, "").trim();

    try {
      const result = JSON.parse(aiText);
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
