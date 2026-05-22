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

    const resumeText = await generateResumeText(studentName, body);

    return jsonResponse(200, {
      success: true,
      resumeText: resumeText
    });
  } catch (error) {
    console.error("generateResume.js error:", error);

    return jsonResponse(500, {
      success: false,
      error: "Resume could not be generated.",
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

HONESTY (most important):
- Do NOT invent jobs, awards, schools, achievements, titles, dates, or numbers.
- Do NOT add accomplishments the student did not state.
- If an answer is a joke, unclear, or not resume-appropriate, leave it out entirely rather than dressing it up.
- Every fact in the resume must trace directly back to something the student actually wrote.

ELABORATION (what you SHOULD do):
- Take the student's real answers and express them in more polished, articulate, academic language.
- Elaborate on HOW they describe an experience, not WHAT happened. Improve the wording, not the facts.
- For each genuine experience, you may add one short sentence describing the transferable skills it builds
  (e.g. responsibility, communication, teamwork) ONLY when that skill clearly follows from what they wrote.
- Use strong, professional action verbs (developed, contributed, collaborated, organized, demonstrated).
- Write in a confident, capable, age-appropriate voice suitable for a motivated student.

FORMAT:
- Make it professional but warm and age-appropriate, not corporate or stiff.
- Format it clearly as a resume with section titles each on their own line.
- Include these sections when information is available:
  Name
  Summary
  Skills
  4-H Experience
  Leadership
  Community Service
  Education
  Awards / Achievements
  Activities
  Interests
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
