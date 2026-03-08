import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Ship, Utensils, Building2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n/translations";
import RatingSelector from "@/components/guest/RatingSelector";
import GuestLayout from "@/components/guest/GuestLayout";
import { generateFeedbackPdf } from "@/lib/feedbackPdfGenerator";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { saveFeedbackOffline, syncPendingFeedback } from "@/lib/offlineQueue";

type Ratings = Record<string, string | null>;

const GuestFeedbackForm = () => {
  const navigate = useNavigate();
  const { shipId: shipIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const lang = searchParams.get("lang") || "en";
  const room = searchParams.get("room") || "";
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [resolvedShipId, setResolvedShipId] = useState<string | null>(null);
  const [shipName, setShipName] = useState("");

  // Resolve ship ID on mount (handle both UUID and slug)
  useEffect(() => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (shipIdParam && uuidRegex.test(shipIdParam)) {
      setResolvedShipId(shipIdParam);
      supabase.from("ships").select("name").eq("id", shipIdParam).maybeSingle()
        .then(({ data }) => { if (data?.name) setShipName(data.name); });
    } else if (shipIdParam) {
      supabase.from("ships").select("id, name").ilike("name", shipIdParam).limit(1).maybeSingle()
        .then(({ data }) => {
          if (data?.id) { setResolvedShipId(data.id); setShipName(data.name); }
          else {
            supabase.from("ships").select("id, name").limit(1).maybeSingle()
              .then(({ data: first }) => {
                if (first?.id) { setResolvedShipId(first.id); setShipName(first.name); }
              });
          }
        });
    } else {
      supabase.from("ships").select("id, name").limit(1).maybeSingle()
        .then(({ data }) => {
          if (data?.id) { setResolvedShipId(data.id); setShipName(data.name); }
        });
    }
  }, [shipIdParam]);

  const [ratings, setRatings] = useState<Ratings>({});
  const [comments, setComments] = useState({
    services: "",
    facilities: "",
    food: "",
    general: "",
  });

  const setRating = (key: string, val: string) => {
    setRatings((prev) => ({ ...prev, [key]: val }));
  };

  const ratingLabels = {
    excellent: t(lang, "excellent"),
    veryGood: t(lang, "veryGood"),
    good: t(lang, "good"),
    fair: t(lang, "fair"),
  };

  const servicesItems = ["reception", "laundry", "housekeeping", "cabins", "cleanliness", "maintenance"] as const;
  const facilitiesItems = ["restaurant", "loungeBar", "sundeckBar", "swimmingPool"] as const;
  const foodItems = ["quality", "quantity", "variety"] as const;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      let pdfUrl: string | null = null;
      let imageUrl: string | null = null;
      const timestamp = Date.now();
      // Comments will be translated to English before saving

      // Start translation in parallel (non-blocking) while we prepare PDF
      const translationPromise = lang !== "en"
        ? supabase.functions.invoke("translate-comments", {
            body: { comments, language: lang },
          }).then(({ data, error }) => {
            if (!error && data?.translated) return data.translated;
            return { ...comments };
          }).catch(() => ({ ...comments }))
        : Promise.resolve({ ...comments });

      // Build PDF while translation is in-flight
      const translatedComments = await translationPromise;

      // Generate professional 2-page PDF (use translated comments)
      const pdf = new jsPDF("p", "mm", "a4");
      const w = pdf.internal.pageSize.getWidth();
      const h = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentW = w - margin * 2;

      const ratingDisplay: Record<string, string> = {
        excellent: "Excellent",
        veryGood: "Very Good",
        good: "Good",
        fair: "Fair",
      };
      const ratingScore: Record<string, string> = {
        excellent: "4/4",
        veryGood: "3/4",
        good: "2/4",
        fair: "1/4",
      };
      const ratingColor: Record<string, [number, number, number]> = {
        excellent: [34, 139, 34],
        veryGood: [30, 100, 180],
        good: [200, 160, 40],
        fair: [200, 60, 60],
      };

      // ===== PAGE 1 =====
      // Navy header band
      pdf.setFillColor(25, 55, 95);
      pdf.rect(0, 0, w, 40, "F");
      // Gold accent line
      pdf.setFillColor(200, 160, 60);
      pdf.rect(0, 40, w, 1.5, "F");

      // Header text
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(255, 255, 255);
      pdf.text(shipName || "Guest Feedback", margin, 18);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(12);
      pdf.setTextColor(180, 200, 220);
      pdf.text("Guest Feedback Report", margin, 27);

      // Info badges on right
      pdf.setFillColor(255, 255, 255, 30);
      const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      pdf.setFontSize(9);
      pdf.setTextColor(200, 210, 230);
      pdf.text(`Room ${room}`, w - margin, 15, { align: "right" });
      pdf.text(dateStr, w - margin, 22, { align: "right" });
      pdf.text(`Language: ${lang.toUpperCase()}`, w - margin, 29, { align: "right" });

      let y = 50;

      // Helper: draw a section title
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

      // Helper: draw a rating row with colored badge
      const drawRatingRow = (label: string, ratingKey: string, yPos: number, isOdd: boolean) => {
        if (yPos > h - 30) { pdf.addPage(); yPos = 25; }
        const val = ratings[ratingKey];

        // Alternating row background
        if (isOdd) {
          pdf.setFillColor(248, 249, 252);
          pdf.rect(margin, yPos - 4, contentW, 9, "F");
        }

        // Label
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(60, 60, 60);
        pdf.text(label, margin + 4, yPos + 1);

        if (val && ratingDisplay[val]) {
          // Colored rating badge
          const badgeText = ratingDisplay[val];
          const badgeColor = ratingColor[val] || [100, 100, 100];
          const score = ratingScore[val];

          // Badge background
          const badgeW = pdf.getTextWidth(badgeText) + 8;
          pdf.setFillColor(...badgeColor);
          pdf.roundedRect(w - margin - badgeW - 25, yPos - 3.5, badgeW, 7, 1.5, 1.5, "F");

          // Badge text
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8);
          pdf.setTextColor(255, 255, 255);
          pdf.text(badgeText, w - margin - badgeW - 25 + 4, yPos + 1.5);

          // Score
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

      // Helper: draw a comment box
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

      // ---- SERVICES ----
      y = drawSectionTitle("SERVICES", y);
      servicesItems.forEach((item, i) => {
        y = drawRatingRow(t("en", item), `services_${item}`, y, i % 2 === 0);
      });
      y = drawCommentBox(translatedComments.services, y);
      y += 4;

      // ---- FACILITIES ----
      y = drawSectionTitle("FACILITIES", y);
      facilitiesItems.forEach((item, i) => {
        y = drawRatingRow(t("en", item), `facilities_${item}`, y, i % 2 === 0);
      });
      y = drawCommentBox(translatedComments.facilities, y);
      y += 4;

      // ---- FOOD & DINING ----
      y = drawSectionTitle("FOOD & DINING", y);
      foodItems.forEach((item, i) => {
        y = drawRatingRow(t("en", item), `food_${item}`, y, i % 2 === 0);
      });
      y = drawCommentBox(translatedComments.food, y);

      // ===== PAGE 2 (or continue) =====
      // General comments section
      if (translatedComments.general) {
        if (y > h - 60) { pdf.addPage(); y = 25; }
        y += 6;
        y = drawSectionTitle("GENERAL COMMENTS & SUGGESTIONS", y);
        y += 2;
        const genLines = pdf.splitTextToSize(translatedComments.general, contentW - 12);
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

      // Summary box
      if (y > h - 50) { pdf.addPage(); y = 25; }
      y += 4;
      pdf.setFillColor(25, 55, 95);
      pdf.roundedRect(margin, y, contentW, 22, 2, 2, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      pdf.text("RATING SUMMARY", margin + 5, y + 7);

      // Calculate overall
      const ratingMap: Record<string, number> = { excellent: 4, veryGood: 3, good: 2, fair: 1 };
      let rSum = 0, rCount = 0;
      Object.values(ratings).forEach((v) => {
        if (v && ratingMap[v] !== undefined) { rSum += ratingMap[v]; rCount++; }
      });
      const overallAvg = rCount > 0 ? (rSum / rCount).toFixed(1) : "N/A";
      const overallPct = rCount > 0 ? Math.round((rSum / rCount / 4) * 100) : 0;
      const rated = rCount;
      const total = servicesItems.length + facilitiesItems.length + foodItems.length;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(180, 200, 220);
      pdf.text(`Overall Average: ${overallAvg} / 4.0  (${overallPct}%)`, margin + 5, y + 14);
      pdf.text(`Items Rated: ${rated} / ${total}`, margin + 100, y + 14);
      y += 30;

      // Footer on every page
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

      const pdfBlob = pdf.output("blob");
      const pdfPath = `${resolvedShipId || "default"}/${timestamp}_room${room}.pdf`;

      // Check if online
      if (!navigator.onLine) {
        // Save offline with PDF blob
        const pdfArrayBuffer = await pdfBlob.arrayBuffer();
        await saveFeedbackOffline({
          id: `offline_${timestamp}`,
          ship_id: resolvedShipId || "00000000-0000-0000-0000-000000000000",
          room_number: room,
          language: lang,
          ratings,
          comments,
          pdf_blob: pdfArrayBuffer,
          pdf_path: pdfPath,
          created_at: new Date().toISOString(),
        });

        toast({
          title: "📱 Saved Offline",
          description: "Your feedback has been saved and will be sent automatically when internet is available.",
        });

        navigate(`/ship/${shipIdParam || "default"}/thankyou?lang=${lang}`);
        return;
      }

      // Online: upload PDF and save to DB in parallel
      const [pdfResult, dbResult] = await Promise.all([
        supabase.storage
          .from("feedback-files")
          .upload(pdfPath, pdfBlob, { contentType: "application/pdf" }),
        supabase.from("feedback").insert({
          ship_id: resolvedShipId || "00000000-0000-0000-0000-000000000000",
          room_number: room,
          language: lang,
          ratings: ratings as any,
          comments: translatedComments as any,
          pdf_url: pdfPath,
          image_url: imageUrl,
        }),
      ]);

      if (pdfResult.error) {
        console.error("PDF upload error:", pdfResult.error);
      }

      if (dbResult.error) {
        console.error("DB error:", dbResult.error);
        // Fallback to offline storage
        const pdfArrayBuffer = await pdfBlob.arrayBuffer();
        await saveFeedbackOffline({
          id: `offline_${timestamp}`,
          ship_id: resolvedShipId || "00000000-0000-0000-0000-000000000000",
          room_number: room,
          language: lang,
          ratings,
          comments,
          pdf_blob: pdfArrayBuffer,
          pdf_path: pdfPath,
          created_at: new Date().toISOString(),
        });
        toast({
          title: "📱 Saved Offline",
          description: "Could not reach server. Feedback saved locally and will sync when online.",
        });
        navigate(`/ship/${shipIdParam || "default"}/thankyou?lang=${lang}`);
        return;
      }

      // Try to sync any previously saved offline feedback
      syncPendingFeedback().catch(() => {});

      navigate(`/ship/${shipIdParam || "default"}/thankyou?lang=${lang}`);
    } catch (err) {
      console.error("Error submitting feedback:", err);
      // Last resort: try to save offline
      try {
        await saveFeedbackOffline({
          id: `offline_${Date.now()}`,
          ship_id: resolvedShipId || "00000000-0000-0000-0000-000000000000",
          room_number: room,
          language: lang,
          ratings,
          comments,
          created_at: new Date().toISOString(),
        });
        toast({
          title: "📱 Saved Offline",
          description: "Feedback saved locally. It will be sent when internet is available.",
        });
        navigate(`/ship/${shipIdParam || "default"}/thankyou?lang=${lang}`);
        return;
      } catch {
        toast({
          title: "Error",
          description: "Failed to submit feedback. Please try again.",
          variant: "destructive",
        });
      }
      setSubmitting(false);
    }
  };

  const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
    <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h3 className="font-display font-semibold text-foreground text-base">{title}</h3>
    </div>
  );

  const RatingRow = ({ label, itemKey }: { label: string; itemKey: string }) => (
    <div className="mb-3">
      <div className="text-sm font-medium text-foreground mb-1.5">{label}</div>
      <RatingSelector
        value={ratings[itemKey] || null}
        onChange={(val) => setRating(itemKey, val)}
        labels={ratingLabels}
      />
    </div>
  );

  return (
    <GuestLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg mt-4"
      >
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
            <Ship className="h-3 w-3" />
            {t(lang, "roomNumber")}: {room}
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-lg border border-border p-5">
          <h2 className="font-display text-xl font-bold text-center text-foreground mb-1">
            {t(lang, "guestFeedback")}
          </h2>
          <div className="h-0.5 w-12 mx-auto bg-cruise-gold rounded-full mb-4" />

          {/* Services */}
          <SectionHeader icon={Building2} title={t(lang, "services")} />
          {servicesItems.map((item) => (
            <RatingRow key={item} label={t(lang, item)} itemKey={`services_${item}`} />
          ))}
          <Textarea
            placeholder={t(lang, "commentsPlaceholder")}
            value={comments.services}
            onChange={(e) => setComments((p) => ({ ...p, services: e.target.value }))}
            className="mt-2 text-sm min-h-[60px]"
          />

          {/* Facilities */}
          <SectionHeader icon={Building2} title={t(lang, "facilities")} />
          {facilitiesItems.map((item) => (
            <RatingRow key={item} label={t(lang, item)} itemKey={`facilities_${item}`} />
          ))}
          <Textarea
            placeholder={t(lang, "commentsPlaceholder")}
            value={comments.facilities}
            onChange={(e) => setComments((p) => ({ ...p, facilities: e.target.value }))}
            className="mt-2 text-sm min-h-[60px]"
          />

          {/* Food */}
          <SectionHeader icon={Utensils} title={t(lang, "food")} />
          {foodItems.map((item) => (
            <RatingRow key={item} label={t(lang, item)} itemKey={`food_${item}`} />
          ))}
          <Textarea
            placeholder={t(lang, "commentsPlaceholder")}
            value={comments.food}
            onChange={(e) => setComments((p) => ({ ...p, food: e.target.value }))}
            className="mt-2 text-sm min-h-[60px]"
          />

          {/* General */}
          <SectionHeader icon={MessageSquare} title={t(lang, "general")} />
          <Textarea
            placeholder={t(lang, "generalCommentsPlaceholder")}
            value={comments.general}
            onChange={(e) => setComments((p) => ({ ...p, general: e.target.value }))}
            className="text-sm min-h-[80px]"
          />
        </div>

        <motion.div className="mt-5">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-12 text-base font-semibold bg-cruise-gold hover:bg-cruise-gold/90 text-white shadow-lg"
          >
            {submitting ? "..." : t(lang, "submit")}
          </Button>
        </motion.div>
      </motion.div>
    </GuestLayout>
  );
};

export default GuestFeedbackForm;
