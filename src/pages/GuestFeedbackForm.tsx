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
  const guestName = searchParams.get("guest_name") || "";
  const tripDateParam = searchParams.get("trip_date") || "";
  const tripDate = /^\d{4}-\d{2}-\d{2}$/.test(tripDateParam) ? tripDateParam : null;
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

      // Generate professional PDF using shared utility
      const pdfBlob = generateFeedbackPdf({
        shipName,
        roomNumber: room,
        language: lang,
        ratings,
        comments: translatedComments,
      });
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
          guest_name: guestName || null,
          ...(tripDate && { trip_date: tripDate }),
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
