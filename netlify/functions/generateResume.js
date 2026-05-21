// netlify/functions/generateResume.js

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async function (event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: "",
      };
    }

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Method not allowed. Use POST.",
        }),
      };
    }

    let requestBody = {};

    try {
      requestBody = JSON.parse(event.body || "{}");
    } catch (error) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Invalid JSON sent to generateResume.",
        }),
      };
    }

    const prompt = requestBody.prompt;

    if (!prompt || typeof prompt !== "string") {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Missing prompt.",
        }),
      };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Missing ANTHROPIC_API_KEY in Netlify environment variables.",
        }),
      };
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1800,
        temperature: 0.4,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error:
            data?.error?.message ||
            data?.message ||
            "Anthropic API error. Check your API key, billing, or model access.",
        }),
      };
    }

    const resumeText = Array.isArray(data?.content)
      ? data.content
          .filter((block) => block?.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim()
      : "";

    if (!resumeText) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Anthropic returned no resume text.",
        }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        resumeText,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error?.message || "Server error inside generateResume.",
      }),
    };
  }
};