import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { validateMyInvite, consumeMyInvite } from "@/lib/admin.functions";

export const Route = createFileRoute("/welcome")({
  component: WelcomePage,
  errorComponent: ({ error }) => <div className="p-8 text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">পাওয়া যায়নি</div>,
});

type InviteState =
  | { kind: "loading" }
  | { kind: "no-session" }
  | { kind: "invalid"; reason: "expired" | "used" | "revoked" | "not_found" }
  | { kind: "valid"; inviteId: string };

function reasonText(r: "expired" | "used" | "revoked" | "not_found") {
  switch (r) {
    case "expired":
      return "এই ইনভাইট লিংকের মেয়াদ শেষ হয়েছে।";
    case "used":
      return "এই ইনভাইট লিংক ইতিমধ্যে ব্যবহার করা হয়েছে।";
    case "revoked":
      return "এই ইনভাইট অ্যাডমিন কর্তৃক বাতিল করা হয়েছে।";
    case "not_found":
      return "ইনভাইট পাওয়া যায়নি।";
  }
}

function WelcomePage() {
  const navigate = useNavigate();
  const checkInvite = useServerFn(validateMyInvite);
  const consume = useServerFn(consumeMyInvite);
  const [state, setState] = useState<InviteState>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!cancelled) setState({ kind: "no-session" });
        return;
      }
      try {
        const res = await checkInvite();
        if (cancelled) return;
        if (res.valid) setState({ kind: "valid", inviteId: res.inviteId });
        else {
          // Sign out so an invalid/expired link can't grant lingering access.
          await supabase.auth.signOut();
          setState({ kind: "invalid", reason: res.reason });
        }
      } catch (e: any) {
        if (!cancelled) {
          await supabase.auth.signOut();
          setState({ kind: "invalid", reason: "not_found" });
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== "valid") return;
    if (password.length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
      return;
    }
    if (password !== confirm) {
      toast.error("পাসওয়ার্ড মিলছে না");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await consume({ data: { inviteId: state.inviteId } });
      toast.success("অ্যাকাউন্ট তৈরি হয়েছে");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err?.message ?? "ত্রুটি ঘটেছে");
    } finally {
      setSubmitting(false);
    }
  };

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.kind === "no-session" || state.kind === "invalid") {
    const msg =
      state.kind === "no-session"
        ? "লিংকটি মেয়াদোত্তীর্ণ অথবা ইতিমধ্যে ব্যবহার করা হয়েছে। অ্যাডমিনের কাছ থেকে নতুন ইনভাইট নিন।"
        : reasonText(state.reason) + " অ্যাডমিনের কাছ থেকে নতুন ইনভাইট নিন।";
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>ইনভাইট লিংক অবৈধ</CardTitle>
            <CardDescription>{msg}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate({ to: "/" })} className="w-full">
              হোমে ফিরে যান
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">স্বাগতম!</CardTitle>
          <CardDescription>আপনার অ্যাকাউন্টের জন্য একটি পাসওয়ার্ড সেট করুন</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">নতুন পাসওয়ার্ড</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">পাসওয়ার্ড নিশ্চিত করুন</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              সংরক্ষণ করুন
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
