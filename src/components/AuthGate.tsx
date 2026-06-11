import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LogOut, Loader2, Cloud, CloudOff, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { startCloudSync, stopCloudSync, subscribeCloudStatus, getCloudStatus, awaitInitialCloudLoad, useSamiti, DEFAULT_GOALS, DEFAULT_QUOTES, DEFAULT_MESSAGES } from "@/lib/samiti-store";

const ALLOWED_EMAIL = "sabbirhussain545240@gmail.com";

export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrating, setHydrating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const beginSync = async (userId: string) => {
      setHydrating(true);
      startCloudSync(userId);
      try { await awaitInitialCloudLoad(); } finally { setHydrating(false); }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      const ok = sess?.user?.email?.toLowerCase() === ALLOWED_EMAIL;
      if (sess && !ok) {
        supabase.auth.signOut();
        setSession(null);
        stopCloudSync();
        toast.error("এই অ্যাকাউন্টের অ্যাক্সেস নেই");
        return;
      }
      setSession(sess);
      if (sess && ok && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        beginSync(sess.user.id);
      }
      if (event === "SIGNED_OUT") {
        stopCloudSync();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      const sess = data.session;
      const ok = sess?.user?.email?.toLowerCase() === ALLOWED_EMAIL;
      if (sess && !ok) {
        supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(sess);
        if (sess && ok) beginSync(sess.user.id);
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

  if (loading || (session && hydrating)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        {hydrating && (
          <p className="text-sm text-muted-foreground">ক্লাউড থেকে ডেটা লোড হচ্ছে...</p>
        )}
      </div>
    );
  }

  if (!session) {
    if (!showLogin) {
      return <IntroSplash onEnter={() => setShowLogin(true)} onSkipIfDisabled={() => setShowLogin(true)} />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">স্বপ্ন কুড়ি বন্ধন সমিতি</CardTitle>
            <CardDescription>অ্যাকাউন্টে লগইন করুন</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="ghost" size="sm" className="mb-2" onClick={() => setShowLogin(false)}>← পরিচিতি পেজে ফিরে যান</Button>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">ইমেইল</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  onBlur={() => {
                    const trimmed = email.trim();
                    if (trimmed && !emailRegex.test(trimmed)) {
                      setEmailError("সঠিক ইমেইল ঠিকানা দিন (যেমন: name@example.com)");
                    }
                  }}
                  placeholder="you@example.com"
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "email-error" : undefined}
                  required
                />
                {emailError && (
                  <p id="email-error" className="text-sm text-destructive">{emailError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">পাসওয়ার্ড</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder="••••••••"
                  minLength={6}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? "password-error" : undefined}
                  required
                />
                {passwordError && (
                  <p id="password-error" className="text-sm text-destructive">{passwordError}</p>
                )}
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

export function CloudStatusBadge() {
  const [status, setStatus] = useState(getCloudStatus());
  useEffect(() => subscribeCloudStatus(() => setStatus(getCloudStatus())), []);
  const map = {
    idle: { icon: CloudOff, text: "অফলাইন", cls: "text-muted-foreground" },
    loading: { icon: Loader2, text: "লোড হচ্ছে...", cls: "text-muted-foreground animate-spin" },
    saving: { icon: Loader2, text: "সেভ হচ্ছে...", cls: "text-blue-600 animate-spin" },
    saved: { icon: CheckCircle2, text: "ক্লাউডে সেভ", cls: "text-green-600" },
    error: { icon: AlertCircle, text: "সেভ ব্যর্থ", cls: "text-destructive" },
  } as const;
  const it = map[status];
  const Icon = it.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <Icon className={`h-3.5 w-3.5 ${it.cls}`} />
      <span className={it.cls.replace("animate-spin", "")}>{it.text}</span>
    </span>
  );
}

function IntroSplash({ onEnter, onSkipIfDisabled }: { onEnter: () => void; onSkipIfDisabled?: () => void }) {
  const { data } = useSamiti();
  const s = data.settings;
  const enabled = s.splashEnabled !== false;
  useEffect(() => {
    if (!enabled && onSkipIfDisabled) onSkipIfDisabled();
  }, [enabled, onSkipIfDisabled]);
  if (!enabled) return null;
  const quotes = (s.quotes && s.quotes.length > 0) ? s.quotes : DEFAULT_QUOTES;
  const goals = (s.goals && s.goals.length > 0) ? s.goals : DEFAULT_GOALS;
  const title = s.splashTitle?.trim() || data.samitiName || "স্বপ্ন কুড়ি বন্ধন সমিতি";
  const subtitle = s.splashSubtitle?.trim() || `স্থাপিত: ${data.establishedDate || "ডিসেম্বর ২০২৫"} · একতাই শক্তি, একতাই বল`;
  const icon = s.splashIcon?.trim() || "🌾";
  const image = s.splashImage?.trim() || "";
  const imageSize = Math.max(48, Math.min(320, s.splashImageSize || 80));
  const footer = s.splashFooter?.trim() || `© ${new Date().getFullYear()} ${title}`;
  const goalsTitle = s.goalsSectionTitle?.trim() || "আমাদের লক্ষ্য ও উদ্দেশ্য";
  const goalsSubtitle = s.goalsSectionSubtitle?.trim() || "সদস্যদের কল্যাণ ও আর্থিক স্বনির্ভরতাই আমাদের মূল লক্ষ্য";
  const quotesTitle = s.quotesSectionTitle?.trim() || "অনুপ্রেরণামূলক বাণী";
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-background to-sky-50 dark:from-emerald-950/30 dark:via-background dark:to-sky-950/30">
      <div className="mx-auto max-w-5xl px-4 py-10 md:py-16">
        <div className="text-center">
          {image ? (
            <img
              src={image}
              alt="logo"
              style={{ height: imageSize, width: imageSize }}
              className="inline-block rounded-full object-cover shadow-lg ring-2 ring-emerald-200/60 dark:ring-emerald-900/40"
            />
          ) : (
            <div
              style={{ height: imageSize, width: imageSize, fontSize: Math.round(imageSize * 0.42) }}
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-sky-600 text-white shadow-lg"
            >
              {icon}
            </div>
          )}
          <h1 className="mt-5 font-serif text-3xl md:text-5xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-3 text-base md:text-lg text-muted-foreground">
            {subtitle}
          </p>
          <div className="mt-6">
            <Button size="lg" onClick={onEnter} className="px-8">
              প্রবেশ করুন →
            </Button>
          </div>
        </div>

        {goals.length > 0 && (
          <Card className="mt-10 border-emerald-200/60 dark:border-emerald-900/40">
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl">{goalsTitle}</CardTitle>
              <CardDescription>{goalsSubtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {goals.map((g, i) => (
                  <div key={i} className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
                    <div className="text-3xl">{g.icon}</div>
                    <div className="mt-2 font-semibold text-foreground">{g.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{g.desc}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {quotes.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl">{quotesTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {quotes.map((q, i) => (
                  <div
                    key={i}
                    className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 p-4"
                  >
                    <p className="font-serif text-base md:text-lg text-foreground">“{q.bn}”</p>
                    {q.en && <p className="mt-1 text-xs text-muted-foreground italic">{q.en}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-10 text-center">
          <Button size="lg" onClick={onEnter} className="px-8">
            লগইন করে প্রবেশ করুন
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            {footer}
          </p>
        </div>
      </div>
    </div>
  );
}
