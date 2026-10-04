import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, CheckCircle, XCircle, Trash2, Loader2, Ship, Shield,
  UserCheck, UserX, Clock, ArrowLeft, ShieldCheck, ShieldOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type UserProfile = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  status: string;
  created_at: string;
  can_delete_feedback: boolean;
  roles: { role: string; ship_id: string | null }[];
  ship_memberships: { ship_id: string; ship_name: string }[];
};

type ShipOption = { id: string; name: string };

const UserManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [ships, setShips] = useState<ShipOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [isSystemOwner, setIsSystemOwner] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ open: boolean; user: UserProfile | null }>({ open: false, user: null });
  const [selectedShip, setSelectedShip] = useState("");
  const [selectedRole, setSelectedRole] = useState("reception");

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/admin/login"); return; }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "system_owner");

    if (!roles || roles.length === 0) {
      navigate("/admin/dashboard");
      return;
    }

    setIsSystemOwner(true);
    setAuthChecked(true);
    await loadData();
  };

  const loadData = async () => {
    setLoading(true);
    const [profilesRes, shipsRes, rolesRes, membersRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("ships").select("id, name").order("name"),
      supabase.from("user_roles").select("*"),
      supabase.from("ship_members").select("*, ships(name)"),
    ]);

    const profiles = profilesRes.data || [];
    const allRoles = rolesRes.data || [];
    const allMembers = membersRes.data || [];

    const enriched: UserProfile[] = profiles.map((p: any) => ({
      ...p,
      roles: allRoles.filter((r: any) => r.user_id === p.user_id).map((r: any) => ({ role: r.role, ship_id: r.ship_id })),
      ship_memberships: allMembers
        .filter((m: any) => m.user_id === p.user_id)
        .map((m: any) => ({ ship_id: m.ship_id, ship_name: (m as any).ships?.name || "Unknown" })),
    }));

    setUsers(enriched);
    setShips(shipsRes.data || []);
    setLoading(false);
  };

  const updateStatus = async (userId: string, userAuthId: string, status: string) => {
    setActionLoading(userAuthId);
    const { error } = await supabase
      .from("profiles")
      .update({ status })
      .eq("user_id", userAuthId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: status === "approved" ? "✅ User Approved" : "⛔ User Suspended", description: `Status updated to ${status}.` });
      await loadData();
    }
    setActionLoading(null);
  };

  const assignShipAndRole = async () => {
    if (!assignDialog.user || !selectedShip) return;
    setActionLoading(assignDialog.user.user_id);

    const userId = assignDialog.user.user_id;

    // Add ship membership
    const { error: memberError } = await supabase
      .from("ship_members")
      .upsert({ ship_id: selectedShip, user_id: userId }, { onConflict: "ship_id,user_id" });

    if (memberError && !memberError.message.includes("duplicate")) {
      toast({ title: "Error", description: memberError.message, variant: "destructive" });
      setActionLoading(null);
      return;
    }

    // Add role for this ship
    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: selectedRole as any, ship_id: selectedShip }, { onConflict: "user_id,role,ship_id" });

    if (roleError && !roleError.message.includes("duplicate")) {
      toast({ title: "Error", description: roleError.message, variant: "destructive" });
      setActionLoading(null);
      return;
    }

    // Auto-approve if pending
    if (assignDialog.user.status === "pending") {
      await supabase.from("profiles").update({ status: "approved" }).eq("user_id", userId);
    }

    toast({ title: "✅ Ship Assigned", description: `User assigned to ship with role: ${selectedRole}` });
    setAssignDialog({ open: false, user: null });
    setSelectedShip("");
    setSelectedRole("reception");
    setActionLoading(null);
    await loadData();
  };

  const deleteUser = async (user: UserProfile) => {
    if (!confirm(`Delete "${user.full_name || user.email}"? This will remove their profile, roles, and memberships.`)) return;
    setActionLoading(user.user_id);

    // Delete roles, memberships, then profile
    await Promise.all([
      supabase.from("user_roles").delete().eq("user_id", user.user_id),
      supabase.from("ship_members").delete().eq("user_id", user.user_id),
    ]);

    const { error } = await supabase.from("profiles").delete().eq("user_id", user.user_id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "User Deleted", description: `${user.full_name || user.email} has been removed.` });
      await loadData();
    }
    setActionLoading(null);
  };

  const toggleDeletePermission = async (user: UserProfile) => {
    const newValue = !user.can_delete_feedback;
    setActionLoading(user.user_id);

    const { error } = await supabase
      .from("profiles")
      .update({ can_delete_feedback: newValue } as any)
      .eq("user_id", user.user_id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: newValue ? "🗑️ Delete Permission Granted" : "🔒 Read-Only Mode",
        description: newValue
          ? `${user.full_name || user.email} can now delete feedback.`
          : `${user.full_name || user.email} is now read-only.`,
      });
      await loadData();
    }

    setActionLoading(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20"><UserCheck className="h-3 w-3 mr-1" /> Approved</Badge>;
      case "suspended":
        return <Badge variant="destructive" className="gap-1"><UserX className="h-3 w-3" /> Suspended</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="h-3 w-3" /> Pending</Badge>;
    }
  };

  const { data: currentUser } = supabase.auth.getUser ? { data: null } : { data: null };

  const pendingCount = users.filter((u) => u.status === "pending").length;

  // Don't render UI until role is confirmed
  if (!authChecked || !isSystemOwner) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/system")} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6" /> User Management
            </h1>
            <p className="text-sm text-muted-foreground">Approve, assign ships, and manage user accounts.</p>
          </div>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-sm px-3 py-1">
              {pendingCount} pending approval
            </Badge>
          )}
        </div>

        {loading ? (
          <Card><CardContent className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></CardContent></Card>
        ) : users.length === 0 ? (
          <Card><CardContent className="p-12 text-center"><Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" /><h3 className="text-lg font-semibold">No users yet</h3></CardContent></Card>
        ) : (
          <div className="space-y-3">
            {users.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className={`transition-all ${user.status === "pending" ? "border-amber-500/30 bg-amber-500/5" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">{user.full_name || "No Name"}</h3>
                          {getStatusBadge(user.status)}
                          {user.roles.map((r, ri) => (
                            <Badge key={ri} variant="outline" className="text-xs gap-1">
                              <Shield className="h-2.5 w-2.5" /> {r.role}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            Joined {new Date(user.created_at).toLocaleDateString()}
                          </span>
                          {user.ship_memberships.length > 0 && (
                            <div className="flex items-center gap-1">
                              {user.ship_memberships.map((m, mi) => (
                                <Badge key={mi} variant="outline" className="text-xs gap-1">
                                  <Ship className="h-2.5 w-2.5" /> {m.ship_name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {user.roles.some((r) => r.role === "system_owner") ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20">Owner</Badge>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mr-2 flex-wrap">
                              <Badge variant={user.can_delete_feedback ? "default" : "secondary"} className="gap-1">
                                {user.can_delete_feedback ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
                                {user.can_delete_feedback ? "Can Delete Feedback" : "Read Only"}
                              </Badge>
                              <Button
                                size="sm"
                                variant={user.can_delete_feedback ? "outline" : "default"}
                                className="gap-1"
                                onClick={() => toggleDeletePermission(user)}
                                disabled={actionLoading === user.user_id}
                              >
                                {user.can_delete_feedback ? <ShieldOff className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                                {user.can_delete_feedback ? "Set Read Only" : "Allow Delete"}
                              </Button>
                            </div>
                            {user.status === "pending" && (
                              <Button
                                size="sm"
                                className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => { setAssignDialog({ open: true, user }); }}
                                disabled={actionLoading === user.user_id}
                              >
                                {actionLoading === user.user_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                                Approve & Assign
                              </Button>
                            )}
                            {user.status === "approved" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => { setAssignDialog({ open: true, user }); }}
                                >
                                  <Ship className="h-3 w-3" /> Assign Ship
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1 text-amber-600 hover:text-amber-700"
                                  onClick={() => updateStatus(user.id, user.user_id, "suspended")}
                                  disabled={actionLoading === user.user_id}
                                >
                                  <XCircle className="h-3 w-3" /> Suspend
                                </Button>
                              </>
                            )}
                            {user.status === "suspended" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-green-600"
                                onClick={() => updateStatus(user.id, user.user_id, "approved")}
                                disabled={actionLoading === user.user_id}
                              >
                                <CheckCircle className="h-3 w-3" /> Reactivate
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteUser(user)}
                              disabled={actionLoading === user.user_id}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Assign Ship Dialog */}
        <Dialog open={assignDialog.open} onOpenChange={(open) => { if (!open) setAssignDialog({ open: false, user: null }); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Assign Ship & Role</DialogTitle>
              <DialogDescription>
                Assign <strong>{assignDialog.user?.full_name || assignDialog.user?.email}</strong> to a ship with a specific role.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ship</label>
                <Select value={selectedShip} onValueChange={setSelectedShip}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a ship..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ships.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2"><Ship className="h-3 w-3" /> {s.name}</div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ship_owner">Ship Owner</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="reception">Reception</SelectItem>
                    <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialog({ open: false, user: null })}>Cancel</Button>
              <Button onClick={assignShipAndRole} disabled={!selectedShip || actionLoading === assignDialog.user?.user_id}>
                {actionLoading === assignDialog.user?.user_id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Assign & Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
};

export default UserManagement;
