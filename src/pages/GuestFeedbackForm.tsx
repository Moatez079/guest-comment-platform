import { useState, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Ship, Utensils, Building2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { t } from "@/i18n/translations";
import RatingSelector from "@/components/guest/RatingSelector";
import GuestLayout from "@/components/guest/GuestLayout";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";

type Ratings = Record<string, string | null>;

const GuestFeedbackForm = () => {
  const navigate = useNavigate();
  const { shipId } = useParams();
  const [searchParams] = useSearchParams();
  const lang = searchParams.get("lang") || "en";
  const room = searchParams.get("room") || "";
  const formRef = useRef<HTMLDivElement>(null);
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
      // Capture form as image and PDF
      if (formRef.current) {
        const canvas = await html2canvas(formRef.current, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        // Add header to PDF
        pdf.setFontSize(16);
        pdf.text("Grand Rose Cruise - Guest Feedback", 10, 15);
        pdf.setFontSize(10);
        pdf.text(`Room: ${room} | Date: ${new Date().toLocaleDateString()}`, 10, 22);
        pdf.addImage(imgData, "JPEG", 5, 28, pdfWidth - 10, pdfHeight - 10);

        // For now store locally - later will upload to Supabase storage
        const pdfBlob = pdf.output("blob");
        
        // Store feedback data
        const feedbackData = {
          ship_id: shipId || "default",
          room_number: room,
          language: lang,
          ratings,
          comments,
          submitted_at: new Date().toISOString(),
        };

        console.log("Feedback submitted:", feedbackData);
        console.log("PDF size:", pdfBlob.size);

        // TODO: Upload to Supabase when connected
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

        <div ref={formRef} className="bg-card rounded-2xl shadow-lg border border-border p-5">
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
