// slack.js
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Escape Slack markdown characters
function escapeSlack(text) {
  if (!text) return "";
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Map chanceCategory to emoji
function chanceEmoji(category) {
  switch ((category || "").toLowerCase()) {
    case "high": return "🟢 High";
    case "medium": return "🟡 Medium";
    case "low": return "🔴 Low";
    default: return "N/A";
  }
}

// Format job info nicely for Slack
export function formatJobMessage(job, aiResult) {
  const matchPct = aiResult.matchPercent != null ? aiResult.matchPercent : 'N/A';
  const chances = chanceEmoji(aiResult.chanceCategory);

  return `
:briefcase: *Job:* *${escapeSlack(job.title)}* at *${escapeSlack(job.company)}*
:link: *URL:* <${job.url}>
:white_check_mark: *Suitable:* ${aiResult.suitable ? '*Yes*' : '*No*'}
:bar_chart: *Match Percentage:* ${matchPct}%
:chart_with_upwards_trend: *Chances of Getting Role:* ${chances}
*Summary:*
${escapeSlack(aiResult.summary || 'N/A')}
*Resume Improvements:*
${(aiResult.resumeImprovements || []).map(imp => `• ${escapeSlack(imp)}`).join('\n') || 'None'}
──────────────────────────────
`;
}

// Send Slack message only if matchPercent >= 50%
export async function sendSlackMessageIfGood(aiResult, message) {
  if ((aiResult.matchPercent ?? 0) < 40) {
    console.log(`Skipping Slack message: matchPercent < 50% (${aiResult.matchPercent})`);
    return;
  }

  try {
    let text = typeof message === "string" ? message : JSON.stringify(message, null, 2);
    if (text.length > 3900) {
      text = text.slice(0, 3900) + "\n…(truncated)";
    }

    const payload = { text };
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Slack API error: ${res.status} ${res.statusText}`);
    }

    console.log("Message sent to Slack successfully.");
  } catch (err) {
    console.error("Error sending Slack message:", err.message);
  }
}


export async function sendSlackMessageVmRunning(message) {

  try {
    let text = typeof message === "string" ? message : JSON.stringify(message, null, 2);

    const payload = { text };
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Slack API error: ${res.status} ${res.statusText}`);
    }

    console.log("Message sent to Slack successfully.");
  } catch (err) {
    console.error("Error sending Slack message:", err.message);
  }
}
