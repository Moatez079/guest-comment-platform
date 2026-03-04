import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MessageSquare, QrCode, BarChart3, Shield, Globe, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: QrCode, title: "QR-to-Form", desc: "Guests scan, select language, and rate – no login needed." },
  { icon: BarChart3, title: "AI Analytics", desc: "Smart insights, recurring issues, and downloadable PDF reports." },
  { icon: Shield, title: "Multi-Tenant SaaS", desc: "Each ship gets its own workspace with role-based access." },
  { icon: Globe, title: "30+ Languages", desc: "Guests fill forms in their native language. Admins see everything in English." },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-cruise-sky via-background to-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <span className="font-display font-bold text-lg text-foreground">Guest Comment</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/login")}>
          Admin Login
        </Button>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cruise-gold/10 text-cruise-gold text-sm font-medium mb-6">
            <span>🚢</span> AI-Powered Guest Feedback Platform
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground leading-tight mb-4">
            Collect, Analyze &<br />
            <span className="text-primary">Improve Guest Experience</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            A multi-tenant SaaS platform for ships & hotels. QR-based feedback forms, 
            AI-powered analytics, and downloadable PDF reports – all in one beautiful platform.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/admin/login")}
            >
              Admin Dashboard
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-foreground text-lg mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="text-center py-6 border-t border-border">
        <p className="text-sm text-muted-foreground">© 2026 Guest Comment. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Index;
