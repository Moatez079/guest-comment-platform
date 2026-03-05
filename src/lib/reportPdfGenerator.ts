/**
 * Professional PDF Report Generator — 100% client-side, zero API costs.
 * Uses jsPDF to create a multi-page landscape presentation-style report.
 */
import jsPDF from "jspdf";

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

// ── Color palette (nautical theme) ──
const COLORS = {
  navy: [15, 35, 75] as const,
  navyLight: [25, 55, 105] as const,
  gold: [200, 160, 60] as const,
  goldLight: [220, 185, 100] as const,
  white: [255, 255, 255] as const,
  lightGray: [240, 242, 247] as const,
  midGray: [180, 185, 195] as const,
  darkText: [30, 35, 50] as const,
  subText: [100, 110, 130] as const,
  green: [40, 160, 90] as const,
  red: [210, 60, 60] as const,
  orange: [230, 150, 40] as const,
  blue: [50, 120, 200] as const,
};

const W = 297; // A4 landscape width
const H = 210; // A4 landscape height
const MARGIN = 16;

function setColor(pdf: jsPDF, color: readonly [number, number, number]) {
  pdf.setTextColor(color[0], color[1], color[2]);
}

function setFill(pdf: jsPDF, color: readonly [number, number, number]) {
  pdf.setFillColor(color[0], color[1], color[2]);
}

function setDraw(pdf: jsPDF, color: readonly [number, number, number]) {
  pdf.setDrawColor(color[0], color[1], color[2]);
}

function roundedRect(pdf: jsPDF, x: number, y: number, w: number, h: number, r: number, fill: readonly [number, number, number]) {
  setFill(pdf, fill);
  pdf.roundedRect(x, y, w, h, r, r, "F");
}

function drawBar(pdf: jsPDF, x: number, y: number, w: number, h: number, pct: number, barColor: readonly [number, number, number]) {
  roundedRect(pdf, x, y, w, h, h / 2, COLORS.lightGray);
  if (pct > 0) {
    const fillW = Math.max(h, (pct / 100) * w);
    roundedRect(pdf, x, y, fillW, h, h / 2, barColor);
  }
}

function addFooter(pdf: jsPDF, pageNum: number, totalPages: number) {
  setColor(pdf, COLORS.midGray);
  pdf.setFontSize(7);
  pdf.text(`Page ${pageNum} of ${totalPages}`, W / 2, H - 6, { align: "center" });
  // Gold accent line at bottom
  setFill(pdf, COLORS.gold);
  pdf.rect(MARGIN, H - 10, W - MARGIN * 2, 0.5, "F");
}

function drawHeader(pdf: jsPDF, title: string, subtitle?: string) {
  // Navy header bar
  setFill(pdf, COLORS.navy);
  pdf.rect(0, 0, W, 28, "F");
  // Gold accent stripe
  setFill(pdf, COLORS.gold);
  pdf.rect(0, 28, W, 1.5, "F");
  // Title
  setColor(pdf, COLORS.white);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text(title, MARGIN, 13);
  if (subtitle) {
    setColor(pdf, COLORS.goldLight);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(subtitle, MARGIN, 21);
  }
}

function getScoreColor(score: number): readonly [number, number, number] {
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.blue;
  if (score >= 40) return COLORS.orange;
  return COLORS.red;
}

// ════════════════════════════════════════════════
//  SLIDE 1: COVER
// ════════════════════════════════════════════════
function drawCoverSlide(pdf: jsPDF, report: AnalysisReport, shipName: string) {
  // Full navy background
  setFill(pdf, COLORS.navy);
  pdf.rect(0, 0, W, H, "F");

  // Decorative gold lines
  setFill(pdf, COLORS.gold);
  pdf.rect(MARGIN, 55, 60, 1.5, "F");
  pdf.rect(MARGIN, H - 50, W - MARGIN * 2, 0.5, "F");

  // Anchor / wave icon placeholder (decorative circles)
  setFill(pdf, COLORS.navyLight);
  pdf.circle(W - 50, 45, 18, "F");
  setDraw(pdf, COLORS.gold);
  pdf.setLineWidth(0.8);
  pdf.circle(W - 50, 45, 18, "S");
  setColor(pdf, COLORS.gold);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("⚓", W - 55.5, 50);

  // Title
  setColor(pdf, COLORS.white);
  pdf.setFontSize(32);
  pdf.setFont("helvetica", "bold");
  pdf.text("Guest Feedback", MARGIN, 78);
  pdf.text("Analysis Report", MARGIN, 95);

  // Gold subtitle
  setColor(pdf, COLORS.gold);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "normal");
  pdf.text(shipName || "Cruise Ship", MARGIN, 115);

  // Stats row
  const statsY = 140;
  const statsData = [
    { label: "Total Responses", value: String(report.total_responses) },
    { label: "Overall Score", value: `${report.average_ratings.overall_average}%` },
    { label: "Sentiment", value: report.sentiment_analysis.overall.replace(/_/g, " ").toUpperCase() },
    { label: "Languages", value: String(report.language_distribution.length) },
  ];

  const statW = (W - MARGIN * 2 - 12) / 4;
  statsData.forEach((stat, i) => {
    const x = MARGIN + i * (statW + 4);
    roundedRect(pdf, x, statsY, statW, 30, 3, COLORS.navyLight);
    setColor(pdf, COLORS.gold);
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text(stat.value, x + statW / 2, statsY + 14, { align: "center" });
    setColor(pdf, COLORS.midGray);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(stat.label, x + statW / 2, statsY + 23, { align: "center" });
  });

  // Date
  setColor(pdf, COLORS.midGray);
  pdf.setFontSize(8);
  pdf.text(`Generated: ${new Date(report.generated_at).toLocaleString()}`, MARGIN, H - 40);
}

// ════════════════════════════════════════════════
//  SLIDE 2: EXECUTIVE SUMMARY
// ════════════════════════════════════════════════
function drawSummarySlide(pdf: jsPDF, report: AnalysisReport) {
  drawHeader(pdf, "Executive Summary", "Overview of guest feedback analysis");

  const startY = 38;

  // Summary box
  roundedRect(pdf, MARGIN, startY, W - MARGIN * 2, 32, 3, COLORS.lightGray);
  setColor(pdf, COLORS.darkText);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  const lines = pdf.splitTextToSize(report.executive_summary, W - MARGIN * 2 - 16);
  pdf.text(lines.slice(0, 4), MARGIN + 8, startY + 10);

  // Overall Score gauge
  const gaugeY = startY + 42;
  const gaugeW = 80;
  roundedRect(pdf, MARGIN, gaugeY, gaugeW, 50, 4, COLORS.navy);
  setColor(pdf, COLORS.gold);
  pdf.setFontSize(36);
  pdf.setFont("helvetica", "bold");
  pdf.text(`${report.average_ratings.overall_average}%`, MARGIN + gaugeW / 2, gaugeY + 25, { align: "center" });
  setColor(pdf, COLORS.white);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("Overall Score", MARGIN + gaugeW / 2, gaugeY + 38, { align: "center" });

  // Section scores
  const sections = [
    { name: "Services", data: report.average_ratings.services },
    { name: "Facilities", data: report.average_ratings.facilities },
    { name: "Food & Beverage", data: report.average_ratings.food },
  ];

  const secStartX = MARGIN + gaugeW + 8;
  const secW = (W - secStartX - MARGIN - 8) / 3;

  sections.forEach((sec, i) => {
    const x = secStartX + i * (secW + 4);
    const avg = sec.data.average || 0;
    roundedRect(pdf, x, gaugeY, secW, 50, 4, COLORS.lightGray);

    setColor(pdf, COLORS.darkText);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text(sec.name, x + 6, gaugeY + 10);

    setColor(pdf, getScoreColor(avg));
    pdf.setFontSize(22);
    pdf.text(`${avg}%`, x + secW - 8, gaugeY + 10, { align: "right" });

    // Mini bars for each item
    let itemY = gaugeY + 18;
    Object.entries(sec.data)
      .filter(([k]) => k !== "average")
      .slice(0, 5)
      .forEach(([key, val]) => {
        setColor(pdf, COLORS.subText);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        const label = key.replace(/_/g, " ");
        pdf.text(label.charAt(0).toUpperCase() + label.slice(1), x + 6, itemY + 2.5);
        drawBar(pdf, x + secW * 0.48, itemY, secW * 0.38, 3, val, getScoreColor(val));
        setColor(pdf, COLORS.darkText);
        pdf.setFontSize(7);
        pdf.text(`${val}%`, x + secW - 6, itemY + 2.5, { align: "right" });
        itemY += 6;
      });
  });

  // Sentiment badge
  const sentY = gaugeY + 58;
  const sentLabel = report.sentiment_analysis.overall.replace(/_/g, " ");
  const sentColor = report.average_ratings.overall_average >= 70 ? COLORS.green : 
                    report.average_ratings.overall_average >= 50 ? COLORS.orange : COLORS.red;
  roundedRect(pdf, MARGIN, sentY, 60, 12, 3, sentColor);
  setColor(pdf, COLORS.white);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Sentiment: ${sentLabel.toUpperCase()}`, MARGIN + 30, sentY + 7.5, { align: "center" });

  // Language distribution row
  if (report.language_distribution.length > 0) {
    let lx = MARGIN + 65;
    report.language_distribution.forEach((lang) => {
      roundedRect(pdf, lx, sentY, 28, 12, 3, COLORS.lightGray);
      setColor(pdf, COLORS.darkText);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text(lang.language, lx + 5, sentY + 7.5);
      setColor(pdf, COLORS.subText);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${lang.percentage}%`, lx + 22, sentY + 7.5, { align: "right" });
      lx += 32;
    });
  }
}

// ════════════════════════════════════════════════
//  SLIDE 3: DETAILED RATINGS
// ════════════════════════════════════════════════
function drawRatingsSlide(pdf: jsPDF, report: AnalysisReport) {
  drawHeader(pdf, "Detailed Ratings", "Performance breakdown by category");

  const allItems: { label: string; score: number; section: string }[] = [];

  const addSection = (data: Record<string, number>, section: string) => {
    Object.entries(data)
      .filter(([k]) => k !== "average")
      .forEach(([key, val]) => {
        allItems.push({
          label: key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          score: val,
          section,
        });
      });
  };

  addSection(report.average_ratings.services, "Services");
  addSection(report.average_ratings.facilities, "Facilities");
  addSection(report.average_ratings.food, "Food");

  // Sort by score desc
  allItems.sort((a, b) => b.score - a.score);

  const startY = 38;
  const rowH = 11;
  const barX = 80;
  const barW = W - MARGIN * 2 - barX - 30;

  // Table header
  setFill(pdf, COLORS.navy);
  pdf.rect(MARGIN, startY, W - MARGIN * 2, 8, "F");
  setColor(pdf, COLORS.white);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  pdf.text("CATEGORY", MARGIN + 4, startY + 5.5);
  pdf.text("SECTION", MARGIN + 50, startY + 5.5);
  pdf.text("SCORE", barX + barW + 4, startY + 5.5);

  allItems.forEach((item, i) => {
    const y = startY + 8 + i * rowH;
    // Alternate row background
    if (i % 2 === 0) {
      roundedRect(pdf, MARGIN, y, W - MARGIN * 2, rowH, 0, COLORS.lightGray);
    }

    setColor(pdf, COLORS.darkText);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(item.label, MARGIN + 4, y + 7);

    setColor(pdf, COLORS.subText);
    pdf.setFontSize(7);
    pdf.text(item.section, MARGIN + 50, y + 7);

    // Bar
    drawBar(pdf, barX, y + 3, barW, 5, item.score, getScoreColor(item.score));

    // Score value
    setColor(pdf, COLORS.darkText);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${item.score}%`, barX + barW + 6, y + 7);
  });
}

// ════════════════════════════════════════════════
//  SLIDE 4: TOP & IMPROVEMENT
// ════════════════════════════════════════════════
function drawPerformanceSlide(pdf: jsPDF, report: AnalysisReport) {
  drawHeader(pdf, "Performance Highlights", "Top performers and areas needing attention");

  const colW = (W - MARGIN * 2 - 8) / 2;
  const startY = 38;

  // ── Left: Top Performing ──
  roundedRect(pdf, MARGIN, startY, colW, 8, 2, COLORS.green);
  setColor(pdf, COLORS.white);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("✓  TOP PERFORMING", MARGIN + 6, startY + 5.5);

  report.top_performing.forEach((item, i) => {
    const y = startY + 12 + i * 24;
    roundedRect(pdf, MARGIN, y, colW, 20, 3, COLORS.lightGray);

    setColor(pdf, COLORS.darkText);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(item.area, MARGIN + 6, y + 8);

    setColor(pdf, COLORS.green);
    pdf.setFontSize(14);
    pdf.text(`${item.score}%`, MARGIN + colW - 8, y + 9, { align: "right" });

    setColor(pdf, COLORS.subText);
    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "normal");
    pdf.text(item.note, MARGIN + 6, y + 15);
  });

  // ── Right: Needs Improvement ──
  const rightX = MARGIN + colW + 8;
  const impColor = report.needs_improvement.length > 0 ? COLORS.red : COLORS.green;
  roundedRect(pdf, rightX, startY, colW, 8, 2, impColor);
  setColor(pdf, COLORS.white);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("⚠  NEEDS IMPROVEMENT", rightX + 6, startY + 5.5);

  if (report.needs_improvement.length === 0) {
    roundedRect(pdf, rightX, startY + 12, colW, 20, 3, COLORS.lightGray);
    setColor(pdf, COLORS.green);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("All areas performing well!", rightX + 6, startY + 24);
  } else {
    report.needs_improvement.forEach((item, i) => {
      const y = startY + 12 + i * 30;
      roundedRect(pdf, rightX, y, colW, 26, 3, COLORS.lightGray);

      setColor(pdf, COLORS.darkText);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text(item.area, rightX + 6, y + 8);

      setColor(pdf, COLORS.red);
      pdf.setFontSize(14);
      pdf.text(`${item.score}%`, rightX + colW - 8, y + 9, { align: "right" });

      // Impact badge
      const badgeColor = item.impact === "high" ? COLORS.red : item.impact === "medium" ? COLORS.orange : COLORS.blue;
      roundedRect(pdf, rightX + 6, y + 12, 22, 5, 2, badgeColor);
      setColor(pdf, COLORS.white);
      pdf.setFontSize(6);
      pdf.setFont("helvetica", "bold");
      pdf.text(item.impact.toUpperCase(), rightX + 17, y + 15.5, { align: "center" });

      setColor(pdf, COLORS.subText);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      const suggLines = pdf.splitTextToSize(item.suggestion, colW - 16);
      pdf.text(suggLines.slice(0, 2), rightX + 6, y + 22);
    });
  }

  // ── Recurring Issues (bottom) ──
  if (report.recurring_issues.length > 0) {
    const issY = startY + 90;
    roundedRect(pdf, MARGIN, issY, W - MARGIN * 2, 8, 2, COLORS.orange);
    setColor(pdf, COLORS.white);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text("⟳  RECURRING ISSUES", MARGIN + 6, issY + 5.5);

    report.recurring_issues.forEach((issue, i) => {
      const y = issY + 12 + i * 10;
      setColor(pdf, COLORS.darkText);
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.text(`•  ${issue.issue}`, MARGIN + 6, y + 4);
      
      const freqColor = issue.frequency === "common" ? COLORS.red : issue.frequency === "occasional" ? COLORS.orange : COLORS.blue;
      roundedRect(pdf, W - MARGIN - 30, y, 22, 5, 2, freqColor);
      setColor(pdf, COLORS.white);
      pdf.setFontSize(5.5);
      pdf.setFont("helvetica", "bold");
      pdf.text(issue.frequency.toUpperCase(), W - MARGIN - 19, y + 3.5, { align: "center" });
    });
  }
}

// ════════════════════════════════════════════════
//  SLIDE 5: RECOMMENDATIONS
// ════════════════════════════════════════════════
function drawRecommendationsSlide(pdf: jsPDF, report: AnalysisReport) {
  drawHeader(pdf, "Recommendations", "Actionable improvements prioritized by impact");

  const startY = 38;
  const cardH = 28;

  report.recommendations.forEach((rec, i) => {
    const y = startY + i * (cardH + 4);
    roundedRect(pdf, MARGIN, y, W - MARGIN * 2, cardH, 4, COLORS.lightGray);

    // Priority badge
    const prColor = rec.priority === "high" ? COLORS.red : rec.priority === "medium" ? COLORS.orange : COLORS.blue;
    roundedRect(pdf, MARGIN + 4, y + 4, 6, 6, 3, prColor);
    setColor(pdf, COLORS.white);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text(String(i + 1), MARGIN + 7, y + 8.5, { align: "center" });

    // Priority label
    roundedRect(pdf, MARGIN + 14, y + 4, 20, 6, 2, prColor);
    setColor(pdf, COLORS.white);
    pdf.setFontSize(6);
    pdf.text(rec.priority.toUpperCase(), MARGIN + 24, y + 8, { align: "center" });

    // Title
    setColor(pdf, COLORS.darkText);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(rec.title, MARGIN + 40, y + 9);

    // Description
    setColor(pdf, COLORS.subText);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    const descLines = pdf.splitTextToSize(rec.description, W - MARGIN * 2 - 50);
    pdf.text(descLines.slice(0, 2), MARGIN + 14, y + 17);

    // Impact
    setColor(pdf, COLORS.green);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "italic");
    pdf.text(`Impact: ${rec.expected_impact}`, MARGIN + 14, y + 24);
  });
}

// ════════════════════════════════════════════════
//  SLIDE 6: COMMENTS & CLOSING
// ════════════════════════════════════════════════
function drawCommentsSlide(pdf: jsPDF, report: AnalysisReport, shipName: string) {
  drawHeader(pdf, "Guest Comments & Notes", "Notable feedback from guests");

  const startY = 38;

  if (report.sentiment_analysis.notable_comments.length > 0) {
    report.sentiment_analysis.notable_comments.forEach((c, i) => {
      const y = startY + i * 22;
      roundedRect(pdf, MARGIN, y, W - MARGIN * 2, 18, 3, COLORS.lightGray);

      // Quote mark
      setColor(pdf, COLORS.gold);
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("\u201C", MARGIN + 4, y + 10);

      // Comment text
      setColor(pdf, COLORS.darkText);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "italic");
      const cLines = pdf.splitTextToSize(c.original, W - MARGIN * 2 - 40);
      pdf.text(cLines.slice(0, 2), MARGIN + 14, y + 8);

      // Language badge
      roundedRect(pdf, W - MARGIN - 18, y + 3, 14, 5, 2, COLORS.navy);
      setColor(pdf, COLORS.white);
      pdf.setFontSize(6);
      pdf.setFont("helvetica", "bold");
      pdf.text(c.language.toUpperCase(), W - MARGIN - 11, y + 6.5, { align: "center" });
    });
  } else {
    roundedRect(pdf, MARGIN, startY, W - MARGIN * 2, 18, 3, COLORS.lightGray);
    setColor(pdf, COLORS.subText);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("No text comments were provided by guests.", MARGIN + 8, startY + 11);
  }

  // Closing section
  const closeY = H - 50;
  setFill(pdf, COLORS.navy);
  pdf.rect(MARGIN, closeY, W - MARGIN * 2, 30, "F");
  setColor(pdf, COLORS.gold);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Thank You", MARGIN + 8, closeY + 12);
  setColor(pdf, COLORS.white);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text(`${shipName} — Guest Comment Analysis Report`, MARGIN + 8, closeY + 20);
  pdf.text(`Generated on ${new Date(report.generated_at).toLocaleString()}`, MARGIN + 8, closeY + 26);
}

// ════════════════════════════════════════════════
//  PUBLIC API
// ════════════════════════════════════════════════
export function generateReportPdf(report: AnalysisReport, shipName: string): void {
  const pdf = new jsPDF("l", "mm", "a4");
  const totalPages = 6;

  // Slide 1: Cover
  drawCoverSlide(pdf, report, shipName);
  addFooter(pdf, 1, totalPages);

  // Slide 2: Executive Summary
  pdf.addPage();
  drawSummarySlide(pdf, report);
  addFooter(pdf, 2, totalPages);

  // Slide 3: Detailed Ratings
  pdf.addPage();
  drawRatingsSlide(pdf, report);
  addFooter(pdf, 3, totalPages);

  // Slide 4: Performance Highlights
  pdf.addPage();
  drawPerformanceSlide(pdf, report);
  addFooter(pdf, 4, totalPages);

  // Slide 5: Recommendations
  pdf.addPage();
  drawRecommendationsSlide(pdf, report);
  addFooter(pdf, 5, totalPages);

  // Slide 6: Comments & Closing
  pdf.addPage();
  drawCommentsSlide(pdf, report, shipName);
  addFooter(pdf, 6, totalPages);

  pdf.save(`GuestComment_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
