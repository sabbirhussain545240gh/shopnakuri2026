import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { UserPlus, ShieldCheck, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  getRoleInfo,
  bootstrapAdmin,
  inviteUser,
  listInvites,
  revokeInvite,
} from "@/lib/admin.functions";

type Invite = {
  id: string;
  email: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

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

export function AdminPanel() {
  const fetchRoleInfo = useServerFn(getRoleInfo);
  const claimAdmin = useServerFn(bootstrapAdmin);
  const sendInvite = useServerFn(inviteUser);
  const fetchInvites = useServerFn(listInvites);
  const cancelInvite = useServerFn(revokeInvite);

  const [info, setInfo] = useState<{ isAdmin: boolean; adminCount: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await fetchRoleInfo();
      setInfo(r);
    } catch {
      setInfo({ isAdmin: false, adminCount: 0 });
    }
  };

  const loadInvites = async () => {
    setLoadingInvites(true);
    try {
      const r = await fetchInvites();
      setInvites(r.invites as Invite[]);
    } catch (e: any) {
      toast.error(e?.message ?? "ইনভাইট লোড করা যায়নি");
    } finally {
      setLoadingInvites(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (open && info?.isAdmin) loadInvites();
  }, [open, info?.isAdmin]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await claimAdmin();
      toast.success("আপনি এখন অ্যাডমিন");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "ত্রুটি");
    } finally {
      setClaiming(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      const res = await sendInvite({
        data: {
          email: email.trim(),
          redirectTo: `${window.location.origin}/welcome`,
        },
      });
      const exp = new Date(res.expiresAt);
      toast.success(`${email} এ ইনভাইট পাঠানো হয়েছে — মেয়াদ ${exp.toLocaleString("bn-BD")}`);
      setEmail("");
      await loadInvites();
    } catch (err: any) {
      toast.error(err?.message ?? "ইনভাইট পাঠানো যায়নি");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await cancelInvite({ data: { id } });
      toast.success("ইনভাইট বাতিল করা হয়েছে");
      await loadInvites();
    } catch (err: any) {
      toast.error(err?.message ?? "বাতিল করা যায়নি");
    } finally {
      setRevokingId(null);
    }
  };

  if (!info) return null;

  if (info.adminCount === 0) {
    return (
      <Button variant="outline" size="sm" onClick={handleClaim} disabled={claiming}>
        {claiming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
        অ্যাডমিন হন
      </Button>
    );
  }

  if (!info.isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="mr-2 h-4 w-4" />
          ইউজার ম্যানেজ
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ইউজার ইনভাইট ম্যানেজমেন্ট</DialogTitle>
          <DialogDescription>
            ইনভাইট লিংকের মেয়াদ ৪৮ ঘণ্টা। প্রতিটি লিংক শুধুমাত্র একবার ব্যবহারযোগ্য।
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="invite-email">ইমেইল</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            ইনভাইট পাঠান
          </Button>
        </form>

        <div className="mt-2">
          <div className="mb-2 text-sm font-medium">সাম্প্রতিক ইনভাইট</div>
          <div className="max-h-80 overflow-y-auto rounded-md border">
            {loadingInvites ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : invites.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">কোনো ইনভাইট নেই</div>
            ) : (
              <ul className="divide-y">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(inv.id)}
                          disabled={revokingId === inv.id}
                        >
                          {revokingId === inv.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          <span className="ml-1">বাতিল</span>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            বন্ধ করুন
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
