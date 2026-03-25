import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldX } from "lucide-react";
import { languages } from "@/i18n/translations";
import GuestLayout from "@/components/guest/GuestLayout";
import { supabase } from "@/integrations/supabase/client";

const GuestLanguageSelect = () => {
  const navigate = useNavigate();
  const { shipId } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const validate = async () => {
      if (!token) {
        // No token = legacy QR, allow access
        setValid(true);
        setValidating(false);
        return;
      }
      // Check token against ship
      const { data } = await supabase
        .from("ships")
        .select("id")
        .eq("qr_token", token)
        .maybeSingle();

      setValid(!!data);
      setValidating(false);
    };
    validate();
  }, [token, shipId]);

  const handleSelect = (code: string) => {
    navigate(`/ship/${shipId || "default"}/room?lang=${code}`);
  };

  if (validating) {
    return (
      <GuestLayout>
        <div className="flex items-center justify-center mt-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </GuestLayout>
    );
  }

  if (!valid) {
    return (
      <GuestLayout>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md mt-12 text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldX className="h-10 w-10 text-destructive" />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground mb-2">
            QR Code Expired
          </h2>
          <p className="text-sm text-muted-foreground">
            This QR code is no longer valid. Please scan the new QR code available on the ship.
          </p>
        </motion.div>
      </GuestLayout>
    );
  }

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
