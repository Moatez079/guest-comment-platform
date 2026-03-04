import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Anchor, Ship, Plus, Trash2, Users, BarChart3, Globe, MessageSquare,
  LogOut, Settings, ChevronRight, Loader2, FileText, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ShipWithStats = {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
  feedbackCount: number;
  memberCount: number;
};

const SystemOwnerDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ships, setShips] = useState<ShipWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [newShipName, setNewShipName] = useState("");
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/admin/login"); return; }

    // Verify system_owner role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "system_owner");

    if (!roles || roles.length === 0) {
      navigate("/admin/dashboard");
      return;
    }

    await loadShips();
  };

  const loadShips = async () => {
    setLoading(true);
    const { data: shipsData, error } = await supabase
      .from("ships")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !shipsData) {
      setLoading(false);
      return;
    }

    // Get stats for each ship
    const shipsWithStats: ShipWithStats[] = await Promise.all(
      shipsData.map(async (ship) => {
        const [feedbackRes, membersRes] = await Promise.all([
          supabase.from("feedback").select("id", { count: "exact", head: true }).eq("ship_id", ship.id),
          supabase.from("ship_members").select("id", { count: "exact", head: true }).eq("ship_id", ship.id),
        ]);
        return {
          ...ship,
          feedbackCount: feedbackRes.count || 0,
          memberCount: membersRes.count || 0,
        };
      })
    );

    setShips(shipsWithStats);
    setLoading(false);
  };

  const createShip = async () => {
    if (!newShipName.trim()) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: ship, error } = await supabase
      .from("ships")
      .insert({ name: newShipName.trim(), created_by: user.id })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setCreating(false);
      return;
    }

    // Add system owner as ship member
    await supabase.from("ship_members").insert({ ship_id: ship.id, user_id: user.id });

    toast({ title: "Ship Created!", description: `${newShipName} has been added.` });
    setNewShipName("");
    setDialogOpen(false);
    setCreating(false);
    await loadShips();
  };

  const deleteShip = async (shipId: string, shipName: string) => {
    if (!confirm(`Delete "${shipName}" and ALL its feedback data? This cannot be undone.`)) return;

    // Delete storage files for this ship
    const { data: files } = await supabase.storage.from("feedback-files").list(shipId);
    if (files && files.length > 0) {
      await supabase.storage.from("feedback-files").remove(files.map((f) => `${shipId}/${f.name}`));
    }

    const { error } = await supabase.from("ships").delete().eq("id", shipId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Ship Deleted", description: `${shipName} has been removed.` });
      await loadShips();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const totalFeedback = ships.reduce((s, sh) => s + sh.feedbackCount, 0);
  const totalMembers = ships.reduce((s, sh) => s + sh.memberCount, 0);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border hidden md:flex">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Anchor className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-bold text-sm">Grand Rose</div>
              <div className="text-xs text-sidebar-foreground/60">System Owner</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-sidebar-accent text-sidebar-accent-foreground">
            <Ship className="h-4 w-4" /> Ships
          </button>
          <button
            onClick={() => navigate("/admin/dashboard")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
          >
            <BarChart3 className="h-4 w-4" /> Ship Dashboard
          </button>
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 overflow-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Fleet Management</h1>
              <p className="text-sm text-muted-foreground">Manage all your cruise ships from one place.</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-cruise-gold hover:bg-cruise-gold/90 text-white">
                  <Plus className="h-4 w-4" /> Add Ship
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Add New Ship</DialogTitle>
                  <DialogDescription>Create a new cruise ship workspace with its own QR code, feedback, and analytics.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="shipName">Ship Name</Label>
                    <Input
                      id="shipName"
                      placeholder="e.g. Grand Rose, Ocean Pearl..."
                      value={newShipName}
                      onChange={(e) => setNewShipName(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button onClick={createShip} disabled={creating || !newShipName.trim()} className="bg-primary">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Create Ship
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Global Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Ships", value: ships.length, icon: Ship },
              { label: "Total Feedback", value: totalFeedback, icon: MessageSquare },
              { label: "Team Members", value: totalMembers, icon: Users },
              { label: "Languages", value: "15+", icon: Globe },
            ].map((stat, i) => (
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
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Ships List */}
          {loading ? (
            <Card><CardContent className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></CardContent></Card>
          ) : ships.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Ship className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Ships Yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Create your first cruise ship to start collecting guest feedback.</p>
                <Button className="gap-2 bg-cruise-gold hover:bg-cruise-gold/90 text-white" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Your First Ship
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ships.map((ship, i) => (
                <motion.div
                  key={ship.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="hover:shadow-lg transition-all group relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-cruise-gold" />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Ship className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-display font-bold text-foreground">{ship.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              Created {new Date(ship.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteShip(ship.id, ship.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                          <div className="text-lg font-bold text-foreground">{ship.feedbackCount}</div>
                          <div className="text-xs text-muted-foreground">Feedback</div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                          <div className="text-lg font-bold text-foreground">{ship.memberCount}</div>
                          <div className="text-xs text-muted-foreground">Members</div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1"
                          onClick={() => {
                            // Navigate to dashboard with this ship selected
                            navigate(`/admin/dashboard?ship=${ship.id}`);
                          }}
                        >
                          <BarChart3 className="h-3 w-3" /> Dashboard
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            const url = `${window.location.origin}/ship/${ship.id}/feedback/lang`;
                            window.open(url, "_blank");
                          }}
                        >
                          <Globe className="h-3 w-3" /> Guest Form
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default SystemOwnerDashboard;
