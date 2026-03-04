import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart, Anchor } from "lucide-react";
import { t } from "@/i18n/translations";
import GuestLayout from "@/components/guest/GuestLayout";

const GuestThankYou = () => {
  const [searchParams] = useSearchParams();
  const lang = searchParams.get("lang") || "en";

  return (
    <GuestLayout>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: "spring" }}
        className="w-full max-w-sm mt-16 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
          className="w-24 h-24 mx-auto mb-6 rounded-full bg-cruise-gold/20 flex items-center justify-center"
        >
          <Heart className="h-12 w-12 text-cruise-gold fill-cruise-gold" />
        </motion.div>

        <h2 className="text-2xl font-display font-bold text-foreground mb-3">
          {t(lang, "thankYou")}
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8">
          {t(lang, "thankYouMessage")}
        </p>

        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center justify-center gap-2 text-cruise-navy opacity-40"
        >
          <Anchor className="h-5 w-5" />
          <span className="text-sm font-medium">Grand Rose Cruise</span>
        </motion.div>
      </motion.div>
    </GuestLayout>
  );
};

export default GuestThankYou;
