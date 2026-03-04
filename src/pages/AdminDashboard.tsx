import { useState } from "react";
import { motion } from "framer-motion";
import {
  Anchor, BarChart3, FileText, Users, Settings, LogOut,
  Download, Trash2, Brain, TrendingUp, MessageSquare, Star, Ship
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const stats = [
  { label: "Total Responses", value: "0", icon: MessageSquare, change: "+0 today" },
  { label: "Average Rating", value: "N/A", icon: Star, change: "No data yet" },
  { label: "Top Issue", value: "None", icon: TrendingUp, change: "No feedback yet" },
  { label: "Active Ships", value: "1", icon: Ship, change: "Grand Rose" },
];

const sidebarItems = [
  { icon: BarChart3, label: "Dashboard", active: true },
  { icon: FileText, label: "Feedback PDFs", active: false },
  { icon: Brain, label: "AI Analytics", active: false },
  { icon: Users, label: "Users", active: false },
  { icon: Settings, label: "Settings", active: false },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Dashboard");

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border hidden md:flex">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Anchor className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-bold text-sm">Grand Rose</div>
              <div className="text-xs text-sidebar-foreground/60">Admin Portal</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveTab(item.label)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.label
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={() => navigate("/admin/login")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground">Welcome back. Here's your ship overview.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Download All
              </Button>
              <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
                Delete All
              </Button>
              <Button size="sm" className="gap-2 bg-cruise-gold hover:bg-cruise-gold/90 text-white">
                <Brain className="h-4 w-4" />
                Generate AI Report
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground">{stat.label}</span>
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <stat.icon className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{stat.change}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Empty state */}
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Feedback Yet</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
                Share the QR code with your guests to start collecting feedback. 
                All submissions will appear here in real-time.
              </p>
              <Button variant="outline" className="gap-2">
                <Ship className="h-4 w-4" />
                View QR Code
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default AdminDashboard;
