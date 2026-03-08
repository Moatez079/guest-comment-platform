import jsPDF from "jspdf";

interface FeedbackPdfData {
  shipName: string;
  roomNumber: string;
  language: string;
  ratings: Record<string, string | null>;
  comments: Record<string, string>;
  submittedAt?: string;
}

const SERVICES_ITEMS = ["reception", "laundry", "housekeeping", "cabins", "cleanliness", "maintenance"];
const FACILITIES_ITEMS = ["restaurant", "loungeBar", "sundeckBar", "swimmingPool"];
const FOOD_ITEMS = ["quality", "quantity", "variety"];

const ITEM_LABELS: Record<string, string> = {
  reception: "Reception", laundry: "Laundry", housekeeping: "Housekeeping",
  cabins: "Cabins", cleanliness: "Cleanliness", maintenance: "Maintenance",
  restaurant: "Restaurant", loungeBar: "Lounge Bar", sundeckBar: "Sundeck Bar",
  swimmingPool: "Swimming Pool", quality: "Quality", quantity: "Quantity", variety: "Variety",
};

const RATING_DISPLAY: Record<string, string> = {
  excellent: "Excellent", veryGood: "Very Good", good: "Good", fair: "Fair",
};
const RATING_SCORE: Record<string, string> = {
  excellent: "4/4", veryGood: "3/4", good: "2/4", fair: "1/4",
};
const RATING_COLOR: Record<string, [number, number, number]> = {
  excellent: [34, 139, 34], veryGood: [30, 100, 180], good: [200, 160, 40], fair: [200, 60, 60],
};
const RATING_MAP: Record<string, number> = { excellent: 4, veryGood: 3, good: 2, fair: 1 };

export function generateFeedbackPdf(data: FeedbackPdfData): Blob {
  const { shipName, roomNumber, language, ratings, comments, submittedAt } = data;
  const pdf = new jsPDF("p", "mm", "a4");
  const w = pdf.internal.pageSize.getWidth();
  const h = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = w - margin * 2;

  // ===== PAGE 1 =====
  pdf.setFillColor(25, 55, 95);
  pdf.rect(0, 0, w, 40, "F");
  pdf.setFillColor(200, 160, 60);
  pdf.rect(0, 40, w, 1.5, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.setTextColor(255, 255, 255);
  pdf.text(shipName || "Guest Feedback", margin, 18);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.setTextColor(180, 200, 220);
  pdf.text("Guest Feedback Report", margin, 27);

  const dateStr = submittedAt
    ? new Date(submittedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  pdf.setFontSize(9);
  pdf.setTextColor(200, 210, 230);
  pdf.text(`Room ${roomNumber}`, w - margin, 15, { align: "right" });
  pdf.text(dateStr, w - margin, 22, { align: "right" });
  pdf.text(`Language: ${language.toUpperCase()}`, w - margin, 29, { align: "right" });

  let y = 50;

  const drawSectionTitle = (title: string, yPos: number) => {
    if (yPos > h - 40) { pdf.addPage(); yPos = 25; }
    pdf.setFillColor(240, 244, 248);
    pdf.roundedRect(margin, yPos - 5, contentW, 10, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(25, 55, 95);
    pdf.text(title, margin + 4, yPos + 1);
    return yPos + 12;
  };

  const drawRatingRow = (label: string, ratingKey: string, yPos: number, isOdd: boolean) => {
    if (yPos > h - 30) { pdf.addPage(); yPos = 25; }
    const val = ratings[ratingKey];
    if (isOdd) {
      pdf.setFillColor(248, 249, 252);
      pdf.rect(margin, yPos - 4, contentW, 9, "F");
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    pdf.text(label, margin + 4, yPos + 1);

    if (val && RATING_DISPLAY[val]) {
      const badgeText = RATING_DISPLAY[val];
      const badgeColor = RATING_COLOR[val] || [100, 100, 100];
      const score = RATING_SCORE[val];
      const badgeW = pdf.getTextWidth(badgeText) + 8;
      pdf.setFillColor(...badgeColor);
      pdf.roundedRect(w - margin - badgeW - 25, yPos - 3.5, badgeW, 7, 1.5, 1.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      pdf.text(badgeText, w - margin - badgeW - 25 + 4, yPos + 1.5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(120, 120, 120);
      pdf.text(score, w - margin - 10, yPos + 1, { align: "right" });
    } else {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(9);
      pdf.setTextColor(170, 170, 170);
      pdf.text("Not rated", w - margin - 4, yPos + 1, { align: "right" });
    }
    return yPos + 10;
  };

  const drawCommentBox = (comment: string, yPos: number) => {
    if (!comment) return yPos;
    if (yPos > h - 35) { pdf.addPage(); yPos = 25; }
    pdf.setFillColor(255, 252, 240);
    pdf.setDrawColor(220, 200, 140);
    pdf.setLineWidth(0.3);
    const lines = pdf.splitTextToSize(comment, contentW - 12);
    const boxH = lines.length * 4.5 + 8;
    pdf.roundedRect(margin + 2, yPos, contentW - 4, boxH, 1.5, 1.5, "FD");
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(140, 120, 60);
    pdf.text("Guest Comment:", margin + 6, yPos + 5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(80, 70, 40);
    pdf.text(lines, margin + 6, yPos + 10);
    return yPos + boxH + 4;
  };

  // SERVICES
  y = drawSectionTitle("SERVICES", y);
  SERVICES_ITEMS.forEach((item, i) => {
    y = drawRatingRow(ITEM_LABELS[item], `services_${item}`, y, i % 2 === 0);
  });
  y = drawCommentBox(comments.services || "", y);
  y += 4;

  // FACILITIES
  y = drawSectionTitle("FACILITIES", y);
  FACILITIES_ITEMS.forEach((item, i) => {
    y = drawRatingRow(ITEM_LABELS[item], `facilities_${item}`, y, i % 2 === 0);
  });
  y = drawCommentBox(comments.facilities || "", y);
  y += 4;

  // FOOD & DINING
  y = drawSectionTitle("FOOD & DINING", y);
  FOOD_ITEMS.forEach((item, i) => {
    y = drawRatingRow(ITEM_LABELS[item], `food_${item}`, y, i % 2 === 0);
  });
  y = drawCommentBox(comments.food || "", y);

  // GENERAL COMMENTS
  if (comments.general) {
    if (y > h - 60) { pdf.addPage(); y = 25; }
    y += 6;
    y = drawSectionTitle("GENERAL COMMENTS & SUGGESTIONS", y);
    y += 2;
    const genLines = pdf.splitTextToSize(comments.general, contentW - 12);
    pdf.setFillColor(245, 248, 252);
    pdf.setDrawColor(180, 200, 220);
    pdf.setLineWidth(0.3);
    const genBoxH = genLines.length * 5 + 10;
    pdf.roundedRect(margin + 2, y, contentW - 4, genBoxH, 2, 2, "FD");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(40, 50, 60);
    pdf.text(genLines, margin + 6, y + 8);
    y += genBoxH + 6;
  }

  // SUMMARY BOX
  if (y > h - 50) { pdf.addPage(); y = 25; }
  y += 4;
  pdf.setFillColor(25, 55, 95);
  pdf.roundedRect(margin, y, contentW, 22, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(255, 255, 255);
  pdf.text("RATING SUMMARY", margin + 5, y + 7);

  let rSum = 0, rCount = 0;
  Object.values(ratings).forEach((v) => {
    if (v && RATING_MAP[v] !== undefined) { rSum += RATING_MAP[v]; rCount++; }
  });
  const overallAvg = rCount > 0 ? (rSum / rCount).toFixed(1) : "N/A";
  const overallPct = rCount > 0 ? Math.round((rSum / rCount / 4) * 100) : 0;
  const total = SERVICES_ITEMS.length + FACILITIES_ITEMS.length + FOOD_ITEMS.length;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(180, 200, 220);
  pdf.text(`Overall Average: ${overallAvg} / 4.0  (${overallPct}%)`, margin + 5, y + 14);
  pdf.text(`Items Rated: ${rCount} / ${total}`, margin + 100, y + 14);

  // Footer
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFillColor(245, 245, 245);
    pdf.rect(0, h - 10, w, 10, "F");
    pdf.setFontSize(7);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`${shipName || "Guest Comment"} - Confidential Guest Feedback`, margin, h - 4);
    pdf.text(`Page ${p} of ${totalPages}`, w - margin, h - 4, { align: "right" });
  }

  return pdf.output("blob");
}
