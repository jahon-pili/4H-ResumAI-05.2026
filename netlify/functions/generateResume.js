exports.handler = async function (event) {
  try {
    if (event.httpMethod !== "POST") {
      return jsonResponse(405, { error: "Method not allowed" });
    }

    const body = JSON.parse(event.body || "{}");

    const email = body.email || body.studentEmail || body.parentEmail;
    const firstName = body.firstName || "";
    const lastName = body.lastName || "";
    const studentName = `${firstName} ${lastName}`.trim() || "Student";

    if (!email) {
      return jsonResponse(400, { error: "Student email is required." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return jsonResponse(500, { error: "Missing OPENAI_API_KEY in Netlify." });
    }

    if (!process.env.RESEND_API_KEY) {
      return jsonResponse(500, { error: "Missing RESEND_API_KEY in Netlify." });
    }

    const resumeText = await generateResumeText(studentName, body);

    await sendResumeEmail({
      to: email,
      studentName,
      resumeText
    });

    return jsonResponse(200, {
      success: true,
      message: "Your resume has been emailed successfully."
    });
  } catch (error) {
    console.error("generateResume.js error:", error);

    return jsonResponse(500, {
      success: false,
      error: "Resume could not be generated or emailed.",
      details: error.message
    });
  }
};

async function generateResumeText(studentName, formData) {
  const prompt = `
Create a polished, age-appropriate resume for a 4-H middle school or high school student.

Student Name:
${studentName}

Student Information:
${JSON.stringify(formData, null, 2)}

Requirements:
- Make it professional but age-appropriate.
- Do not invent jobs, awards, schools, or achievements.
- Use the student's answers only.
- Make the student sound confident, capable, and honest.
- Format it clearly as a resume.
- Include useful sections when information is available:
  Name
  Summary
  Skills
  4-H Experience
  Leadership
  Community Service
  Education
  Awards / Achievements
  Activities
`;

  const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You create clean, honest, age-appropriate resumes for 4-H students."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.4
    })
  });

  if (!openAiResponse.ok) {
    const errorText = await openAiResponse.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const data = await openAiResponse.json();
  const resumeText = data.choices?.[0]?.message?.content;

  if (!resumeText) {
    throw new Error("OpenAI did not return resume text.");
  }

  return resumeText;
}

async function sendResumeEmail({ to, studentName, resumeText }) {
  const fromEmail =
    process.env.RESUME_FROM_EMAIL || "4-H ResumAI Builder <onboarding@resend.dev>";

  const safeFileName = `${studentName.replace(/[^a-z0-9]/gi, "_")}_Resume.txt`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: "Your 4-H Resume",
      html: `
        <p>Hello ${escapeHtml(studentName)},</p>
        <p>Your 4-H resume is attached to this email.</p>
        <p>Great job taking this step toward your future.</p>
      `,
      attachments: [
        {
          filename: safeFileName,
          content: Buffer.from(resumeText, "utf8").toString("base64")
        }
      ]
    })
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text();
    throw new Error(`Resend email error: ${errorText}`);
  }

  return resendResponse.json();
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}