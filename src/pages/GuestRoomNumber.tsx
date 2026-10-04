import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { DoorOpen, Ship, Loader2, User, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { t } from "@/i18n/translations";
import GuestLayout from "@/components/guest/GuestLayout";
import { supabase } from "@/integrations/supabase/client";

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const GuestRoomNumber = () => {
  const [room, setRoom] = useState("");
  const [guestName, setGuestName] = useState("");
  const [tripDate] = useState(todayLocal);
  const navigate = useNavigate();
  const { shipId } = useParams();
  const [searchParams] = useSearchParams();
  const lang = searchParams.get("lang") || "en";

  const [ships, setShips] = useState<{ id: string; name: string }[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string>("");
  const [loadingShips, setLoadingShips] = useState(true);

  useEffect(() => {
    const fetchShips = async () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const { data: allShips } = await supabase
        .from("ships")
        .select("id, name")
        .order("name");

      if (allShips && allShips.length > 0) {
        setShips(allShips);

        if (shipId && uuidRegex.test(shipId)) {
          const match = allShips.find((s) => s.id === shipId);
          setSelectedShipId(match ? match.id : allShips[0].id);
        } else if (shipId) {
          const match = allShips.find((s) => s.name.toLowerCase() === shipId.toLowerCase());
          setSelectedShipId(match ? match.id : allShips[0].id);
        } else {
          setSelectedShipId(allShips[0].id);
        }
      }
      setLoadingShips(false);
    };
    fetchShips();
  }, [shipId]);

  const handleContinue = () => {
    if (!room.trim() || !selectedShipId) return;
    const params = new URLSearchParams({
      lang,
      room: room.trim(),
      trip_date: tripDate,
      ...(guestName.trim() && { guest_name: guestName.trim() }),
    });
    navigate(`/ship/${selectedShipId}/feedback?${params.toString()}`);
  };

  const showShipSelector = ships.length > 1;

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

        {/* Ship Selector */}
        {loadingShips ? (
          <div className="flex justify-center mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : showShipSelector ? (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1.5 justify-center">
              <Ship className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {"Select Ship"}
              </span>
            </div>
            <Select value={selectedShipId} onValueChange={setSelectedShipId}>
              <SelectTrigger className="text-center text-base h-12 border-2 focus:border-cruise-gold">
                <SelectValue placeholder="Select ship..." />
              </SelectTrigger>
              <SelectContent>
                {ships.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <Ship className="h-3 w-3" />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Guest Name */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1.5 justify-center">
            <User className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {t(lang, "guestName")}
            </span>
          </div>
          <Input
            type="text"
            placeholder={t(lang, "guestNamePlaceholder")}
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="text-center text-base h-12 border-2 focus:border-cruise-gold"
            maxLength={100}
          />
        </div>

        {/* Trip Date (auto-filled with today) */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5 justify-center">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {t(lang, "tripDate")}
            </span>
          </div>
          <Input
            type="date"
            value={tripDate}
            readOnly
            className="text-center text-base h-12 border-2 bg-muted/50"
          />
        </div>

        {/* Room Number */}
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
          disabled={!room.trim() || !selectedShipId}
          className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90"
        >
          {t(lang, "continue")}
        </Button>
      </motion.div>
    </GuestLayout>
  );
};

export default GuestRoomNumber;
