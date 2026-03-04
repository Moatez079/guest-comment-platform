import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Anchor } from "lucide-react";

interface GuestLayoutProps {
  children: ReactNode;
  showBranding?: boolean;
}

const GuestLayout = ({ children, showBranding = true }: GuestLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-cruise-sky via-background to-cruise-sand flex flex-col">
      {showBranding && (
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="pt-6 pb-2 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Anchor className="h-6 w-6 text-cruise-navy" />
            <h1 className="text-xl font-display font-bold text-cruise-navy tracking-wide">
              Grand Rose Cruise
            </h1>
          </div>
          <div className="h-0.5 w-16 mx-auto bg-cruise-gold rounded-full" />
        </motion.header>
      )}
      <main className="flex-1 flex flex-col items-center px-4 pb-8">
        {children}
      </main>
      <footer className="text-center py-3 text-xs text-muted-foreground opacity-60">
        Powered by Grand Rose Cruise
      </footer>
    </div>
  );
};

export default GuestLayout;
