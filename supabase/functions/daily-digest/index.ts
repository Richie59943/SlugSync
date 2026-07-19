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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
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
    const { mode = "summary", range, today, events, interests, question } = await req.json();

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
      const prompt = `Today's date is ${today}. You are writing a short, personable natural-language summary of a UCSC student's schedule for ${period}.

Their interests: ${formatInterests(interests)}.

Their events for this period:
${formatEvents(events)}

Write 2-4 sentences, warm and conversational, in second person ("you"). Call out standout events, a busy or light stretch, or free time — whatever is most useful. No markdown, no bullet points, no headers, just plain prose. If there are no events, say so kindly and suggest checking back later.`;

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

      const prompt = `Today's date is ${today}. A UCSC student is asking about their schedule for ${period}.

Their interests: ${formatInterests(interests)}.

Their events for this period:
${formatEvents(events)}

Their question: "${question}"

Answer directly using only the events listed above — reference actual dates/times/titles when relevant (e.g. for "when am I free?", point to the specific gaps between the listed events). Don't invent events that aren't in the list. 1-3 sentences, conversational, second person ("you"), no markdown, no bullet points. If the events listed don't contain enough information to answer, say so.`;

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
