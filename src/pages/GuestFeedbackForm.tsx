import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Ship, Utensils, Building2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n/translations";
import RatingSelector from "@/components/guest/RatingSelector";
import GuestLayout from "@/components/guest/GuestLayout";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Ratings = Record<string, string | null>;

const GuestFeedbackForm = () => {
  const navigate = useNavigate();
  const { shipId } = useParams();
  const [searchParams] = useSearchParams();
  const lang = searchParams.get("lang") || "en";
  const room = searchParams.get("room") || "";
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

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

      // Generate clean text-based PDF
      const pdf = new jsPDF("p", "mm", "a4");
      const w = pdf.internal.pageSize.getWidth();
      let y = 15;

      const addLine = (text: string, yPos: number, size = 10, color: [number, number, number] = [50, 50, 50]) => {
        if (yPos > 275) { pdf.addPage(); yPos = 15; }
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        const lines = pdf.splitTextToSize(text, w - 20);
        pdf.text(lines, 10, yPos);
        return yPos + lines.length * (size * 0.45) + 3;
      };

      // Header
      pdf.setFillColor(30, 64, 110);
      pdf.rect(0, 0, w, 30, "F");
      pdf.setFontSize(18);
      pdf.setTextColor(255, 255, 255);
      pdf.text("Grand Rose Cruise", 10, 13);
      pdf.setFontSize(11);
      pdf.text("Guest Feedback Form", 10, 20);
      pdf.setFontSize(9);
      pdf.setTextColor(200, 200, 220);
      pdf.text(`Room: ${room}  |  Date: ${new Date().toLocaleDateString()}  |  Language: ${lang.toUpperCase()}`, 10, 27);
      y = 38;

      const ratingDisplay: Record<string, string> = {
        excellent: "Excellent",
        veryGood: "Very Good",
        good: "Good",
        fair: "Fair",
      };

      // Services section
      y = addLine("SERVICES", y, 13, [30, 64, 110]);
      pdf.setDrawColor(180, 140, 60);
      pdf.setLineWidth(0.5);
      pdf.line(10, y - 1, 60, y - 1);
      y += 2;
      servicesItems.forEach((item) => {
        const val = ratings[`services_${item}`];
        const label = t(lang, item);
        y = addLine(`${label}:  ${val ? ratingDisplay[val] || val : "Not rated"}`, y, 10);
      });
      if (comments.services) {
        y = addLine(`Comments: ${comments.services}`, y, 9, [100, 100, 100]);
      }
      y += 4;

      // Facilities section
      y = addLine("FACILITIES", y, 13, [30, 64, 110]);
      pdf.setDrawColor(180, 140, 60);
      pdf.line(10, y - 1, 65, y - 1);
      y += 2;
      facilitiesItems.forEach((item) => {
        const val = ratings[`facilities_${item}`];
        const label = t(lang, item);
        y = addLine(`${label}:  ${val ? ratingDisplay[val] || val : "Not rated"}`, y, 10);
      });
      if (comments.facilities) {
        y = addLine(`Comments: ${comments.facilities}`, y, 9, [100, 100, 100]);
      }
      y += 4;

      // Food section
      y = addLine("FOOD & DINING", y, 13, [30, 64, 110]);
      pdf.setDrawColor(180, 140, 60);
      pdf.line(10, y - 1, 70, y - 1);
      y += 2;
      foodItems.forEach((item) => {
        const val = ratings[`food_${item}`];
        const label = t(lang, item);
        y = addLine(`${label}:  ${val ? ratingDisplay[val] || val : "Not rated"}`, y, 10);
      });
      if (comments.food) {
        y = addLine(`Comments: ${comments.food}`, y, 9, [100, 100, 100]);
      }
      y += 4;

      // General comments
      if (comments.general) {
        y = addLine("GENERAL COMMENTS", y, 13, [30, 64, 110]);
        pdf.setDrawColor(180, 140, 60);
        pdf.line(10, y - 1, 80, y - 1);
        y += 2;
        y = addLine(comments.general, y, 10, [50, 50, 50]);
      }

      // Footer
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(240, 240, 240);
      pdf.rect(0, pageH - 12, w, 12, "F");
      pdf.setFontSize(7);
      pdf.setTextColor(130, 130, 130);
      pdf.text(`Generated by Grand Rose Cruise Feedback System  |  ${new Date().toISOString()}`, 10, pageH - 5);

      const pdfBlob = pdf.output("blob");
      const pdfPath = `${shipId || "default"}/${timestamp}_room${room}.pdf`;

      const { error: pdfErr } = await supabase.storage
        .from("feedback-files")
        .upload(pdfPath, pdfBlob, { contentType: "application/pdf" });

      if (!pdfErr) {
        pdfUrl = pdfPath;
      }

      // Save feedback to database
      const { error: dbErr } = await supabase.from("feedback").insert({
        ship_id: shipId || "00000000-0000-0000-0000-000000000000",
        room_number: room,
        language: lang,
        ratings: ratings as any,
        comments: comments as any,
        pdf_url: pdfUrl,
        image_url: imageUrl,
      });

      if (dbErr) {
        console.error("DB error:", dbErr);
        toast({
          title: "Error",
          description: "Failed to save feedback. Please try again.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      navigate(`/ship/${shipId || "default"}/thankyou?lang=${lang}`);
    } catch (err) {
      console.error("Error submitting feedback:", err);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
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
