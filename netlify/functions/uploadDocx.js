// netlify/functions/uploadDocx.js

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const apiKey = process.env.FILESTACK_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing FILESTACK_API_KEY" }) };
    }

    const { filename, docxBase64 } = JSON.parse(event.body || "{}");
    if (!filename || !docxBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing filename or docxBase64" }) };
    }

    // Filestack upload endpoint accepts raw binary. We'll send base64 as a blob via a data URL.
    const uploadUrl = `https://www.filestackapi.com/api/store/S3?key=${encodeURIComponent(apiKey)}&filename=${encodeURIComponent(filename)}`;

    // Convert base64 -> bytes
    const bytes = Buffer.from(docxBase64, "base64");

    const r = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      body: bytes,
    });

    const data = await r.json();
    if (!r.ok) {
      return { statusCode: r.status, body: JSON.stringify({ error: "Filestack upload failed", details: data }) };
    }

    // Filestack returns a handle; build a CDN URL
    const handle = data?.handle;
    const url = handle ? `https://cdn.filestackcontent.com/${handle}` : null;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, url }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || "Server error" }) };
  }
};