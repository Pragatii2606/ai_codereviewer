// src/services/ai.service.js
const { GoogleGenAI } = require('@google/genai');

/**
 * NOTE: prefer a clear UPPER_SNAKE_CASE env var name.
 * If you continue using `process.env.Google_gemini_key` that's fine,
 * but I recommend `process.env.GOOGLE_GEMINI_KEY`.
 */
const API_KEY = process.env.GOOGLE_GEMINI_KEY || process.env.Google_gemini_key;
if (!API_KEY) {
  console.warn('Warning: GOOGLE_GEMINI_KEY is not set. AI calls will fail until the key is provided.');
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const SYSTEM_INSTRUCTION = `
You are a senior software engineer and professional code reviewer.
When given a code snippet, produce a concise, accurate, and well-structured review that a developer can use immediately.
Follow this output schema exactly:

1. One-line summary.
2. Key issues (title, severity, short impact).
3. Reproduction & assumptions.
4. Corrected code (complete, runnable snippet).
5. Minimal patch/diff.
6. Explanation of changes.
7. Tests & validation example.
8. Edge cases & further improvements.
9. Final verdict and recommended next steps.

Use Markdown, code fences, and idiomatic language-specific best practices.
`;

/**
 * Helper: sleep for ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper: exponential backoff with jitter
 * attempt: 1-based attempt number
 */
function backoffDelay(attempt, baseDelay = 500, maxDelay = 10000) {
  // exponential growth
  const exp = Math.min(maxDelay, baseDelay * Math.pow(2, attempt - 1));
  // jitter: random between base/2 and exp
  const jitter = Math.random() * (exp - baseDelay / 2) + baseDelay / 2;
  return Math.round(jitter);
}

/**
 * Generate with retries on transient errors (503).
 * Returns the SDK response or throws an Error with a .status property.
 */
async function generateWithRetry(params, {
  maxAttempts = 5,
  baseDelay = 500,
  maxDelay = 10000,
} = {}) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      lastErr = err;
      // If SDK exposes a numeric status on the error, read it. Otherwise try err.status
      const status = err?.status || err?.response?.status || (err?.error && err.error.code) || null;

      // If it's a 503 (service unavailable / overloaded), retry
      if (status === 503) {
        const delay = backoffDelay(attempt, baseDelay, maxDelay);
        console.warn(`AI model overloaded (503). Retry ${attempt}/${maxAttempts} after ${delay}ms.`);
        // last attempt? break -> rethrow below
        if (attempt < maxAttempts) {
          await sleep(delay);
          continue;
        }
      }

      // For other errors or if we've exhausted retries, stop retrying
      break;
    }
  }

  // Build a friendly error with status where possible
  const status = lastErr?.status || lastErr?.response?.status || (lastErr?.error && lastErr.error.code) || 500;
  const message = lastErr?.message || JSON.stringify(lastErr) || 'Unknown AI service error';

  const e = new Error(`AI service error: ${message}`);
  e.status = status;
  e.raw = lastErr;
  throw e;
}

/**
 * Main exported function - returns string result or throws an Error with .status
 */
async function main(userCode, language = 'javascript') {
  if (!userCode) {
    const err = new Error('Code input is required');
    err.status = 400;
    throw err;
  }

  const prompt = `
${SYSTEM_INSTRUCTION}  

User code (${language}):
\`\`\`${language}
${userCode}
\`\`\`

Please produce the review following the schema above.
`;

  // Request shape expected by the SDK
  const params = {
    model: 'gemini-2.5-flash',
    contents: prompt,
  };

  // Call with retries
  const response = await generateWithRetry(params, {
    maxAttempts: 5,
    baseDelay: 600, // ms
    maxDelay: 8000, // ms
  });

  // Extract text from known SDK shape:
  let text = null;
  try {
    if (response?.candidates?.length) {
      const cand0 = response.candidates[0];
      // some SDK shapes have content.parts with .text
      if (cand0?.content?.parts) {
        text = cand0.content.parts.map(p => p.text).join('\n');
      } else if (cand0?.content?.parts?.[0]?.text) {
        text = cand0.content.parts[0].text;
      }
    }
    // fallback shapes
    text = text ?? response?.text ?? response?.response?.text ?? JSON.stringify(response);
  } catch (ex) {
    console.error('Error extracting text from AI response', ex, response);
    text = JSON.stringify(response);
  }

  return String(text);
}

module.exports = { main };
