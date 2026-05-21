export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }

    const { prompt } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    // Anthropic Messages API
    const r = await fetch("https://api.anthropic.com/v1/messages", {
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

    const data = await r.json();

    if (!r.ok) {
      return new Response(
        JSON.stringify({ error: data?.error?.message || "Anthropic API error" }),
        { status: r.status, headers: { "content-type": "application/json" } }
      );
    }

    // Extract text from content blocks
    const resumeText =
      Array.isArray(data?.content)
        ? data.content
            .filter((b) => b?.type === "text")
            .map((b) => b.text)
            .join("\n")
        : "";

    return new Response(JSON.stringify({ resumeText }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};