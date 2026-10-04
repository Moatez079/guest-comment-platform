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

// 5-tier translation: Gemini (free AI Studio key) → Google → LibreTranslate → MyMemory → Lingva
async function translateText(text: string, sourceLang: string): Promise<string> {
  if (!text || !text.trim()) return text;

  // 1) Gemini via Google AI Studio free tier
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (geminiKey) {
    try {
      const gRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Translate the following guest feedback comment from language code "${sourceLang}" to English. Return ONLY the translated text, no quotes, no explanation.\n\n${text}`,
              }],
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 1024 },
          }),
        }
      );
      if (gRes.ok) {
        const gData = await gRes.json();
        const out = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (out && out.trim()) {
          console.log("Translated via Gemini");
          return out.trim();
        }
      } else {
        await gRes.text(); // consume body
      }
    } catch (e) {
      console.error("Gemini translate error:", e);
    }
  }

  // 2) Google Translate free endpoint
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data[0]) {
        const translated = data[0].map((seg: any) => seg[0]).join("");
        if (translated && translated.trim()) {
          console.log("Translated via Google");
          return translated;
        }
      }
    }
  } catch (e) {
    console.error("Google translate error:", e);
  }

  // 2) LibreTranslate (free, no API key needed)
  try {
    const libreRes = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: sourceLang === "zh" ? "zh" : sourceLang,
        target: "en",
        format: "text",
      }),
    });
    if (libreRes.ok) {
      const libreData = await libreRes.json();
      if (libreData?.translatedText?.trim()) {
        console.log("Translated via LibreTranslate");
        return libreData.translatedText;
      }
    } else {
      await libreRes.text(); // consume body
    }
  } catch (e) {
    console.error("LibreTranslate error:", e);
  }

  // 3) MyMemory (free, no key, no credits)
  try {
    const mmRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${sourceLang}|en`);
    if (mmRes.ok) {
      const mm = await mmRes.json();
      const out = mm?.responseData?.translatedText;
      if (out && out.trim() && !/MYMEMORY WARNING|INVALID/i.test(out)) {
        console.log("Translated via MyMemory");
        return out;
      }
    } else { await mmRes.text(); }
  } catch (e) {
    console.error("MyMemory error:", e);
  }

  // 4) Lingva (free Google mirror, no key, no credits)
  for (const host of ["https://lingva.ml", "https://lingva.lunar.icu"]) {
    try {
      const lvRes = await fetch(`${host}/api/v1/${sourceLang}/en/${encodeURIComponent(text)}`);
      if (lvRes.ok) {
        const lv = await lvRes.json();
        if (lv?.translation?.trim() && lv.translation.trim() !== text.trim()) {
          console.log("Translated via Lingva");
          return lv.translation;
        }
      } else { await lvRes.text(); }
    } catch (e) {
      console.error("Lingva error:", e);
    }
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
