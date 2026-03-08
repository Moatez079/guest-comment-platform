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
    // --- JWT Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user's JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const { ship_id } = await req.json();
    if (!ship_id) {
      return new Response(JSON.stringify({ error: "ship_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Authorization: check ship membership or system_owner role ---
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: isMember } = await serviceClient.rpc("is_ship_member", {
      _user_id: userId,
      _ship_id: ship_id,
    });

    const { data: isOwner } = await serviceClient.rpc("has_role", {
      _user_id: userId,
      _role: "system_owner",
    });

    if (!isMember && !isOwner) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this ship" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Check account is approved ---
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("status")
      .eq("user_id", userId)
      .single();

    if (profile?.status !== "approved" && !isOwner) {
      return new Response(JSON.stringify({ error: "Account not approved" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Fetch feedback ---
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: feedback, error: dbError } = await serviceClient
      .from("feedback")
      .select("room_number, language, ratings, comments, submitted_at")
      .eq("ship_id", ship_id)
      .order("submitted_at", { ascending: false })
      .limit(500);

    if (dbError) {
      return new Response(JSON.stringify({ error: "Failed to fetch feedback" }), {
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
      console.error("AI gateway error:", status);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a minute." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
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
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
