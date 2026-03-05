import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { ship_id } = await req.json();
    if (!ship_id) {
      return new Response(JSON.stringify({ error: "ship_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch feedback
    const { data: feedback, error: dbError } = await supabase
      .from("feedback")
      .select("room_number, language, ratings, comments, submitted_at")
      .eq("ship_id", ship_id)
      .order("submitted_at", { ascending: false })
      .limit(500);

    if (dbError) {
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!feedback || feedback.length === 0) {
      return new Response(JSON.stringify({ error: "No feedback data found for this ship." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a cruise ship guest feedback analyst. Analyze the following guest feedback data and return a JSON report.

FEEDBACK DATA (${feedback.length} responses):
${JSON.stringify(feedback, null, 1)}

Return ONLY valid JSON with this exact structure:
{
  "executive_summary": "2-3 sentence overview",
  "total_responses": ${feedback.length},
  "average_ratings": {
    "services": {"reception": 0, "laundry": 0, "housekeeping": 0, "cabins": 0, "cleanliness": 0, "maintenance": 0, "average": 0},
    "facilities": {"restaurant": 0, "lounge_bar": 0, "sundeck_bar": 0, "swimming_pool": 0, "average": 0},
    "food": {"quality": 0, "quantity": 0, "variety": 0, "average": 0},
    "overall_average": 0
  },
  "top_performing": [{"area": "", "score": 0, "note": ""}],
  "needs_improvement": [{"area": "", "score": 0, "impact": "high|medium|low", "suggestion": ""}],
  "recurring_issues": [{"issue": "", "frequency": "common|occasional|rare", "affected_area": ""}],
  "sentiment_analysis": {
    "overall": "very_positive|positive|mixed|negative|very_negative",
    "positive_highlights": [],
    "negative_highlights": [],
    "notable_comments": [{"original": "", "translated": "", "sentiment": "", "language": ""}]
  },
  "language_distribution": [{"language": "", "count": 0, "percentage": 0}],
  "recommendations": [{"priority": "high|medium|low", "title": "", "description": "", "expected_impact": ""}],
  "generated_at": "${new Date().toISOString()}"
}

Rating scale: excellent=4(100%), veryGood=3(75%), good=2(50%), fair=1(25%). Convert all scores to percentages.
Translate any non-English comments to English in notable_comments.
Provide at least 3 recommendations sorted by priority.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a data analyst. Return only valid JSON, no markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const body = await aiResponse.text();
      console.error("AI gateway error:", status, body);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a minute." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: `AI gateway error (${status})` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "AI returned empty response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const report = JSON.parse(jsonStr);

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-feedback error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
