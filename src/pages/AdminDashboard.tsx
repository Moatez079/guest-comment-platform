import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, BarChart3, FileText, Users, Settings, LogOut,
  Download, Trash2, Brain, TrendingUp, Star, Ship,
  RefreshCw, ChevronRight, AlertTriangle, ThumbsUp, Globe, Loader2, X, QrCode
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { generateFeedbackPdf } from "@/lib/feedbackPdfGenerator";
import ShipQRCode from "@/components/admin/ShipQRCode";
import DashboardCharts from "@/components/admin/DashboardCharts";
import MobileNav from "@/components/admin/MobileNav";
import ShipSelector from "@/components/admin/ShipSelector";
import { generateLocalAnalysis } from "@/lib/localAnalysis";
import { generateReportPdf } from "@/lib/reportPdfGenerator";

type AnalysisReport = {
  executive_summary: string;
  total_responses: number;
  average_ratings: {
    services: Record<string, number>;
    facilities: Record<string, number>;
    food: Record<string, number>;
    overall_average: number;
  };
  top_performing: { area: string; score: number; note: string }[];
  needs_improvement: { area: string; score: number; impact: string; suggestion: string }[];
  recurring_issues: { issue: string; frequency: string; affected_area: string }[];
  sentiment_analysis: {
    overall: string;
    positive_highlights: string[];
    negative_highlights: string[];
    notable_comments: { original: string; translated: string; sentiment: string; language: string }[];
  };
  language_distribution: { language: string; count: number; percentage: number }[];
  recommendations: { priority: string; title: string; description: string; expected_impact: string }[];
  generated_at: string;
};

type FeedbackRow = {
  id: string;
  ship_id: string;
  room_number: string;
  language: string;
  ratings: any;
  comments: any;
  pdf_url: string | null;
  image_url: string | null;
  submitted_at: string;
};

const sidebarItems = [
  { icon: BarChart3, label: "Dashboard" },
  { icon: QrCode, label: "QR Code" },
  { icon: FileText, label: "Feedback PDFs" },
  { icon: Brain, label: "AI Analytics" },
  { icon: Users, label: "Users" },
  { icon: Settings, label: "Settings" },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [feedbackList, setFeedbackList] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiReport, setAiReport] = useState<AnalysisReport | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [shipId, setShipId] = useState<string | null>(null);
  const [shipName, setShipName] = useState<string>("");
  const [isSystemOwner, setIsSystemOwner] = useState(false);
  const [userShips, setUserShips] = useState<{ id: string; name: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/admin/login");
      return;
    }

    // Check if system owner
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "system_owner");
    
    if (roles && roles.length > 0) {
      setIsSystemOwner(true);
    }

    // Check for ship query param first
    const shipParam = searchParams.get("ship");

    // Get ALL user's ships
    const { data: memberships } = await supabase
      .from("ship_members")
      .select("ship_id, ships(name)")
      .eq("user_id", user.id);

    const userShipsList = (memberships || []).map((m: any) => ({
      id: m.ship_id,
      name: m.ships?.name || "Unknown",
    }));

    // For system owners, also fetch all ships if they have no memberships
    if (isSystemOwner || (roles && roles.length > 0)) {
      if (userShipsList.length === 0) {
        const { data: allShips } = await supabase.from("ships").select("id, name").order("name");
        if (allShips) userShipsList.push(...allShips);
      }
    }

    setUserShips(userShipsList);

    // Determine which ship to show
    const targetShipId = shipParam || (userShipsList.length > 0 ? userShipsList[0].id : null);

    if (targetShipId) {
      setShipId(targetShipId);
      const matchedShip = userShipsList.find((s) => s.id === targetShipId);
      if (matchedShip) {
        setShipName(matchedShip.name);
      } else {
        supabase.from("ships").select("name").eq("id", targetShipId).maybeSingle()
          .then(({ data }) => { if (data?.name) setShipName(data.name); });
      }
      loadFeedback(targetShipId);
    } else {
      setLoading(false);
    }
  };

  const loadFeedback = async (sid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .eq("ship_id", sid)
      .order("submitted_at", { ascending: false });

    if (!error && data) {
      setFeedbackList(data as FeedbackRow[]);
    }
    setLoading(false);
  };

  const handleShipSwitch = (newShipId: string) => {
    const matched = userShips.find((s) => s.id === newShipId);
    setShipId(newShipId);
    setShipName(matched?.name || "");
    setAiReport(null);
    loadFeedback(newShipId);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const generateAiReport = () => {
    if (!shipId) {
      toast({ title: "No ship found", description: "Create a ship first.", variant: "destructive" });
      return;
    }
    if (feedbackList.length === 0) {
      toast({ title: "No feedback", description: "No feedback data to analyze.", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const report = generateLocalAnalysis(feedbackList);
      setAiReport(report as AnalysisReport);
      setShowReport(true);
      setActiveTab("AI Analytics");
      toast({ title: "Report Generated!", description: "Your analysis is ready — instant & free." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate report", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const downloadAllPdfs = async () => {
    const pdfFeedback = feedbackList.filter((f) => f.pdf_url);
    if (pdfFeedback.length === 0) {
      toast({ title: "No PDFs", description: "No feedback PDFs available to download." });
      return;
    }

    for (const f of pdfFeedback) {
      if (f.pdf_url) {
        const { data } = await supabase.storage.from("feedback-files").download(f.pdf_url);
        if (data) {
          const url = URL.createObjectURL(data);
          const a = document.createElement("a");
          a.href = url;
          a.download = `feedback_room${f.room_number}_${f.submitted_at.slice(0, 10)}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    }
    toast({ title: "Download Complete", description: `Downloaded ${pdfFeedback.length} PDFs.` });
  };

  const deleteAllFeedback = async () => {
    if (!shipId) return;
    if (!confirm("Are you sure you want to delete ALL feedback? This cannot be undone.")) return;

    // Delete storage files
    const filePaths = feedbackList
      .flatMap((f) => [f.pdf_url, f.image_url])
      .filter(Boolean) as string[];

    if (filePaths.length > 0) {
      await supabase.storage.from("feedback-files").remove(filePaths);
    }

    // Delete feedback records
    const { error } = await supabase.from("feedback").delete().eq("ship_id", shipId);
    if (error) {
      toast({ title: "Error", description: "Failed to delete feedback.", variant: "destructive" });
    } else {
      setFeedbackList([]);
      setAiReport(null);
      toast({ title: "Deleted", description: "All feedback has been deleted." });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === feedbackList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(feedbackList.map((f) => f.id)));
    }
  };

  const deleteSelectedFeedback = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected feedback item(s)?`)) return;

    const selectedFeedback = feedbackList.filter((f) => selectedIds.has(f.id));
    const filePaths = selectedFeedback
      .flatMap((f) => [f.pdf_url, f.image_url])
      .filter(Boolean) as string[];

    if (filePaths.length > 0) {
      await supabase.storage.from("feedback-files").remove(filePaths);
    }

    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("feedback").delete().in("id", ids);
    if (error) {
      toast({ title: "Error", description: "Failed to delete selected feedback.", variant: "destructive" });
    } else {
      setFeedbackList((prev) => prev.filter((f) => !selectedIds.has(f.id)));
      setSelectedIds(new Set());
      toast({ title: "Deleted", description: `${ids.length} feedback item(s) deleted.` });
    }
  };

  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [regeneratingPdfs, setRegeneratingPdfs] = useState(false);

  const regenerateAllPdfs = async () => {
    if (!shipId || feedbackList.length === 0) return;
    if (!confirm("This will regenerate all PDFs with English comments. Continue?")) return;
    setRegeneratingPdfs(true);
    let count = 0;
    try {
      for (const f of feedbackList) {
        const pdfBlob = generateFeedbackPdf({
          shipName,
          roomNumber: f.room_number,
          language: f.language,
          ratings: f.ratings || {},
          comments: f.comments || {},
          submittedAt: f.submitted_at,
        });
        const pdfPath = `${shipId}/${Date.now()}_room${f.room_number}.pdf`;

        // Delete old PDF if exists
        if (f.pdf_url) {
          await supabase.storage.from("feedback-files").remove([f.pdf_url]);
        }

        // Upload new PDF
        const { error: uploadErr } = await supabase.storage
          .from("feedback-files")
          .upload(pdfPath, pdfBlob, { contentType: "application/pdf" });

        if (!uploadErr) {
          await supabase.from("feedback").update({ pdf_url: pdfPath }).eq("id", f.id);
          count++;
        }
      }
      toast({ title: "Done!", description: `Regenerated ${count} PDFs with English comments.` });
      // Refresh list
      const { data } = await supabase.from("feedback").select("*").eq("ship_id", shipId).order("submitted_at", { ascending: false });
      if (data) setFeedbackList(data as FeedbackRow[]);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to regenerate PDFs", variant: "destructive" });
    } finally {
      setRegeneratingPdfs(false);
    }
  };

  const downloadReportPdf = () => {
    if (!aiReport) return;
    setPdfGenerating(true);
    try {
      generateReportPdf(aiReport as any, shipName);
      toast({ title: "PDF Downloaded!", description: "Professional 6-page report saved." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to generate PDF", variant: "destructive" });
    } finally {
      setPdfGenerating(false);
    }
  };

  // Compute quick stats
  const totalResponses = feedbackList.length;
  const avgRating = (() => {
    if (feedbackList.length === 0) return "N/A";
    const ratingMap: Record<string, number> = { excellent: 4, veryGood: 3, good: 2, fair: 1 };
    let sum = 0, count = 0;
    feedbackList.forEach((f) => {
      if (f.ratings && typeof f.ratings === "object") {
        Object.values(f.ratings as Record<string, string>).forEach((v) => {
          if (ratingMap[v] !== undefined) { sum += ratingMap[v]; count++; }
        });
      }
    });
    if (count === 0) return "N/A";
    const avg = sum / count;
    return avg >= 3.5 ? "Excellent" : avg >= 2.5 ? "Very Good" : avg >= 1.5 ? "Good" : "Fair";
  })();

  const stats = [
    { label: "Total Responses", value: String(totalResponses), icon: MessageSquare, change: `${feedbackList.filter((f) => new Date(f.submitted_at).toDateString() === new Date().toDateString()).length} today` },
    { label: "Average Rating", value: avgRating, icon: Star, change: totalResponses > 0 ? "Across all items" : "No data yet" },
    { label: "Languages", value: String(new Set(feedbackList.map((f) => f.language)).size), icon: Globe, change: "Unique languages" },
    { label: "PDFs Available", value: String(feedbackList.filter((f) => f.pdf_url).length), icon: FileText, change: "Ready to download" },
  ];

  const mobileNavItems = sidebarItems.map((item) => ({
    icon: item.icon,
    label: item.label,
    onClick: () => setActiveTab(item.label),
    active: activeTab === item.label,
  }));

  const mobileBottomItems = [
    ...(isSystemOwner ? [{ icon: Ship, label: "Fleet Management", onClick: () => navigate("/admin/system") }] : []),
    { icon: LogOut, label: "Sign Out", onClick: handleLogout },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Nav */}
      <MobileNav
        brandIcon={MessageSquare}
        brandName="Guest Comment"
        brandSub="Admin Portal"
        items={mobileNavItems}
        bottomItems={mobileBottomItems}
      />
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border hidden md:flex">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-bold text-sm">Guest Comment</div>
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
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-1">
          {isSystemOwner && (
            <button
              onClick={() => navigate("/admin/system")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
            >
              <Ship className="h-4 w-4" />
              Fleet Management
            </button>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors">
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 overflow-auto pt-20 md:pt-6">
        {/* Ship Selector */}
        {userShips.length > 1 && shipId && (
          <ShipSelector
            ships={userShips}
            selectedShipId={shipId}
            onShipChange={handleShipSwitch}
          />
        )}
        <AnimatePresence mode="wait">
          {activeTab === "Dashboard" && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
                  <p className="text-sm text-muted-foreground">Welcome back. Here's your ship overview.</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="gap-2" onClick={downloadAllPdfs}>
                    <Download className="h-4 w-4" /> Download All
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={regenerateAllPdfs} disabled={regeneratingPdfs}>
                    {regeneratingPdfs ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {regeneratingPdfs ? "Regenerating..." : "Regenerate PDFs"}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={deleteAllFeedback}>
                    <Trash2 className="h-4 w-4" /> Delete All
                  </Button>
                  <Button size="sm" className="gap-2 bg-cruise-gold hover:bg-cruise-gold/90 text-white" onClick={generateAiReport} disabled={aiLoading}>
                    {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                    {aiLoading ? "Analyzing..." : "Generate AI Report"}
                  </Button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {stats.map((stat, i) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
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

              {/* Recent Feedback */}
              {loading ? (
                <Card><CardContent className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></CardContent></Card>
              ) : feedbackList.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Feedback Yet</h3>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      Share the QR code with your guests to start collecting feedback.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" /> Recent Feedback
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={toggleSelectAll}>
                          <Checkbox checked={selectedIds.size === feedbackList.length && feedbackList.length > 0} />
                          {selectedIds.size === feedbackList.length ? "Deselect All" : "Select All"}
                        </Button>
                        {selectedIds.size > 0 && (
                          <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={deleteSelectedFeedback}>
                            <Trash2 className="h-3 w-3" /> Delete ({selectedIds.size})
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {feedbackList.slice(0, 10).map((f) => (
                        <div
                          key={f.id}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedIds.has(f.id) ? "bg-primary/5 border-primary/30" : "bg-muted/50 border-border"
                          }`}
                          onClick={() => toggleSelect(f.id)}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox checked={selectedIds.has(f.id)} />
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                              {f.room_number}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground">Room {f.room_number}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(f.submitted_at).toLocaleString()} · {f.language.toUpperCase()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {f.pdf_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const { data } = await supabase.storage.from("feedback-files").download(f.pdf_url!);
                                  if (data) {
                                    const url = URL.createObjectURL(data);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = `feedback_${f.room_number}.pdf`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  }
                                }}
                              >
                                <Download className="h-3 w-3" /> PDF
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Charts */}
              <DashboardCharts feedbackList={feedbackList} />
            </motion.div>
          )}

          {activeTab === "AI Analytics" && (
            <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-display font-bold text-foreground">AI Analytics</h1>
                  <p className="text-sm text-muted-foreground">AI-powered feedback analysis and insights.</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="gap-2 bg-cruise-gold hover:bg-cruise-gold/90 text-white" onClick={generateAiReport} disabled={aiLoading}>
                    {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {aiLoading ? "Analyzing..." : "Regenerate Report"}
                  </Button>
                  {aiReport && (
                    <Button variant="outline" size="sm" className="gap-2" onClick={downloadReportPdf} disabled={pdfGenerating}>
                      {pdfGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {pdfGenerating ? "Generating..." : "Download Report PDF"}
                    </Button>
                  )}
                </div>
              </div>

              {!aiReport ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Brain className="h-12 w-12 mx-auto mb-4 text-cruise-gold" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Report Generated</h3>
                    <p className="text-muted-foreground text-sm mb-4">Click "Generate AI Report" to analyze your feedback data.</p>
                    <Button className="bg-cruise-gold hover:bg-cruise-gold/90 text-white gap-2" onClick={generateAiReport} disabled={aiLoading}>
                      {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                      Generate Report
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Executive Summary */}
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Executive Summary</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-foreground">{aiReport.executive_summary}</p>
                      <div className="flex gap-4 mt-4 text-sm">
                        <div className="px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium">
                          Overall: {aiReport.average_ratings.overall_average}%
                        </div>
                        <div className="px-3 py-1.5 rounded-full bg-muted text-foreground font-medium">
                          {aiReport.total_responses} responses
                        </div>
                        <div className="px-3 py-1.5 rounded-full bg-muted text-foreground font-medium capitalize">
                          Sentiment: {aiReport.sentiment_analysis.overall.replace(/_/g, " ")}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Average Ratings */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(["services", "facilities", "food"] as const).map((section) => (
                      <Card key={section}>
                        <CardHeader><CardTitle className="text-base capitalize">{section} ({aiReport.average_ratings[section].average}%)</CardTitle></CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {Object.entries(aiReport.average_ratings[section])
                              .filter(([k]) => k !== "average")
                              .map(([key, val]) => (
                                <div key={key} className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className="h-full rounded-full bg-primary transition-all"
                                        style={{ width: `${val}%` }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium w-10 text-right">{val}%</span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Top & Needs Improvement */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader><CardTitle className="text-base flex items-center gap-2"><ThumbsUp className="h-4 w-4 text-cruise-excellent" /> Top Performing</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {aiReport.top_performing.map((item, i) => (
                            <div key={i} className="p-2 rounded-lg bg-cruise-excellent/5 border border-cruise-excellent/20">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium text-foreground">{item.area}</span>
                                <span className="text-cruise-excellent font-bold">{item.score}%</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{item.note}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-cruise-fair" /> Needs Improvement</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {aiReport.needs_improvement.map((item, i) => (
                            <div key={i} className="p-2 rounded-lg bg-cruise-fair/5 border border-cruise-fair/20">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium text-foreground">{item.area}</span>
                                <span className="text-cruise-fair font-bold">{item.score}%</span>
                              </div>
                              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                                item.impact === "high" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                              }`}>{item.impact} impact</span>
                              <p className="text-xs text-muted-foreground mt-1">{item.suggestion}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Recommendations */}
                  <Card>
                    <CardHeader><CardTitle className="text-base">Actionable Recommendations</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {aiReport.recommendations.map((rec, i) => (
                          <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              rec.priority === "high" ? "bg-destructive text-destructive-foreground" :
                              rec.priority === "medium" ? "bg-cruise-gold text-white" : "bg-muted-foreground text-background"
                            }`}>{i + 1}</div>
                            <div>
                              <div className="text-sm font-medium text-foreground">{rec.title}</div>
                              <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                              <p className="text-xs text-primary mt-1">Impact: {rec.expected_impact}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Language Distribution */}
                  {aiReport.language_distribution.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Guest Language Distribution</CardTitle></CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {aiReport.language_distribution.map((l) => (
                            <div key={l.language} className="px-3 py-2 rounded-lg bg-muted border border-border text-sm">
                              <span className="font-medium text-foreground">{l.language}</span>
                              <span className="text-muted-foreground ml-2">{l.count} ({l.percentage}%)</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "Feedback PDFs" && (
            <motion.div key="pdfs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-display font-bold text-foreground">Feedback PDFs</h1>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={downloadAllPdfs}>
                    <Download className="h-4 w-4" /> Download All
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-destructive" onClick={deleteAllFeedback}>
                    <Trash2 className="h-4 w-4" /> Delete All
                  </Button>
                </div>
              </div>
              {feedbackList.length === 0 ? (
                <Card><CardContent className="p-12 text-center text-muted-foreground">No feedback submissions yet.</CardContent></Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {feedbackList.map((f) => (
                    <Card key={f.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-bold text-foreground">Room {f.room_number}</span>
                          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">{f.language.toUpperCase()}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mb-3">{new Date(f.submitted_at).toLocaleString()}</div>
                        {f.pdf_url ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2"
                            onClick={async () => {
                              const { data } = await supabase.storage.from("feedback-files").download(f.pdf_url!);
                              if (data) {
                                const url = URL.createObjectURL(data);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `feedback_${f.room_number}.pdf`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }
                            }}
                          >
                            <Download className="h-3 w-3" /> Download PDF
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">No PDF available</span>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "QR Code" && shipId && (
            <motion.div key="qr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-6">
                <h1 className="text-2xl font-display font-bold text-foreground">QR Code</h1>
                <p className="text-sm text-muted-foreground">Generate and share QR codes for guest feedback.</p>
              </div>
              <ShipQRCode shipId={shipId} shipName={shipName} />
            </motion.div>
          )}

          {(activeTab === "Users" || activeTab === "Settings") && (
            <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h1 className="text-2xl font-display font-bold text-foreground mb-4">{activeTab}</h1>
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  {activeTab} management coming soon.
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AdminDashboard;
