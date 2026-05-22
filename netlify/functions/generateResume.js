// netlify/functions/generateResume.js
// Anthropic Claude API call with retry/backoff for overload/rate-limit.
// Model updated: use env var ANTHROPIC_MODEL or default to "claude-sonnet-4-6".

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }),
      };
    }

    const { prompt } = JSON.parse(event.body || "{}");
    if (!prompt || typeof prompt !== "string") {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing prompt" }),
      };
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
    const maxAttempts = 5;

    let lastStatus = 500;
    let lastMsg = "Unknown error";
    let data = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1100,
          temperature: 0.5,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      lastStatus = r.status;

      const raw = await r.text();
      try {
        data = JSON.parse(raw);
      } catch {
        data = { raw };
      }

      if (r.ok) {
        const resumeText = Array.isArray(data?.content)
          ? data.content
              .filter((b) => b?.type === "text")
              .map((b) => b.text)
              .join("\n")
          : "";

        if (!resumeText) {
          return {
            statusCode: 502,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              error: "Anthropic returned no text content",
              details: data,
            }),
          };
        }

        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resumeText }),
        };
      }

      const msg =
        data?.error?.message ||
        data?.message ||
        data?.raw ||
        `Anthropic API error (status ${r.status})`;

      lastMsg = msg;

      const retryable =
        r.status === 429 || // rate limit
        r.status === 503 || // service unavailable
        r.status === 529 || // overloaded
        /overload|overloaded|temporarily|try again|busy/i.test(String(msg));

      if (!retryable || attempt === maxAttempts) {
        return {
          statusCode: r.status,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: msg }),
        };
      }

      const backoff =
        Math.min(9000, 600 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 300);
      await sleep(backoff);
    }

    return {
      statusCode: lastStatus,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: lastMsg }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: e?.message || "Server error" }),
    };
  }
};