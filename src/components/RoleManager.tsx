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
  Search, ChevronLeft, ChevronRight, RefreshCw,
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
  inviteUser,
  listInvites,
  revokeInvite,
} from "@/lib/admin.functions";
import { roleLabel } from "@/lib/permissions";

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

  const [info, setInfo] = useState<{ isAdmin: boolean; adminCount: number } | null>(null);
  const [claiming, setClaiming] = useState(false);

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

  useEffect(() => { refreshInfo(); }, []);
  useEffect(() => {
    if (info?.isAdmin) { loadRoles(); loadInvites(); }
  }, [info?.isAdmin]);

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
        <Tabs defaultValue="roles" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="roles">
              <ShieldCheck className="mr-2 h-4 w-4" /> ভূমিকা ({rows.length})
            </TabsTrigger>
            <TabsTrigger value="invites">
              <Mail className="mr-2 h-4 w-4" /> ইনভাইট ({invites.filter((i) => !i.used_at && !i.revoked_at && new Date(i.expires_at) > new Date()).length})
            </TabsTrigger>
          </TabsList>

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
