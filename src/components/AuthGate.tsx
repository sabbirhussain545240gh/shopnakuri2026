import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ALLOWED_EMAIL = "sabbirhussain545240@gmail.com";

export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      const ok = sess?.user?.email?.toLowerCase() === ALLOWED_EMAIL;
      if (sess && !ok) {
        supabase.auth.signOut();
        setSession(null);
        toast.error("এই অ্যাকাউন্টের অ্যাক্সেস নেই");
        return;
      }
      setSession(sess);
    });
    supabase.auth.getSession().then(({ data }) => {
      const sess = data.session;
      const ok = sess?.user?.email?.toLowerCase() === ALLOWED_EMAIL;
      if (sess && !ok) {
        supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(sess);
      }
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const validate = () => {
    let ok = true;
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("ইমেইল লিখুন");
      ok = false;
    } else if (!emailRegex.test(trimmed)) {
      setEmailError("সঠিক ইমেইল ঠিকানা দিন (যেমন: name@example.com)");
      ok = false;
    } else {
      setEmailError(null);
    }
    if (!password) {
      setPasswordError("পাসওয়ার্ড লিখুন");
      ok = false;
    } else if (password.length < 6) {
      setPasswordError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
      ok = false;
    } else {
      setPasswordError(null);
    }
    return ok;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (email.trim().toLowerCase() !== ALLOWED_EMAIL) {
      setEmailError("এই ইমেইলের অ্যাক্সেস নেই");
      toast.error("এই অ্যাকাউন্টের অ্যাক্সেস নেই");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("invalid login") || msg.includes("invalid credentials") || msg.includes("invalid email or password")) {
          setPasswordError("ইমেইল অথবা পাসওয়ার্ড ভুল");
          toast.error("ইমেইল অথবা পাসওয়ার্ড ভুল");
        } else if (msg.includes("email not confirmed")) {
          setEmailError("ইমেইল এখনো নিশ্চিত করা হয়নি");
          toast.error("ইমেইল এখনো নিশ্চিত করা হয়নি");
        } else if (msg.includes("rate") || msg.includes("too many")) {
          toast.error("অনেক বেশি চেষ্টা হয়েছে, কিছুক্ষণ পরে আবার চেষ্টা করুন");
        } else if (msg.includes("network") || msg.includes("fetch")) {
          toast.error("নেটওয়ার্ক সমস্যা, ইন্টারনেট সংযোগ পরীক্ষা করুন");
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success("সফলভাবে লগইন হয়েছে");
    } catch (err: any) {
      toast.error(err?.message ?? "ত্রুটি ঘটেছে");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">সমিতি ম্যানেজমেন্ট</CardTitle>
            <CardDescription>অ্যাকাউন্টে লগইন করুন</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">ইমেইল</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">পাসওয়ার্ড</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                লগইন
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children(session)}</>;
}

export function SignOutButton() {
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await supabase.auth.signOut();
        toast.success("লগআউট হয়েছে");
      }}
    >
      <LogOut className="mr-2 h-4 w-4" />
      লগআউট
    </Button>
  );
}
