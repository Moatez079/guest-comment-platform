/**
 * Local (client-side) feedback analysis engine.
 * No AI, no API calls, no credits – always free & instant.
 */

type FeedbackRow = {
  id: string;
  room_number: string;
  language: string;
  ratings: any;
  comments: any;
  submitted_at: string;
};

type AnalysisReport = {
  executive_summary: string;
  total_responses: number;
  average_ratings: {
    services: Record<string, number>;
    facilities: Record<string, number>;
    food: Record<string, number>;
    overall_average: number;
  };
  top_performing: { area: string; score: number; note: string }[];
  needs_improvement: { area: string; score: number; impact: string; suggestion: string }[];
  recurring_issues: { issue: string; frequency: string; affected_area: string }[];
  sentiment_analysis: {
    overall: string;
    positive_highlights: string[];
    negative_highlights: string[];
    notable_comments: { original: string; translated: string; sentiment: string; language: string }[];
  };
  language_distribution: { language: string; count: number; percentage: number }[];
  recommendations: { priority: string; title: string; description: string; expected_impact: string }[];
  generated_at: string;
};

const RATING_MAP: Record<string, number> = { excellent: 4, veryGood: 3, good: 2, fair: 1 };
const RATING_PERCENT: Record<string, number> = { excellent: 100, veryGood: 75, good: 50, fair: 25 };

const LABEL_MAP: Record<string, { label: string; section: string }> = {
  services_reception: { label: "Reception", section: "services" },
  services_laundry: { label: "Laundry", section: "services" },
  services_housekeeping: { label: "Housekeeping", section: "services" },
  services_cabins: { label: "Cabins", section: "services" },
  services_cleanliness: { label: "Cleanliness", section: "services" },
  services_maintenance: { label: "Maintenance", section: "services" },
  facilities_restaurant: { label: "Restaurant", section: "facilities" },
  facilities_loungeBar: { label: "Lounge Bar", section: "facilities" },
  facilities_sundeckBar: { label: "Sundeck Bar", section: "facilities" },
  facilities_swimmingPool: { label: "Swimming Pool", section: "facilities" },
  food_quality: { label: "Food Quality", section: "food" },
  food_quantity: { label: "Food Quantity", section: "food" },
  food_variety: { label: "Food Variety", section: "food" },
};

const IMPROVEMENT_SUGGESTIONS: Record<string, string> = {
  services_reception: "Consider additional staff training for front-desk interactions and reduce wait times.",
  services_laundry: "Review turnaround times and garment handling procedures.",
  services_housekeeping: "Increase inspection frequency and provide checklists for cabin turnover.",
  services_cabins: "Inspect furnishings and amenities; address common complaints about comfort.",
  services_cleanliness: "Implement more rigorous cleaning schedules in public areas.",
  services_maintenance: "Prioritize preventive maintenance and faster response to reported issues.",
  facilities_restaurant: "Evaluate seating capacity, ambiance, and service speed during peak hours.",
  facilities_loungeBar: "Review drink quality, service speed, and entertainment offerings.",
  facilities_sundeckBar: "Ensure adequate seating, shade, and drink availability.",
  facilities_swimmingPool: "Monitor water quality, pool hours, and surrounding cleanliness.",
  food_quality: "Source higher-quality ingredients and ensure consistent preparation standards.",
  food_quantity: "Adjust portion sizes and monitor buffet replenishment frequency.",
  food_variety: "Introduce rotating menus and accommodate more dietary preferences.",
};

export function generateLocalAnalysis(feedbackList: FeedbackRow[]): AnalysisReport {
  const total = feedbackList.length;

  // ── Per-item averages ──
  const itemSums: Record<string, { sum: number; count: number }> = {};
  feedbackList.forEach((f) => {
    if (f.ratings && typeof f.ratings === "object") {
      Object.entries(f.ratings as Record<string, string>).forEach(([key, val]) => {
        if (RATING_PERCENT[val] !== undefined) {
          if (!itemSums[key]) itemSums[key] = { sum: 0, count: 0 };
          itemSums[key].sum += RATING_PERCENT[val];
          itemSums[key].count++;
        }
      });
    }
  });

  const itemAvgs: Record<string, number> = {};
  for (const [key, { sum, count }] of Object.entries(itemSums)) {
    itemAvgs[key] = Math.round(sum / count);
  }

  // ── Section averages ──
  const sectionCalc = (sec: string) => {
    const items = Object.entries(itemAvgs).filter(([k]) => LABEL_MAP[k]?.section === sec);
    if (items.length === 0) return { avg: 0, details: {} as Record<string, number> };
    const details: Record<string, number> = {};
    let total = 0;
    items.forEach(([k, v]) => {
      const label = LABEL_MAP[k]?.label || k;
      details[label.toLowerCase().replace(/ /g, "_")] = v;
      total += v;
    });
    details.average = Math.round(total / items.length);
    return { avg: details.average, details };
  };

  const services = sectionCalc("services");
  const facilities = sectionCalc("facilities");
  const food = sectionCalc("food");
  const overallAvg = Math.round(
    ([services.avg, facilities.avg, food.avg].filter(Boolean).reduce((a, b) => a + b, 0)) /
    [services.avg, facilities.avg, food.avg].filter(Boolean).length || 1
  );

  // ── Top & bottom performers ──
  const sorted = Object.entries(itemAvgs)
    .map(([key, score]) => ({ key, score, label: LABEL_MAP[key]?.label || key }))
    .sort((a, b) => b.score - a.score);

  const topPerforming = sorted.slice(0, 3).map((item) => ({
    area: item.label,
    score: item.score,
    note: item.score >= 90 ? "Consistently rated excellent by guests." :
          item.score >= 75 ? "Strong performance, well-received by guests." :
          "Above average but room for improvement.",
  }));

  const needsImprovement = sorted.slice(-3).reverse().map((item) => ({
    area: item.label,
    score: item.score,
    impact: item.score < 40 ? "high" : item.score < 60 ? "medium" : "low",
    suggestion: IMPROVEMENT_SUGGESTIONS[item.key] || "Review guest feedback and address common concerns.",
  })).filter((item) => item.score < 80);

  // ── Rating distribution for recurring issues ──
  const fairCounts: Record<string, number> = {};
  feedbackList.forEach((f) => {
    if (f.ratings && typeof f.ratings === "object") {
      Object.entries(f.ratings as Record<string, string>).forEach(([key, val]) => {
        if (val === "fair") {
          fairCounts[key] = (fairCounts[key] || 0) + 1;
        }
      });
    }
  });

  const recurringIssues = Object.entries(fairCounts)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([key, count]) => ({
      issue: `Low ratings for ${LABEL_MAP[key]?.label || key}`,
      frequency: count >= total * 0.5 ? "common" : count >= total * 0.2 ? "occasional" : "rare",
      affected_area: LABEL_MAP[key]?.section || "general",
    }));

  // ── Sentiment (based on scores) ──
  const overallSentiment = overallAvg >= 85 ? "very_positive" :
    overallAvg >= 70 ? "positive" :
    overallAvg >= 50 ? "mixed" :
    overallAvg >= 30 ? "negative" : "very_negative";

  const positiveHighlights = topPerforming.map((t) => `${t.area} rated at ${t.score}%`);
  const negativeHighlights = needsImprovement.map((t) => `${t.area} rated at ${t.score}%`);

  // ── Notable comments (up to 5 that have text) ──
  const notableComments: { original: string; translated: string; sentiment: string; language: string }[] = [];
  for (const f of feedbackList) {
    if (notableComments.length >= 5) break;
    if (f.comments && typeof f.comments === "object") {
      for (const [, val] of Object.entries(f.comments as Record<string, string>)) {
        if (val && typeof val === "string" && val.trim().length > 5 && notableComments.length < 5) {
          notableComments.push({
            original: val.trim(),
            translated: val.trim(), // No AI translation available
            sentiment: overallAvg >= 60 ? "positive" : "negative",
            language: f.language || "en",
          });
        }
      }
    }
  }

  // ── Language distribution ──
  const langCounts: Record<string, number> = {};
  feedbackList.forEach((f) => {
    const l = (f.language || "en").toUpperCase();
    langCounts[l] = (langCounts[l] || 0) + 1;
  });
  const languageDistribution = Object.entries(langCounts)
    .map(([language, count]) => ({ language, count, percentage: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);

  // ── Recommendations ──
  const recommendations: { priority: string; title: string; description: string; expected_impact: string }[] = [];

  if (needsImprovement.length > 0) {
    const worst = needsImprovement[0];
    recommendations.push({
      priority: "high",
      title: `Improve ${worst.area}`,
      description: worst.suggestion,
      expected_impact: `Could raise ${worst.area} score from ${worst.score}% to 70%+ with targeted improvements.`,
    });
  }

  if (recurringIssues.length > 0) {
    recommendations.push({
      priority: "high",
      title: "Address Recurring Low Ratings",
      description: `Multiple guests consistently rate ${recurringIssues.map((r) => r.issue.replace("Low ratings for ", "")).join(", ")} poorly. Investigate root causes.`,
      expected_impact: "Reducing recurring complaints improves overall satisfaction significantly.",
    });
  }

  if (overallAvg < 75) {
    recommendations.push({
      priority: "medium",
      title: "Overall Quality Enhancement",
      description: "Focus on consistent service quality across all departments. Regular training and quality audits recommended.",
      expected_impact: "Comprehensive improvements typically yield 10-15% increase in overall satisfaction.",
    });
  }

  recommendations.push({
    priority: "low",
    title: "Continue Monitoring Feedback",
    description: "Maintain regular feedback collection and review cycles to track improvement over time.",
    expected_impact: "Continuous monitoring ensures sustained quality and early detection of issues.",
  });

  // ── Executive summary ──
  const executiveSummary = `Based on ${total} guest feedback responses, the overall satisfaction score is ${overallAvg}%. ${
    topPerforming.length > 0 ? `${topPerforming[0].area} leads at ${topPerforming[0].score}%.` : ""
  } ${
    needsImprovement.length > 0
      ? `${needsImprovement[0].area} requires attention at ${needsImprovement[0].score}%.`
      : "All areas are performing well."
  } Guest feedback spans ${languageDistribution.length} language${languageDistribution.length !== 1 ? "s" : ""}.`;

  return {
    executive_summary: executiveSummary,
    total_responses: total,
    average_ratings: {
      services: services.details,
      facilities: facilities.details,
      food: food.details,
      overall_average: overallAvg,
    },
    top_performing: topPerforming,
    needs_improvement: needsImprovement,
    recurring_issues: recurringIssues,
    sentiment_analysis: {
      overall: overallSentiment,
      positive_highlights: positiveHighlights,
      negative_highlights: negativeHighlights,
      notable_comments: notableComments,
    },
    language_distribution: languageDistribution,
    recommendations: recommendations,
    generated_at: new Date().toISOString(),
  };
}
