// netlify/functions/generateResume.js

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async function (event) {
  try {
    // Handles browser preflight request
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

    let body;

    try {
      body = JSON.parse(event.body || "{}");
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Invalid JSON sent to the resume function.",
        }),
      };
    }

    const prompt = body.prompt;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Missing resume prompt.",
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

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620",
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

    let data;

    try {
      data = await anthropicResponse.json();
    } catch (jsonError) {
      return {
        statusCode: 502,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Anthropic returned an invalid response.",
        }),
      };
    }

    if (!anthropicResponse.ok) {
      return {
        statusCode: anthropicResponse.status,
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
          error: "No resume text was returned from Anthropic.",
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
        error: error?.message || "Server error inside generateResume function.",
      }),
    };
  }
};