import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Loader2, Trash2, ShieldCheck, UserPlus, Mail, X, Crown, Users as UsersIcon,
  Search, ChevronLeft, ChevronRight, RefreshCw, KeyRound, Check, Ban, BellRing, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  listAllRoles,
  listUsersWithRoles,
  assignRoleByEmail,
  removeRoleAssignment,
  type AppRole,
} from "@/lib/roles.functions";
import {
  getRoleInfo,
  bootstrapAdmin,
  createManagedUser,
  inviteUser,
  listInvites,
  revokeInvite,
  resetUserPassword,
  deleteManagedUser,
} from "@/lib/admin.functions";
import {
  listPendingAccounts,
  setAccountStatus,
  type AccountStatus,
} from "@/lib/approval.functions";
import { roleLabel } from "@/lib/permissions";
import { useSamiti } from "@/lib/samiti-store";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

type Row = { id: string; userId: string; email: string; role: AppRole; createdAt: string };
type Invite = {
  id: string;
  email: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const ASSIGNABLE: AppRole[] = ["treasurer", "president", "secretary", "member", "admin"];

function inviteStatus(inv: Invite): { label: string; tone: string } {
  if (inv.used_at) return { label: "ব্যবহৃত", tone: "text-muted-foreground" };
  if (inv.revoked_at) return { label: "বাতিল", tone: "text-destructive" };
  if (new Date(inv.expires_at).getTime() < Date.now())
    return { label: "মেয়াদোত্তীর্ণ", tone: "text-destructive" };
  return { label: "মুলতবি", tone: "text-primary" };
}

function formatRelative(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = h > 0 ? `${h}ঘ ${m}মি` : `${m}মি`;
  return diff >= 0 ? `${s} বাকি` : `${s} আগে`;
}

export function RoleManager() {
  const fetchInfo = useServerFn(getRoleInfo);
  const claimAdmin = useServerFn(bootstrapAdmin);
  const fetchAll = useServerFn(listAllRoles);
  const assign = useServerFn(assignRoleByEmail);
  const remove = useServerFn(removeRoleAssignment);
  const sendInvite = useServerFn(inviteUser);
  const fetchInvites = useServerFn(listInvites);
  const cancelInvite = useServerFn(revokeInvite);
  const fetchUsers = useServerFn(listUsersWithRoles);
  const createUser = useServerFn(createManagedUser);
  const fetchPending = useServerFn(listPendingAccounts);
  const updateStatus = useServerFn(setAccountStatus);
  const resetPassword = useServerFn(resetUserPassword);
  const deleteUser = useServerFn(deleteManagedUser);

  const [info, setInfo] = useState<{ isAdmin: boolean; adminCount: number } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [pwTarget, setPwTarget] = useState<UserRow | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  type PendingRow = { user_id: string; identifier: string; status: AccountStatus; created_at: string; approved_at: string | null };
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("treasurer");
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [invEmail, setInvEmail] = useState("");
  const [invSubmitting, setInvSubmitting] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // Users table
  type UserRow = {
    id: string; email: string; createdAt: string; lastSignInAt: string | null;
    roles: { id: string; role: AppRole; createdAt: string }[];
    displayName: string | null; memberRef: string | null; status: string | null;
  };
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | AppRole | "none">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [quickRole, setQuickRole] = useState<AppRole>("member");
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);

  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountRole, setAccountRole] = useState<AppRole>("member");
  const [creatingAccount, setCreatingAccount] = useState(false);

  const refreshInfo = async () => {
    try { setInfo(await fetchInfo()); }
    catch { setInfo({ isAdmin: false, adminCount: 0 }); }
  };

  const loadRoles = async () => {
    setLoadingRows(true);
    try {
      const r = await fetchAll();
      setRows(r.assignments as Row[]);
    } catch (e: any) {
      toast.error(e?.message ?? "ভূমিকা লোড করা যায়নি");
    } finally { setLoadingRows(false); }
  };

  const loadInvites = async () => {
    setLoadingInvites(true);
    try {
      const r = await fetchInvites();
      setInvites(r.invites as Invite[]);
    } catch (e: any) {
      toast.error(e?.message ?? "ইনভাইট লোড করা যায়নি");
    } finally { setLoadingInvites(false); }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const r = await fetchUsers();
      setUsers(r.users as UserRow[]);
    } catch (e: any) {
      toast.error(e?.message ?? "ইউজার লোড করা যায়নি");
    } finally { setLoadingUsers(false); }
  };

  const loadPending = async () => {
    setLoadingPending(true);
    try {
      const r = await fetchPending();
      setPending(r.profiles as PendingRow[]);
    } catch (e: any) {
      toast.error(e?.message ?? "অনুমোদন তালিকা লোড করা যায়নি");
    } finally { setLoadingPending(false); }
  };

  const changeStatus = async (
    userId: string,
    status: AccountStatus,
    extra?: { role?: AppRole; displayName?: string; memberRef?: string },
  ) => {
    setStatusBusyId(userId);
    try {
      await updateStatus({ data: { userId, status, ...(extra ?? {}) } });
      toast.success(status === "active" ? "অ্যাকাউন্ট অনুমোদিত" : status === "rejected" ? "অ্যাকাউন্ট প্রত্যাখ্যাত" : "স্ট্যাটাস আপডেট হয়েছে");
      await Promise.all([loadPending(), loadRoles(), loadUsers()]);
    } catch (err: any) {
      toast.error(err?.message ?? "আপডেট করা যায়নি");
    } finally { setStatusBusyId(null); }
  };

  // Approval dialog state
  const samiti = useSamiti();
  const [approveTarget, setApproveTarget] = useState<PendingRow | null>(null);
  const [approveRole, setApproveRole] = useState<AppRole>("member");
  const [approveMemberId, setApproveMemberId] = useState<string>("none");
  const [approveName, setApproveName] = useState("");

  const openApprove = (p: PendingRow) => {
    setApproveTarget(p);
    setApproveRole("member");
    setApproveMemberId("none");
    setApproveName("");
  };
  const submitApprove = async () => {
    if (!approveTarget) return;
    const selected = approveMemberId !== "none" ? samiti.data.members.find((m) => m.id === approveMemberId) : null;
    const displayName = (approveName.trim() || selected?.name || "").trim();
    await changeStatus(approveTarget.user_id, "active", {
      role: approveRole,
      displayName: displayName || undefined,
      memberRef: selected ? selected.id : undefined,
    });
    setApproveTarget(null);
  };

  useEffect(() => { refreshInfo(); }, []);
  useEffect(() => {
    if (info?.isAdmin) { loadRoles(); loadInvites(); loadUsers(); loadPending(); }
  }, [info?.isAdmin]);

  // Filtered + paginated users
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !u.email.toLowerCase().includes(q) && !u.id.toLowerCase().includes(q)) return false;
      if (filterRole === "all") return true;
      if (filterRole === "none") return u.roles.length === 0;
      return u.roles.some((r) => r.role === filterRole);
    });
  }, [users, search, filterRole]);

  useEffect(() => { setPage(1); }, [search, filterRole, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pageUsers = filteredUsers.slice(pageStart, pageStart + pageSize);

  const assignToUser = async (userEmail: string, userId: string) => {
    if (!userEmail) { toast.error("এই ইউজারের ইমেইল নেই"); return; }
    setAssigningUserId(userId);
    try {
      await assign({ data: { email: userEmail, role: quickRole } });
      toast.success(`${roleLabel(quickRole)} ভূমিকা যোগ হয়েছে`);
      await Promise.all([loadRoles(), loadUsers()]);
    } catch (err: any) {
      toast.error(err?.message ?? "ভূমিকা বরাদ্দ করা যায়নি");
    } finally { setAssigningUserId(null); }
  };

  const removeRoleRow = async (id: string) => {
    try {
      await remove({ data: { id } });
      toast.success("ভূমিকা সরানো হয়েছে");
      await Promise.all([loadRoles(), loadUsers()]);
    } catch (err: any) {
      toast.error(err?.message ?? "সরানো যায়নি");
    }
  };

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await claimAdmin();
      toast.success("আপনি এখন সুপার এডমিন");
      await refreshInfo();
    } catch (err: any) {
      toast.error(err?.message ?? "ত্রুটি");
    } finally { setClaiming(false); }
  };

  const onAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await assign({ data: { email: email.trim(), role } });
      toast.success(`${roleLabel(role)} ভূমিকা যোগ হয়েছে`);
      setEmail("");
      await loadRoles();
    } catch (err: any) {
      toast.error(err?.message ?? "ভূমিকা বরাদ্দ করা যায়নি");
    } finally { setSubmitting(false); }
  };

  const onRemove = async (id: string) => {
    setRemovingId(id);
    try {
      await remove({ data: { id } });
      toast.success("ভূমিকা সরানো হয়েছে");
      await loadRoles();
    } catch (err: any) {
      toast.error(err?.message ?? "সরানো যায়নি");
    } finally { setRemovingId(null); }
  };

  const onCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountIdentifier.trim() || !accountPassword) return;
    setCreatingAccount(true);
    try {
      const res = await createUser({
        data: {
          identifier: accountIdentifier.trim(),
          password: accountPassword,
          role: accountRole,
        },
      });
      toast.success(res.created ? "নতুন অ্যাকাউন্ট তৈরি হয়েছে" : "আগের অ্যাকাউন্টে ভূমিকা যোগ হয়েছে");
      setAccountIdentifier("");
      setAccountPassword("");
      await Promise.all([loadRoles(), loadUsers()]);
    } catch (err: any) {
      toast.error(err?.message ?? "অ্যাকাউন্ট তৈরি করা যায়নি");
    } finally { setCreatingAccount(false); }
  };

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invEmail.trim()) return;
    setInvSubmitting(true);
    try {
      const res = await sendInvite({
        data: { email: invEmail.trim(), redirectTo: `${window.location.origin}/welcome` },
      });
      const exp = new Date(res.expiresAt);
      toast.success(`ইনভাইট পাঠানো হয়েছে — মেয়াদ ${exp.toLocaleString("bn-BD")}`);
      setInvEmail("");
      await loadInvites();
    } catch (err: any) {
      toast.error(err?.message ?? "ইনভাইট পাঠানো যায়নি");
    } finally { setInvSubmitting(false); }
  };

  const onRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await cancelInvite({ data: { id } });
      toast.success("ইনভাইট বাতিল হয়েছে");
      await loadInvites();
    } catch (err: any) {
      toast.error(err?.message ?? "বাতিল করা যায়নি");
    } finally { setRevokingId(null); }
  };

  if (!info) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Bootstrap state — no admin yet
  if (info.adminCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" /> সুপার এডমিন সেটআপ
          </CardTitle>
          <CardDescription>
            এখনো কোনো সুপার এডমিন নেই। আপনি প্রথম ইউজার হিসেবে সুপার এডমিন হয়ে যেতে পারেন।
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleClaim} disabled={claiming}>
            {claiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crown className="mr-2 h-4 w-4" />}
            আমি সুপার এডমিন হব
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Not admin — hide panel
  if (!info.isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> সুপার এডমিন প্যানেল
        </CardTitle>
        <CardDescription>
          ইউজার ইনভাইট, ভূমিকা বরাদ্দ ও ব্যবস্থাপনা একই জায়গায়।
          <br />
          <span className="text-xs">
            • সুপার এডমিন: সব • কোষাধ্যক্ষ: লেনদেন/জমা/ঋণ এডিট • সভাপতি ও সাধারণ সম্পাদক: দেখা + নোটিশ/বাণী এডিট • সদস্য: শুধু ড্যাশবোর্ড ও রিপোর্ট
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={pending.some((p) => p.status === "pending") ? "pending" : "users"} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pending" className="relative">
              <BellRing className="mr-2 h-4 w-4" /> অনুমোদন
              {pending.filter((p) => p.status === "pending").length > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                  {pending.filter((p) => p.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="users">
              <UsersIcon className="mr-2 h-4 w-4" /> ইউজার ({users.length})
            </TabsTrigger>
            <TabsTrigger value="roles">
              <ShieldCheck className="mr-2 h-4 w-4" /> ভূমিকা ({rows.length})
            </TabsTrigger>
            <TabsTrigger value="invites">
              <Mail className="mr-2 h-4 w-4" /> ইনভাইট ({invites.filter((i) => !i.used_at && !i.revoked_at && new Date(i.expires_at) > new Date()).length})
            </TabsTrigger>
          </TabsList>

          {/* ===== Pending approvals ===== */}
          <TabsContent value="pending" className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                নতুন সাইনআপ এবং অ্যাকাউন্ট স্ট্যাটাস ব্যবস্থাপনা। অনুমোদন না হওয়া পর্যন্ত ইউজার লগইন করতে পারবে না।
              </p>
              <Button variant="outline" size="sm" onClick={loadPending} disabled={loadingPending}>
                {loadingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ইউজার</TableHead>
                    <TableHead>স্ট্যাটাস</TableHead>
                    <TableHead className="hidden md:table-cell">সাইনআপ</TableHead>
                    <TableHead className="text-right">অ্যাকশন</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingPending ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground inline" />
                    </TableCell></TableRow>
                  ) : pending.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                      কোনো অ্যাকাউন্ট নেই
                    </TableCell></TableRow>
                  ) : pending.map((p) => (
                    <TableRow key={p.user_id}>
                      <TableCell className="font-medium">
                        <div className="truncate max-w-[240px]">{p.identifier || "—"}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[240px]">{p.user_id}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === "active" ? "default" : p.status === "pending" ? "secondary" : "destructive"}>
                          {p.status === "active" ? "সক্রিয়" : p.status === "pending" ? "অপেক্ষমাণ" : "প্রত্যাখ্যাত"}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleString("bn-BD")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          {p.status !== "active" && (
                            <Button size="sm" variant="default" disabled={statusBusyId === p.user_id}
                              onClick={() => openApprove(p)}>
                              {statusBusyId === p.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />অনুমোদন</>}
                            </Button>
                          )}
                          {p.status !== "rejected" && (
                            <Button size="sm" variant="outline" disabled={statusBusyId === p.user_id}
                              onClick={() => changeStatus(p.user_id, "rejected")}>
                              <Ban className="h-3.5 w-3.5 mr-1" />ব্লক
                            </Button>
                          )}
                          {p.status === "rejected" && (
                            <Button size="sm" variant="ghost" disabled={statusBusyId === p.user_id}
                              onClick={() => changeStatus(p.user_id, "pending")}>
                              পুনঃচালু
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>অ্যাকাউন্ট অনুমোদন</DialogTitle>
                  <DialogDescription className="break-all">
                    {approveTarget?.identifier}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>ক্যাটাগরি / ভূমিকা</Label>
                    <Select value={approveRole} onValueChange={(v) => setApproveRole(v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE.map((r) => (
                          <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>সদস্য নির্বাচন (ঐচ্ছিক)</Label>
                    <Select
                      value={approveMemberId}
                      onValueChange={(v) => {
                        setApproveMemberId(v);
                        if (v !== "none") {
                          const m = samiti.data.members.find((x) => x.id === v);
                          if (m && !approveName) setApproveName(m.name);
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="সদস্য সিলেক্ট করুন" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— কোনো সদস্য সংযুক্ত নয় —</SelectItem>
                        {samiti.data.members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            #{m.serial} — {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>প্রদর্শিত নাম</Label>
                    <Input
                      value={approveName}
                      onChange={(e) => setApproveName(e.target.value)}
                      placeholder="পুরো নাম"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setApproveTarget(null)}>বাতিল</Button>
                  <Button
                    onClick={submitApprove}
                    disabled={!!approveTarget && statusBusyId === approveTarget.user_id}
                  >
                    {approveTarget && statusBusyId === approveTarget.user_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><Check className="h-3.5 w-3.5 mr-1" />অনুমোদন করুন</>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>


          {/* ===== Users ===== */}
          <TabsContent value="users" className="space-y-4 pt-4">
            <form onSubmit={onCreateAccount} className="rounded-md border bg-muted/30 p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_180px_160px_auto] sm:items-end">
                <div className="space-y-1.5">
                  <Label htmlFor="managed-identifier">মোবাইল / ইমেইল</Label>
                  <Input
                    id="managed-identifier"
                    value={accountIdentifier}
                    onChange={(e) => setAccountIdentifier(e.target.value)}
                    placeholder="user@example.com বা +8801XXXXXXXXX"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="managed-password">পাসওয়ার্ড</Label>
                  <Input
                    id="managed-password"
                    type="password"
                    value={accountPassword}
                    onChange={(e) => setAccountPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ভূমিকা</Label>
                  <Select value={accountRole} onValueChange={(v) => setAccountRole(v as AppRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE.map((r) => (
                        <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={creatingAccount}>
                  {creatingAccount ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  অ্যাকাউন্ট তৈরি
                </Button>
              </div>
            </form>

            <div className="grid gap-3 sm:grid-cols-[1fr_180px_180px_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="user-search">সার্চ</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="user-search" className="pl-8" value={search}
                    onChange={(e) => setSearch(e.target.value)} placeholder="ইমেইল দিয়ে খুঁজুন" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>ভূমিকা ফিল্টার</Label>
                <Select value={filterRole} onValueChange={(v) => setFilterRole(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সব ইউজার</SelectItem>
                    <SelectItem value="none">ভূমিকা নেই</SelectItem>
                    {ASSIGNABLE.map((r) => (
                      <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>দ্রুত ভূমিকা বরাদ্দ</Label>
                <Select value={quickRole} onValueChange={(v) => setQuickRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE.map((r) => (
                      <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={loadUsers} disabled={loadingUsers}>
                {loadingUsers ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ইমেইল</TableHead>
                    <TableHead>সদস্য নাম + নং</TableHead>
                    <TableHead>ভূমিকা</TableHead>
                    <TableHead className="hidden md:table-cell">শেষ লগইন</TableHead>
                    <TableHead className="text-right">অ্যাকশন</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingUsers ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground inline" />
                    </TableCell></TableRow>
                  ) : pageUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                      কোনো ইউজার পাওয়া যায়নি
                    </TableCell></TableRow>
                  ) : pageUsers.map((u) => {
                    const member = u.memberRef ? samiti.data.members.find((m) => m.id === u.memberRef) : null;
                    return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <div className="truncate max-w-[220px]" title={u.email}>{u.email || "—"}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]" title={u.id}>{u.id}</div>
                      </TableCell>
                      <TableCell>
                        {member ? (
                          <div className="text-sm">
                            <span className="font-medium">{member.name}</span>
                            <span className="ml-1 text-xs text-muted-foreground">#{member.serial}</span>
                          </div>
                        ) : u.displayName ? (
                          <span className="text-sm">{u.displayName}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">কোনো ভূমিকা নেই</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((r) => (
                              <Badge key={r.id} variant="secondary" className="gap-1">
                                {roleLabel(r.role)}
                                <button
                                  onClick={() => removeRoleRow(r.id)}
                                  className="ml-1 hover:text-destructive cursor-pointer"
                                  title="সরান">
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString("bn-BD") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1 flex-wrap justify-end">
                          <Button size="sm" variant="outline" disabled={assigningUserId === u.id || !u.email}
                            onClick={() => assignToUser(u.email, u.id)}>
                            {assigningUserId === u.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <><UserPlus className="h-3.5 w-3.5 mr-1" />{roleLabel(quickRole)}</>}
                          </Button>
                          <Button size="sm" variant="ghost" title="পাসওয়ার্ড রিসেট"
                            onClick={() => { setPwTarget(u); setPwValue(""); }}>
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                            title="ডিলিট" disabled={deletingId === u.id}
                            onClick={async () => {
                              if (!confirm(`এই অ্যাকাউন্ট স্থায়ীভাবে মুছে ফেলতে চান?\n\n${u.email || u.id}`)) return;
                              setDeletingId(u.id);
                              try {
                                await deleteUser({ data: { userId: u.id } });
                                toast.success("অ্যাকাউন্ট মুছে ফেলা হয়েছে");
                                await Promise.all([loadUsers(), loadRoles(), loadPending()]);
                              } catch (err: any) {
                                toast.error(err?.message ?? "মুছা যায়নি");
                              } finally { setDeletingId(null); }
                            }}>
                            {deletingId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <Dialog open={!!pwTarget} onOpenChange={(o) => !o && setPwTarget(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>পাসওয়ার্ড রিসেট</DialogTitle>
                  <DialogDescription className="break-all">
                    {pwTarget?.email || pwTarget?.id}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-pw">নতুন পাসওয়ার্ড</Label>
                  <Input id="reset-pw" type="text" value={pwValue}
                    onChange={(e) => setPwValue(e.target.value)}
                    placeholder="কমপক্ষে ৬ অক্ষর" minLength={6} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setPwTarget(null)}>বাতিল</Button>
                  <Button disabled={pwBusy || pwValue.length < 6} onClick={async () => {
                    if (!pwTarget) return;
                    setPwBusy(true);
                    try {
                      await resetPassword({ data: { userId: pwTarget.id, password: pwValue } });
                      toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে");
                      setPwTarget(null);
                      setPwValue("");
                    } catch (err: any) {
                      toast.error(err?.message ?? "পরিবর্তন করা যায়নি");
                    } finally { setPwBusy(false); }
                  }}>
                    {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="h-3.5 w-3.5 mr-1" />সংরক্ষণ</>}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>


            {/* Pagination */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
              <div className="text-muted-foreground">
                মোট {filteredUsers.length} ইউজার {filteredUsers.length > 0 && `(${pageStart + 1}-${Math.min(pageStart + pageSize, filteredUsers.length)})`}
              </div>
              <div className="flex items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="w-[90px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}/পেজ</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">{page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>


          {/* ===== Roles ===== */}
          <TabsContent value="roles" className="space-y-4 pt-4">
            <form onSubmit={onAssign} className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="role-email">ইউজার ইমেইল</Label>
                <Input id="role-email" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>ভূমিকা</Label>
                <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE.map((r) => (
                      <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                যোগ করুন
              </Button>
            </form>

            <div className="rounded-md border">
              <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">
                বরাদ্দকৃত ভূমিকা ({rows.length})
              </div>
              {loadingRows ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : rows.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">কোনো ভূমিকা বরাদ্দ নেই</div>
              ) : (
                <ul className="divide-y max-h-80 overflow-y-auto">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{r.email || r.userId}</div>
                        <div className="text-xs text-muted-foreground">{roleLabel(r.role)}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => onRemove(r.id)}
                        disabled={removingId === r.id}>
                        {removingId === r.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          {/* ===== Invites ===== */}
          <TabsContent value="invites" className="space-y-4 pt-4">
            <form onSubmit={onInvite} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="inv-email">ইমেইল</Label>
                <Input id="inv-email" type="email" required value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <Button type="submit" disabled={invSubmitting}>
                {invSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                ইনভাইট পাঠান
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              ইনভাইট লিংকের মেয়াদ ৪৮ ঘণ্টা। ইউজার অ্যাকাউন্ট তৈরির পর আপনি ভূমিকা ট্যাবে গিয়ে ভূমিকা বরাদ্দ করতে পারবেন।
            </p>

            <div className="rounded-md border">
              <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">
                সাম্প্রতিক ইনভাইট ({invites.length})
              </div>
              {loadingInvites ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : invites.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">কোনো ইনভাইট নেই</div>
              ) : (
                <ul className="divide-y max-h-80 overflow-y-auto">
                  {invites.map((inv) => {
                    const st = inviteStatus(inv);
                    const pending = !inv.used_at && !inv.revoked_at && new Date(inv.expires_at) > new Date();
                    return (
                      <li key={inv.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{inv.email}</div>
                          <div className="text-xs text-muted-foreground">
                            <span className={st.tone}>{st.label}</span>
                            {" · "}
                            {pending
                              ? formatRelative(inv.expires_at)
                              : inv.used_at
                                ? `ব্যবহৃত ${formatRelative(inv.used_at)}`
                                : inv.revoked_at
                                  ? `বাতিল ${formatRelative(inv.revoked_at)}`
                                  : `মেয়াদ ${formatRelative(inv.expires_at)}`}
                          </div>
                        </div>
                        {pending && (
                          <Button variant="ghost" size="sm" onClick={() => onRevoke(inv.id)}
                            disabled={revokingId === inv.id}>
                            {revokingId === inv.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <X className="h-4 w-4" />}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
