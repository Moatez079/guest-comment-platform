import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { comments, language } = await req.json();

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

    const prompt = `Translate the following guest feedback comments to English. The original language is "${language}".
Return ONLY a valid JSON object with the same keys, where each value is the English translation.
If a value is empty, keep it empty.
Do NOT add any explanation, just the JSON.

Comments:
${JSON.stringify(comments)}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a translator. Return only valid JSON, no markdown, no explanation." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI translation error:", aiResponse.status);
      // Fallback: return original comments if translation fails
      return new Response(JSON.stringify({ translated: comments, original: comments }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content?.trim() || "";

    // Strip markdown code blocks if present
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const translated = JSON.parse(content);

    return new Response(JSON.stringify({ translated, original: comments }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("translate-comments error:", err);
    // Fallback: return original
    const body = await req.clone().json().catch(() => ({ comments: {} }));
    return new Response(JSON.stringify({ translated: body.comments, original: body.comments }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
