import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/i18n/translations";
import GuestLayout from "@/components/guest/GuestLayout";

const GuestRoomNumber = () => {
  const [room, setRoom] = useState("");
  const navigate = useNavigate();
  const { shipId } = useParams();
  const [searchParams] = useSearchParams();
  const lang = searchParams.get("lang") || "en";

  const handleContinue = () => {
    if (!room.trim()) return;
    navigate(`/ship/${shipId || "default"}/feedback?lang=${lang}&room=${room.trim()}`);
  };

  return (
    <GuestLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-sm mt-12 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring" }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center"
        >
          <DoorOpen className="h-10 w-10 text-primary" />
        </motion.div>
        
        <h2 className="text-lg font-display font-semibold text-foreground mb-2">
          {t(lang, "enterRoomNumber")}
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          {t(lang, "welcomeSubtitle")}
        </p>

        <Input
          type="text"
          inputMode="numeric"
          placeholder={t(lang, "roomNumber")}
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          className="text-center text-2xl h-14 font-bold tracking-widest border-2 focus:border-cruise-gold mb-4"
          maxLength={6}
          autoFocus
        />

        <Button
          onClick={handleContinue}
          disabled={!room.trim()}
          className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90"
        >
          {t(lang, "continue")}
        </Button>
      </motion.div>
    </GuestLayout>
  );
};

export default GuestRoomNumber;
