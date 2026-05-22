// netlify/functions/uploadDocx.js

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const apiKey = process.env.FILESTACK_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Missing FILESTACK_API_KEY" }) };
    }

    const { filename, docxBase64 } = JSON.parse(event.body || "{}");
    if (!filename || !docxBase64) {
      return { statusCode: 400, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Missing filename or docxBase64" }) };
    }

    // ✅ Strip "data:...base64," prefix if present
    const cleanBase64 = String(docxBase64).includes(",")
      ? String(docxBase64).split(",").pop()
      : String(docxBase64);

    const bytes = Buffer.from(cleanBase64, "base64");

    // Basic sanity check: docx should not be tiny
    if (!bytes || bytes.length < 2000) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "DOCX payload too small (base64 likely malformed).", size: bytes?.length || 0 }),
      };
    }

    const uploadUrl =
      `https://www.filestackapi.com/api/store/S3` +
      `?key=${encodeURIComponent(apiKey)}` +
      `&filename=${encodeURIComponent(filename)}`;

    const r = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes,
    });

    const raw = await r.text();

    let data = null;
    try { data = JSON.parse(raw); } catch {}

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
    return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: e?.message || "Server error" }) };
  }
};