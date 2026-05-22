exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return response(405, { error: "Method not allowed" });
    }

    const body = JSON.parse(event.body || "{}");

    const {
      email,
      firstName,
      lastName,
      answers
    } = body;

    if (!email) {
      return response(400, { error: "Student email is required." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return response(500, { error: "Missing OPENAI_API_KEY in Netlify." });
    }

    if (!process.env.RESEND_API_KEY) {
      return response(500, { error: "Missing RESEND_API_KEY in Netlify." });
    }

    const studentName = `${firstName || ""} ${lastName || ""}`.trim() || "Student";

    const resumeText = await createResumeWithAI(studentName, answers);

    await emailResume({
      to: email,
      studentName,
      resumeText
    });

    return response(200, {
      success: true,
      message: "Resume emailed successfully."
    });

  } catch (error) {
    console.error("generateResume error:", error);
    return response(500, {
      error: "Resume could not be generated or emailed.",
      details: error.message
    });
  }
};

async function createResumeWithAI(studentName, answers) {
  const prompt = `
Create a polished, age-appropriate resume for a middle school or high school 4-H student.

Student name:
${studentName}

Student answers:
${JSON.stringify(answers, null, 2)}

Make it professional, honest, encouraging, and suitable for school, jobs, internships, scholarships, 4-H opportunities, and community programs.

Use clear sections:
- Name
- Summary
- Skills
- 4-H Experience
- Leadership
- Community Service
- Education
- Awards / Achievements
- Activities
`;

  const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You write clean, age-appropriate resumes for 4-H middle school and high school students."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.4
    })
  });

  if (!aiRes.ok) {
    const errorText = await aiRes.text();
    throw new Error(`OpenAI error: ${errorText}`);
  }

  const aiData = await aiRes.json();
  return aiData.choices?.[0]?.message?.content || "";
}

async function emailResume({ to, studentName, resumeText }) {
  const safeFileName = `${studentName.replace(/[^a-z0-9]/gi, "_")}_Resume.txt`;

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "4-H ResumAI Builder <onboarding@resend.dev>",
      to: [to],
      subject: "Your 4-H Resume",
      html: `
        <p>Hello ${escapeHtml(studentName)},</p>
        <p>Your 4-H resume is attached.</p>
        <p>Great job taking this step toward your future!</p>
      `,
      attachments: [
        {
          filename: safeFileName,
          content: Buffer.from(resumeText, "utf8").toString("base64")
        }
      ]
    })
  });

  if (!emailRes.ok) {
    const errorText = await emailRes.text();
    throw new Error(`Email error: ${errorText}`);
  }

  return emailRes.json();
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}