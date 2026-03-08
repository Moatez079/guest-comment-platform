import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

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

// Use Google Translate free API as primary, AI gateway as fallback
async function translateText(text: string, sourceLang: string): Promise<string> {
  if (!text || !text.trim()) return text;
  
  // Try Google Translate free endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      // Response format: [[["translated text","original text",null,null,num]],null,"lang"]
      if (data && data[0]) {
        const translated = data[0].map((seg: any) => seg[0]).join("");
        if (translated && translated.trim()) return translated;
      }
    }
  } catch (e) {
    console.error("Google translate error:", e);
  }

  // Fallback: try AI gateway
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "Translate to English. Return ONLY the translation, nothing else." },
            { role: "user", content: text },
          ],
          temperature: 0.1,
        }),
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        const content = aiData.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      } else {
        const errBody = await aiRes.text();
        console.error("AI fallback error:", aiRes.status, errBody);
      }
    }
  } catch (e) {
    console.error("AI fallback error:", e);
  }

  return text; // Return original if all fails
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || "unknown";
    if (isRateLimited(clientIp)) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();
    if (body.length > 5000) {
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { comments, language } = JSON.parse(body);

    if (!language || typeof language !== "string" || language.length > 10) {
      return new Response(JSON.stringify({ error: "Invalid language" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!comments || typeof comments !== "object" || Array.isArray(comments)) {
      return new Response(JSON.stringify({ error: "Invalid comments format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If English, return as-is
    if (language === "en") {
      return new Response(JSON.stringify({ translated: comments, original: comments }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const keys = Object.keys(comments);
    if (keys.length > 20) {
      return new Response(JSON.stringify({ error: "Too many fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if there's any content to translate
    const hasContent = Object.values(comments).some((v: unknown) => typeof v === "string" && v.trim().length > 0);
    if (!hasContent) {
      return new Response(JSON.stringify({ translated: comments, original: comments }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Translate each comment individually
    const translated: Record<string, string> = {};
    for (const key of keys) {
      const val = comments[key];
      if (typeof val !== "string" || !val.trim()) {
        translated[key] = val || "";
      } else {
        translated[key] = await translateText(val, language);
      }
    }

    console.log("Translation complete:", JSON.stringify({ original: comments, translated }));

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
