const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 2_000_000; // 2MB cap so a huge page can't blow up the function
const MAX_TEXT_CHARS = 20_000; // cap what we send to the AI

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- 3.3.5: URL validation -------------------------------------------------

function validateUrl(rawUrl: unknown): { ok: true; url: URL } | { ok: false; error: string } {
  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { ok: false, error: "Please provide a URL." };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "URLs must start with http:// or https://." };
  }

  // Block obviously-internal/private targets so the function can't be used
  // as an open proxy for internal network scanning.
  const hostname = parsed.hostname.toLowerCase();
  const blockedHosts = ["localhost", "0.0.0.0", "127.0.0.1", "::1"];
  const isPrivateIp =
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

  if (blockedHosts.includes(hostname) || isPrivateIp) {
    return { ok: false, error: "That URL can't be fetched." };
  }

  return { ok: true, url: parsed };
}

// --- 3.3.3: fetch page content ---------------------------------------------

async function fetchPage(url: URL): Promise<
  { ok: true; html: string } | { ok: false; error: string; status?: number }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Some sites block requests with no user agent at all.
        "User-Agent":
          "Mozilla/5.0 (compatible; SlugSyncBot/1.0; +https://slugsync.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (res.status === 403 || res.status === 401) {
      return { ok: false, error: "That site blocked our request to fetch it.", status: res.status };
    }

    if (res.status === 404) {
      return { ok: false, error: "That page couldn't be found (404).", status: res.status };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: `That site returned an error (status ${res.status}).`,
        status: res.status,
      };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return { ok: false, error: "That URL isn't a webpage we can read." };
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_HTML_BYTES) {
      return { ok: false, error: "That page is too large to read." };
    }

    const html = new TextDecoder("utf-8").decode(buffer);
    if (!html || !html.trim()) {
      return { ok: false, error: "That page came back empty." };
    }

    return { ok: true, html };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Fetching that page took too long." };
    }
    return { ok: false, error: "We couldn't reach that URL." };
  } finally {
    clearTimeout(timeout);
  }
}

// Strip tags/scripts/styles down to readable text.
function htmlToText(html: string): string {
  const withoutJunk = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const withoutTags = withoutJunk.replace(/<[^>]+>/g, " ");

  const decoded = withoutTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  return decoded.replace(/\s+/g, " ").trim();
}

// --- 3.3.4: parse events from page text using the AI ------------------------

async function parseEventsWithAI(text: string, today: string, apiKey: string) {
  const prompt = `Today's date is ${today}.
You will be given raw text scraped from a webpage. Find every distinct event mentioned and return ONLY a JSON object, no markdown, no code fences, no explanation.

Format:
{"events": [{"title": string, "date": "YYYY-MM-DD" or null, "startTime": "HH:MM" or null, "endTime": "HH:MM" or null, "location": string or null, "description": string or null}]}

Rules:
- Resolve relative dates (like "next Tuesday" or "this Friday") against today's date.
- Use 24-hour time.
- Use null for anything not mentioned in the text — do not guess or invent details.
- Ignore navigation menus, ads, footers, and anything that isn't an actual event.
- If the text contains no identifiable events, return {"events": []}.
- Do not include duplicate events.

Page text:
${text.slice(0, MAX_TEXT_CHARS)}`;

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
    return { ok: false as const, error: "The AI service returned an error." };
  }

  const data = await geminiRes.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    const events = Array.isArray(parsed?.events) ? parsed.events : [];
    return { ok: true as const, events };
  } catch {
    console.error("Could not parse AI response as JSON:", raw);
    return { ok: false as const, error: "Couldn't understand the AI response." };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let body: { url?: string; today?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }

  const validation = validateUrl(body.url);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, 400);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Server is missing its API key." }, 500);
  }

  const fetched = await fetchPage(validation.url);
  if (!fetched.ok) {
    return jsonResponse({ error: fetched.error }, 502);
  }

  const text = htmlToText(fetched.html);
  if (!text || text.length < 20) {
    return jsonResponse({ error: "That page didn't have any readable content." }, 422);
  }

  const today = typeof body.today === "string" && body.today ? body.today : new Date().toISOString().slice(0, 10);
  const result = await parseEventsWithAI(text, today, apiKey);

  if (!result.ok) {
    return jsonResponse({ error: result.error }, 502);
  }

  if (result.events.length === 0) {
    return jsonResponse({ error: "No events were found on that page.", events: [] }, 200);
  }

  return jsonResponse({ events: result.events });
});
