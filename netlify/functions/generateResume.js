// inside exports.handler, after you build the request body:

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let r, data;
const maxAttempts = 4;

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1100,
      temperature: 0.5,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  // Try JSON, fall back to text
  const raw = await r.text();
  try { data = JSON.parse(raw); } catch { data = { raw }; }

  // Success
  if (r.ok) break;

  const msg = data?.error?.message || data?.message || data?.raw || "API error";

  // Retry only on overload / rate-limit / temporary upstream issues
  const retryable =
    r.status === 429 || r.status === 503 || r.status === 529 ||
    /overload|overloaded|temporarily|try again/i.test(msg);

  if (!retryable || attempt === maxAttempts) {
    return new Response(JSON.stringify({ error: msg }), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  }

  // Exponential backoff + jitter
  const backoff = Math.min(8000, 500 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 250);
  await sleep(backoff);
}