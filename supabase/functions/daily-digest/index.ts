const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RANGE_PERIODS: Record<string, string> = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
};

function formatInterests(interests: { clubs?: string[]; classes?: string[] } | undefined) {
  const clubs = interests?.clubs?.length ? interests.clubs.join(", ") : "none listed";
  const classes = interests?.classes?.length ? interests.classes.join(", ") : "none listed";
  return `clubs — ${clubs}; classes — ${classes}`;
}

const STUDENT_YEARS = new Set(["Freshman", "Sophomore", "Junior", "Senior", "Graduate"]);

function yearContext(year: string | undefined) {
  return STUDENT_YEARS.has(year ?? "") ? ` They're a ${year} student.` : "";
}

const SUMMARY_SENTENCE_COUNTS: Record<string, string> = {
  daily: "2-4",
  weekly: "3-6",
  monthly: "3-6",
};

function monthlyEventGuidance(range: string) {
  if (range !== "monthly") return "";
  return ` Zoom out to the whole month rather than focusing on today or tomorrow — give a higher-level overview, and when referencing a notable event, mention its date or which week it falls in (e.g. "on the 24th" or "later this month") instead of day-of-week framing. Distinguish two kinds of events: main events — notable one-offs like club events, social events, special happenings — and routine events — regular classes, study sessions, practices. Name and describe main events individually. Only mention routine events as a brief group if they actually appear in the list below — never invent or assume routine events that aren't listed.`;
}

function formatEvents(events: Array<{ title?: string; date?: string; time?: string; location?: string }>) {
  if (!events || events.length === 0) return "(no events scheduled)";
  return events
    .map((event) => {
      const when = [event.date, event.time].filter(Boolean).join(" ");
      const where = event.location ? ` at ${event.location}` : "";
      return `- ${event.title || "Untitled event"} — ${when}${where}`;
    })
    .join("\n");
}

async function callGemini(apiKey: string, prompt: string) {
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );

  if (!geminiRes.ok) {
    const errBody = await geminiRes.text();
    console.error("Gemini API error:", errBody);
    throw new Error("The AI service returned an error.");
  }

  const data = await geminiRes.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return raw.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
}

Deno.serve(async (req) => {
  // Browsers send a preflight OPTIONS request first
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { mode = "summary", range, today, todayWeekday, year, events, interests, question } = await req.json();

    const period = RANGE_PERIODS[range];
    if (!period) {
      return new Response(
        JSON.stringify({ error: "Unsupported range." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Server is missing its API key." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode === "summary") {
      const prompt = `Today is ${todayWeekday}, ${today} — use that exact weekday as given, don't recalculate it. You are writing a short, personable natural-language summary of someone's schedule for ${period}. They're in the Santa Cruz area — don't name a specific school (there are several nearby, e.g. UCSC, Cabrillo).${yearContext(year)}${monthlyEventGuidance(range)}

Their known interests (clubs/classes), for background only: ${formatInterests(interests)}. Only bring up a specific club or class if it's genuinely relevant to something on the schedule below — don't mention it as a routine sign-off.

Their events for this period:
${formatEvents(events)}

Only describe events that actually appear in the list above — never invent, assume, or add events (including routine ones like classes or practice) that aren't explicitly listed there.

Write ${SUMMARY_SENTENCE_COUNTS[range] ?? "2-4"} sentences, warm and conversational, in second person ("you"). Call out standout events, a busy or light stretch, or free time — whatever is most useful. No markdown, no bullet points, no headers, just plain prose. If there are no events, say so kindly and suggest checking back later.`;

      const summary = await callGemini(apiKey, prompt);
      return new Response(
        JSON.stringify({ summary }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode === "qa") {
      if (!question || !question.trim()) {
        return new Response(
          JSON.stringify({ error: "No question provided." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const prompt = `Today is ${todayWeekday}, ${today} — use that exact weekday as given, don't recalculate it. Someone in the Santa Cruz area is asking about their schedule for ${period} — don't name a specific school.${yearContext(year)}

Their known interests (clubs/classes), for background only: ${formatInterests(interests)}. Only bring up a specific club or class if it's genuinely relevant to their question — don't work it in as a routine reference.

Their events for this period:
${formatEvents(events)}

Their question: "${question}"

Answer directly using only the events listed above — reference actual dates/times/titles when relevant (e.g. for "when am I free?", point to the specific gaps between the listed events). Don't invent events that aren't in the list, including routine ones like classes or practice. 1-3 sentences, conversational, second person ("you"), no markdown, no bullet points. If the events listed don't contain enough information to answer, say so.`;

      const answer = await callGemini(apiKey, prompt);
      return new Response(
        JSON.stringify({ answer }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unsupported mode: ${mode}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: "Something went wrong." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
