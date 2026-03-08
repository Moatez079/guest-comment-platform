import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per-instance, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20; // max requests per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || "unknown";
    if (isRateLimited(clientIp)) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();

    // Input size limit: reject payloads > 5KB
    if (body.length > 5000) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { comments, language } = JSON.parse(body);

    // Validate language is a string and reasonable length
    if (!language || typeof language !== "string" || language.length > 10) {
      return new Response(JSON.stringify({ error: "Invalid language" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate comments is an object with string values
    if (!comments || typeof comments !== "object" || Array.isArray(comments)) {
      return new Response(JSON.stringify({ error: "Invalid comments format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit number of comment fields and individual comment length
    const keys = Object.keys(comments);
    if (keys.length > 20) {
      return new Response(JSON.stringify({ error: "Too many comment fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const key of keys) {
      if (typeof comments[key] !== "string") {
        return new Response(JSON.stringify({ error: "Comment values must be strings" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (comments[key].length > 2000) {
        return new Response(JSON.stringify({ error: `Comment "${key}" exceeds maximum length` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // If language is English or no comments, return as-is
    if (language === "en") {
      return new Response(JSON.stringify({ translated: comments, original: comments }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if there are any non-empty comments
    const hasContent = Object.values(comments).some((v: unknown) => typeof v === "string" && v.trim().length > 0);
    if (!hasContent) {
      return new Response(JSON.stringify({ translated: comments, original: comments }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const commentEntries = Object.entries(comments).map(([k, v]) => `"${k}": "${v}"`).join(",\n");
    const prompt = `You MUST translate these guest feedback comments from ${language} into English.
Output ONLY a JSON object with the SAME keys but with values translated to ENGLISH.
Empty values stay empty. No markdown, no explanation, ONLY the JSON.

Input (in ${language}):
{${commentEntries}}

Output (in English):`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a professional translator. You translate text into English. You respond ONLY with valid JSON. Never return the original text - always translate to English." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text();
      console.error("AI translation error:", aiResponse.status, errBody);
      return new Response(JSON.stringify({ translated: comments, original: comments }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    console.log("AI response:", JSON.stringify(aiData));
    let content = aiData.choices?.[0]?.message?.content?.trim() || "";
    console.log("AI content:", content);

    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const translated = JSON.parse(content);
    console.log("Parsed translated:", JSON.stringify(translated));

    return new Response(JSON.stringify({ translated, original: comments }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("translate-comments error:", err);
    return new Response(JSON.stringify({ error: "Translation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
