import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSlidePrompts(report: any, shipName: string): string[] {
  const prompts: string[] = [];

  // Slide 1: Title
  prompts.push(
    `Create a professional presentation title slide for a cruise ship feedback report. The slide should have a dark navy blue gradient background with subtle golden accents. Display the title "Guest Feedback Analysis Report" in large elegant white text centered on the slide. Below the title show "${shipName || "Cruise Ship"}" in golden text. At the bottom show "Generated: ${new Date(report.generated_at).toLocaleDateString()}" and "Total Responses: ${report.total_responses}" in smaller white text. The design should feel premium, corporate, and nautical-themed. 16:9 aspect ratio presentation slide. Ultra high resolution.`
  );

  // Slide 2: Executive Summary
  prompts.push(
    `Create a professional presentation slide with a clean dark navy blue background and golden accents. Title at the top: "Executive Summary" in large white bold text with a golden underline. Below it, display the following text in white readable font on the slide: "${report.executive_summary.slice(0, 300)}". At the bottom show three rounded badges: "Overall Score: ${report.average_ratings.overall_average}%", "${report.total_responses} Responses", "Sentiment: ${report.sentiment_analysis.overall.replace(/_/g, " ")}". 16:9 aspect ratio presentation slide. Ultra high resolution.`
  );

  // Slide 3: Overall Ratings
  const svc = report.average_ratings.services;
  const fac = report.average_ratings.facilities;
  const food = report.average_ratings.food;
  prompts.push(
    `Create a professional presentation slide with dark navy blue background. Title: "Average Ratings Overview" in white with golden underline. Show three columns: Left column titled "Services ${svc.average}%" with items: Reception ${svc.reception}%, Laundry ${svc.laundry}%, Housekeeping ${svc.housekeeping}%, Cabins ${svc.cabins}%, Cleanliness ${svc.cleanliness}%, Maintenance ${svc.maintenance}%. Middle column titled "Facilities ${fac.average}%" with items: Restaurant ${fac.restaurant}%, Lounge Bar ${fac.lounge_bar}%, Sundeck Bar ${fac.sundeck_bar}%, Pool ${fac.swimming_pool}%. Right column titled "Food & Beverage ${food.average}%" with items: Quality ${food.quality}%, Quantity ${food.quantity}%, Variety ${food.variety}%. Use horizontal bar charts with golden fill. Overall average "${report.average_ratings.overall_average}%" displayed prominently. 16:9 presentation slide. Ultra high resolution.`
  );

  // Slide 4: Top Performing
  const topItems = report.top_performing
    .slice(0, 5)
    .map((t: any) => `${t.area}: ${t.score}% - ${t.note}`)
    .join(". ");
  prompts.push(
    `Create a professional presentation slide with dark navy blue background. Title: "Top Performing Areas" in white with a green accent underline and a green checkmark icon. List the following items with green accent bars and white text: ${topItems}. Each item should have the area name, score percentage, and a brief note. Use a clean corporate layout with good spacing. 16:9 presentation slide. Ultra high resolution.`
  );

  // Slide 5: Areas Needing Improvement
  const impItems = report.needs_improvement
    .slice(0, 5)
    .map((t: any) => `${t.area}: ${t.score}% [${t.impact} impact] - ${t.suggestion}`)
    .join(". ");
  prompts.push(
    `Create a professional presentation slide with dark navy blue background. Title: "Areas Needing Improvement" in white with an amber/orange accent underline and a warning triangle icon. List items with amber accent bars and white text: ${impItems}. Show impact level badges (high=red, medium=amber, low=gray). Clean corporate layout. 16:9 presentation slide. Ultra high resolution.`
  );

  // Slide 6: Recurring Issues & Sentiment
  const issues = report.recurring_issues
    .slice(0, 4)
    .map((i: any) => `${i.issue} (${i.frequency}) in ${i.affected_area}`)
    .join(". ");
  const posHL = report.sentiment_analysis.positive_highlights.slice(0, 3).join(", ");
  const negHL = report.sentiment_analysis.negative_highlights.slice(0, 3).join(", ");
  prompts.push(
    `Create a professional presentation slide with dark navy blue background split into two sections. Left section titled "Recurring Issues" with a red accent, listing: ${issues}. Right section titled "Sentiment Analysis" showing overall sentiment "${report.sentiment_analysis.overall.replace(/_/g, " ")}" with green positives: ${posHL || "None"}, and red negatives: ${negHL || "None"}. Clean corporate design. 16:9 presentation slide. Ultra high resolution.`
  );

  // Slide 7: Recommendations
  const recs = report.recommendations
    .slice(0, 5)
    .map((r: any, i: number) => `${i + 1}. [${r.priority}] ${r.title}: ${r.description}`)
    .join(". ");
  prompts.push(
    `Create a professional presentation slide with dark navy blue background. Title: "Actionable Recommendations" in white with golden underline and a lightbulb icon. List numbered recommendations with priority badges (high=red, medium=amber, low=green): ${recs}. Clean corporate layout with good hierarchy. 16:9 presentation slide. Ultra high resolution.`
  );

  // Slide 8: Language Distribution & Thank You
  const langs = report.language_distribution
    .slice(0, 6)
    .map((l: any) => `${l.language}: ${l.count} (${l.percentage}%)`)
    .join(", ");
  prompts.push(
    `Create a professional presentation closing slide with dark navy blue gradient background and golden accents. Top section shows "Guest Language Distribution" with a simple donut or bar chart visualization showing: ${langs}. Below that, large centered text "Thank You" in elegant golden font. Subtitle: "Guest Comment - AI Powered Analytics" in white. Nautical-themed decorative elements. 16:9 presentation slide. Ultra high resolution.`
  );

  return prompts;
}

async function generateSlideImage(
  prompt: string,
  apiKey: string
): Promise<string | null> {
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("Image generation failed:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    
    // Extract image from response - the model returns inline_data with base64
    const content = data.choices?.[0]?.message?.content;
    
    // Check for parts with inline images
    const parts = data.choices?.[0]?.message?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inline_data?.data) {
          return part.inline_data.data;
        }
      }
    }
    
    // Some responses may have the image in a different format
    if (typeof content === "string" && content.startsWith("data:image")) {
      return content.split(",")[1];
    }
    
    // Try to extract from content array
    if (Array.isArray(content)) {
      for (const item of content) {
        if (item.type === "image_url" && item.image_url?.url) {
          const url = item.image_url.url;
          if (url.startsWith("data:image")) {
            return url.split(",")[1];
          }
        }
        if (item.inline_data?.data) {
          return item.inline_data.data;
        }
      }
    }

    console.error("No image found in response:", JSON.stringify(data).slice(0, 500));
    return null;
  } catch (e) {
    console.error("Slide generation error:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { report, ship_name } = await req.json();
    if (!report) {
      return new Response(JSON.stringify({ error: "report is required" }), {
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

    const prompts = buildSlidePrompts(report, ship_name || "");
    
    // Generate slides in parallel (batches of 3 to avoid rate limits)
    const slides: (string | null)[] = [];
    
    for (let i = 0; i < prompts.length; i += 3) {
      const batch = prompts.slice(i, i + 3);
      const results = await Promise.all(
        batch.map((prompt) => generateSlideImage(prompt, LOVABLE_API_KEY))
      );
      slides.push(...results);
      
      // Small delay between batches to avoid rate limits
      if (i + 3 < prompts.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const validSlides = slides.filter(Boolean);

    if (validSlides.length === 0) {
      return new Response(JSON.stringify({ error: "Failed to generate any slide images" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ slides: validSlides, total: validSlides.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-report-slides error:", e);

    if (e instanceof Error && e.message.includes("429")) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
