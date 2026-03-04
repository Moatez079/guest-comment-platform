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
    const { ship_id } = await req.json();
    if (!ship_id) {
      return new Response(JSON.stringify({ error: "ship_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all feedback for this ship
    const { data: feedbackData, error: feedbackError } = await supabase
      .from("feedback")
      .select("*")
      .eq("ship_id", ship_id)
      .order("submitted_at", { ascending: false });

    if (feedbackError) {
      console.error("Feedback fetch error:", feedbackError);
      return new Response(JSON.stringify({ error: "Failed to fetch feedback" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!feedbackData || feedbackData.length === 0) {
      return new Response(JSON.stringify({ error: "No feedback data available for analysis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare feedback summary for AI
    const feedbackSummary = feedbackData.map((f: any) => ({
      room: f.room_number,
      language: f.language,
      ratings: f.ratings,
      comments: f.comments,
      date: f.submitted_at,
    }));

    const systemPrompt = `You are an expert cruise ship guest experience analyst. Analyze the following guest feedback data from a cruise ship and provide a comprehensive report in English.

Your analysis MUST include:
1. **Executive Summary** - Brief overview of overall satisfaction
2. **Average Ratings** - Calculate average for each rated item (Reception, Laundry, Housekeeping, Cabins, Cleanliness, Maintenance, Restaurant, Lounge Bar, Sundeck Bar, Swimming Pool, Food Quality, Food Quantity, Food Variety). Rate as percentage where excellent=100, veryGood=75, good=50, fair=25.
3. **Top Performing Areas** - Areas with highest ratings
4. **Areas Needing Improvement** - Areas with lowest ratings, prioritized by impact
5. **Recurring Issues** - Common complaints or patterns detected
6. **Sentiment Analysis** - Overall sentiment from free-text comments, translated to English if in other languages
7. **Guest Language Distribution** - Breakdown of guest nationalities/languages
8. **Actionable Recommendations** - Specific, prioritized suggestions for improvement
9. **Trend Summary** - Any trends noticed over time

Format the response as a structured JSON object with these sections.`;

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Analyze these ${feedbackData.length} guest feedback submissions:\n\n${JSON.stringify(feedbackSummary, null, 2)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_analysis_report",
              description: "Generate a structured cruise feedback analysis report",
              parameters: {
                type: "object",
                properties: {
                  executive_summary: {
                    type: "string",
                    description: "Brief overview of overall guest satisfaction",
                  },
                  total_responses: { type: "number" },
                  average_ratings: {
                    type: "object",
                    description: "Average rating percentage for each service item",
                    properties: {
                      services: {
                        type: "object",
                        properties: {
                          reception: { type: "number" },
                          laundry: { type: "number" },
                          housekeeping: { type: "number" },
                          cabins: { type: "number" },
                          cleanliness: { type: "number" },
                          maintenance: { type: "number" },
                          average: { type: "number" },
                        },
                        required: ["reception", "laundry", "housekeeping", "cabins", "cleanliness", "maintenance", "average"],
                        additionalProperties: false,
                      },
                      facilities: {
                        type: "object",
                        properties: {
                          restaurant: { type: "number" },
                          lounge_bar: { type: "number" },
                          sundeck_bar: { type: "number" },
                          swimming_pool: { type: "number" },
                          average: { type: "number" },
                        },
                        required: ["restaurant", "lounge_bar", "sundeck_bar", "swimming_pool", "average"],
                        additionalProperties: false,
                      },
                      food: {
                        type: "object",
                        properties: {
                          quality: { type: "number" },
                          quantity: { type: "number" },
                          variety: { type: "number" },
                          average: { type: "number" },
                        },
                        required: ["quality", "quantity", "variety", "average"],
                        additionalProperties: false,
                      },
                      overall_average: { type: "number" },
                    },
                    required: ["services", "facilities", "food", "overall_average"],
                    additionalProperties: false,
                  },
                  top_performing: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        area: { type: "string" },
                        score: { type: "number" },
                        note: { type: "string" },
                      },
                      required: ["area", "score", "note"],
                      additionalProperties: false,
                    },
                  },
                  needs_improvement: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        area: { type: "string" },
                        score: { type: "number" },
                        impact: { type: "string", enum: ["high", "medium", "low"] },
                        suggestion: { type: "string" },
                      },
                      required: ["area", "score", "impact", "suggestion"],
                      additionalProperties: false,
                    },
                  },
                  recurring_issues: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        issue: { type: "string" },
                        frequency: { type: "string" },
                        affected_area: { type: "string" },
                      },
                      required: ["issue", "frequency", "affected_area"],
                      additionalProperties: false,
                    },
                  },
                  sentiment_analysis: {
                    type: "object",
                    properties: {
                      overall: { type: "string", enum: ["very_positive", "positive", "neutral", "negative", "very_negative"] },
                      positive_highlights: {
                        type: "array",
                        items: { type: "string" },
                      },
                      negative_highlights: {
                        type: "array",
                        items: { type: "string" },
                      },
                      notable_comments: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            original: { type: "string" },
                            translated: { type: "string" },
                            sentiment: { type: "string" },
                            language: { type: "string" },
                          },
                          required: ["original", "translated", "sentiment", "language"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["overall", "positive_highlights", "negative_highlights", "notable_comments"],
                    additionalProperties: false,
                  },
                  language_distribution: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        language: { type: "string" },
                        count: { type: "number" },
                        percentage: { type: "number" },
                      },
                      required: ["language", "count", "percentage"],
                      additionalProperties: false,
                    },
                  },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        expected_impact: { type: "string" },
                      },
                      required: ["priority", "title", "description", "expected_impact"],
                      additionalProperties: false,
                    },
                  },
                },
                required: [
                  "executive_summary",
                  "total_responses",
                  "average_ratings",
                  "top_performing",
                  "needs_improvement",
                  "recurring_issues",
                  "sentiment_analysis",
                  "language_distribution",
                  "recommendations",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_analysis_report" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }), {
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
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      return new Response(JSON.stringify({ error: "AI did not return structured analysis" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let report;
    try {
      report = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return new Response(JSON.stringify({ error: "Failed to parse AI analysis" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add metadata
    report.generated_at = new Date().toISOString();
    report.ship_id = ship_id;

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-feedback error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
