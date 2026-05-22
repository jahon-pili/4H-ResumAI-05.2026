// netlify/functions/uploadDocx.js

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const apiKey = process.env.FILESTACK_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing FILESTACK_API_KEY" }),
      };
    }

    const { filename, docxBase64 } = JSON.parse(event.body || "{}");
    if (!filename || !docxBase64) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing filename or docxBase64" }),
      };
    }

    const uploadUrl =
      `https://www.filestackapi.com/api/store/S3` +
      `?key=${encodeURIComponent(apiKey)}` +
      `&filename=${encodeURIComponent(filename)}`;

    const bytes = Buffer.from(docxBase64, "base64");

    const r = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      body: bytes,
    });

    // IMPORTANT: read as text first, because Filestack/WAF may return non-JSON
    const raw = await r.text();

    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      // Not JSON (often “Application blocked” HTML/text)
    }

    if (!r.ok) {
      return {
        statusCode: r.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Filestack upload failed",
          status: r.status,
          details: data || raw.slice(0, 500),
        }),
      };
    }

    const handle = data?.handle;
    const url = handle ? `https://cdn.filestackcontent.com/${handle}` : null;

    if (!handle || !url) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Filestack did not return a handle",
          details: data || raw.slice(0, 500),
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, url }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: e?.message || "Server error" }),
    };
  }
};