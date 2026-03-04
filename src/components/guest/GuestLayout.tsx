import { ReactNode, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Anchor } from "lucide-react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface GuestLayoutProps {
  children: ReactNode;
  showBranding?: boolean;
  shipName?: string;
}

const GuestLayout = ({ children, showBranding = true, shipName: propShipName }: GuestLayoutProps) => {
  const { shipId } = useParams();
  const [shipName, setShipName] = useState(propShipName || "");

  useEffect(() => {
    if (propShipName) return;
    if (!shipId) return;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const fetchName = async () => {
      let query;
      if (uuidRegex.test(shipId)) {
        query = supabase.from("ships").select("name").eq("id", shipId).maybeSingle();
      } else {
        query = supabase.from("ships").select("name").ilike("name", shipId).maybeSingle();
      }
      const { data } = await query;
      if (data?.name) setShipName(data.name);
    };
    fetchName();
  }, [shipId, propShipName]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-cruise-sky via-background to-cruise-sand flex flex-col">
      {showBranding && shipName && (
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="pt-6 pb-2 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Anchor className="h-6 w-6 text-cruise-navy" />
            <h1 className="text-xl font-display font-bold text-cruise-navy tracking-wide">
              {shipName}
            </h1>
          </div>
          <div className="h-0.5 w-16 mx-auto bg-cruise-gold rounded-full" />
        </motion.header>
      )}
      <main className="flex-1 flex flex-col items-center px-4 pb-8">
        {children}
      </main>
      <footer className="text-center py-3 text-xs text-muted-foreground opacity-60">
        Powered by Guest Comment
      </footer>
    </div>
  );
};

export default GuestLayout;
