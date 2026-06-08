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
import { UserPlus, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getRoleInfo, bootstrapAdmin, inviteUser } from "@/lib/admin.functions";

export function AdminPanel() {
  const fetchRoleInfo = useServerFn(getRoleInfo);
  const claimAdmin = useServerFn(bootstrapAdmin);
  const sendInvite = useServerFn(inviteUser);

  const [info, setInfo] = useState<{ isAdmin: boolean; adminCount: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const refresh = async () => {
    try {
      const r = await fetchRoleInfo();
      setInfo(r);
    } catch {
      setInfo({ isAdmin: false, adminCount: 0 });
    }
  };

  useEffect(() => {
    refresh();
  }, []);

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
      await sendInvite({
        data: {
          email: email.trim(),
          redirectTo: `${window.location.origin}/welcome`,
        },
      });
      toast.success(`${email} এ ইনভাইট পাঠানো হয়েছে`);
      setEmail("");
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? "ইনভাইট পাঠানো যায়নি");
    } finally {
      setSubmitting(false);
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
          ইউজার ইনভাইট
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>নতুন ইউজার ইনভাইট করুন</DialogTitle>
          <DialogDescription>
            ইমেইলে একটি ইনভাইট লিংক পাঠানো হবে। লিংকে ক্লিক করে ব্যবহারকারী পাসওয়ার্ড সেট করতে পারবেন।
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-2">
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
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              ইনভাইট পাঠান
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
