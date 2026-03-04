import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { languages } from "@/i18n/translations";
import GuestLayout from "@/components/guest/GuestLayout";

const GuestLanguageSelect = () => {
  const navigate = useNavigate();
  const { shipId } = useParams();

  const handleSelect = (code: string) => {
    navigate(`/ship/${shipId || "default"}/room?lang=${code}`);
  };

  return (
    <GuestLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-md mt-6"
      >
        <h2 className="text-lg font-display font-semibold text-center text-foreground mb-6">
          Select Your Language
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {languages.map((lang, i) => (
            <motion.button
              key={lang.code}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              onClick={() => handleSelect(lang.code)}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border shadow-sm hover:shadow-md hover:border-cruise-gold transition-all active:scale-95"
            >
              <span className="text-2xl">{lang.flag}</span>
              <div className="text-left">
                <div className="text-sm font-semibold text-foreground">{lang.nativeName}</div>
                <div className="text-xs text-muted-foreground">{lang.name}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </GuestLayout>
  );
};

export default GuestLanguageSelect;
