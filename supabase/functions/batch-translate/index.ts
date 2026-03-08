import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function translateText(text: string, sourceLang: string): Promise<string> {
  if (!text || !text.trim()) return text;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data[0]) {
        const translated = data[0].map((seg: any) => seg[0]).join("");
        if (translated && translated.trim()) return translated;
      }
    } else {
      await res.text();
    }
  } catch (e) {
    console.error("Translation error:", e);
  }
  return text;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all non-English feedback with non-empty comments
    const { data: feedbacks, error } = await supabase
      .from("feedback")
      .select("id, language, comments")
      .neq("language", "en");

    if (error) throw error;

    let translated = 0;
    for (const fb of feedbacks || []) {
      const comments = fb.comments as Record<string, string>;
      const hasContent = Object.values(comments).some((v) => typeof v === "string" && v.trim().length > 0);
      if (!hasContent) continue;

      // Check if comments look like they're already in English (basic heuristic)
      const newComments: Record<string, string> = {};
      let changed = false;

      for (const [key, val] of Object.entries(comments)) {
        if (!val || !val.trim()) {
          newComments[key] = val || "";
          continue;
        }
        const translatedVal = await translateText(val, fb.language);
        newComments[key] = translatedVal;
        if (translatedVal !== val) changed = true;
      }

      if (changed) {
        await supabase.from("feedback").update({ comments: newComments }).eq("id", fb.id);
        translated++;
        console.log(`Translated feedback ${fb.id} (${fb.language})`);
      }
    }

    return new Response(JSON.stringify({ success: true, translated, total: feedbacks?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("batch-translate error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
