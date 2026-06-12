import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LogOut, Loader2, CloudOff, CheckCircle2, AlertCircle, Cloud, Clock, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { startCloudSync, stopCloudSync, subscribeCloudStatus, getCloudStatus, awaitInitialCloudLoad, useSamiti, DEFAULT_GOALS, DEFAULT_QUOTES, DEFAULT_MESSAGES } from "@/lib/samiti-store";
import { getMyAccountStatus, type AccountStatus } from "@/lib/approval.functions";

export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hydrating, setHydrating] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [acctStatus, setAcctStatus] = useState<AccountStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const fetchStatus = useServerFn(getMyAccountStatus);

  useEffect(() => {
    const beginSync = async (userId: string) => {
      setHydrating(true);
      startCloudSync(userId);
      try { await awaitInitialCloudLoad(); } finally { setHydrating(false); }
    };
    const checkStatus = async () => {
      setCheckingStatus(true);
      try {
        const r = await fetchStatus();
        setAcctStatus(r.status);
      } catch {
        setAcctStatus("pending");
      } finally { setCheckingStatus(false); }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (sess && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        checkStatus().then(() => beginSync(sess.user.id));
      }
      if (event === "SIGNED_OUT") { stopCloudSync(); setAcctStatus(null); }
    });
    supabase.auth.getSession().then(({ data }) => {
      const sess = data.session;
      setSession(sess);
      if (sess) { checkStatus().then(() => beginSync(sess.user.id)); }
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [fetchStatus]);

  if (loading || (session && (hydrating || checkingStatus))) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        {hydrating && <p className="text-sm text-muted-foreground">ক্লাউড থেকে ডেটা লোড হচ্ছে...</p>}
        {checkingStatus && <p className="text-sm text-muted-foreground">অ্যাকাউন্ট যাচাই হচ্ছে...</p>}
      </div>
    );
  }

  if (!session) {
    if (!showLogin) {
      return <IntroSplash onEnter={() => setShowLogin(true)} onSkipIfDisabled={() => setShowLogin(true)} />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">স্বপ্ন কুড়ি বন্ধন সমিতি</CardTitle>
            <CardDescription>লগইন করুন অথবা নতুন অ্যাকাউন্ট তৈরি করুন</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="ghost" size="sm" className="mb-2" onClick={() => setShowLogin(false)}>← পরিচিতি পেজে ফিরে যান</Button>
            <AuthTabs />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (acctStatus && acctStatus !== "active") {
    const pending = acctStatus === "pending";
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              {pending ? <Clock className="h-6 w-6 text-amber-600" /> : <ShieldAlert className="h-6 w-6 text-destructive" />}
            </div>
            <CardTitle>{pending ? "অনুমোদনের অপেক্ষায়" : "অ্যাকাউন্ট নিষ্ক্রিয়"}</CardTitle>
            <CardDescription>
              {pending
                ? "আপনার অ্যাকাউন্টটি সুপার এডমিনের অনুমোদনের অপেক্ষায় রয়েছে। অনুমোদনের পরে লগইন করতে পারবেন।"
                : "আপনার অ্যাকাউন্টে প্রবেশের অনুমতি নেই। অনুগ্রহ করে এডমিনের সাথে যোগাযোগ করুন।"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); }}>
              <LogOut className="mr-2 h-4 w-4" /> লগআউট
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children(session)}</>;
}

function AuthTabs() {
  return (
    <Tabs defaultValue="login" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">লগইন</TabsTrigger>
        <TabsTrigger value="signup">নতুন অ্যাকাউন্ট</TabsTrigger>
      </TabsList>
      <TabsContent value="login" className="mt-4"><LoginForm /></TabsContent>
      <TabsContent value="signup" className="mt-4"><SignupForm /></TabsContent>
    </Tabs>
  );
}

function normalizeIdentifier(raw: string): { email?: string } | null {
  const v = raw.trim();
  if (!v || !v.includes("@")) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return { email: v.toLowerCase() };
}


function LoginForm() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const creds = normalizeIdentifier(identifier);
    if (!creds) { toast.error("সঠিক ইমেইল ঠিকানা দিন"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ ...creds, password } as any);
      if (error) throw error;
      toast.success("সফলভাবে লগইন হয়েছে");
    } catch (err: any) {
      toast.error(err?.message ?? "ত্রুটি");
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>ইমেইল ঠিকানা</Label>
        <Input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com" required />
      </div>
      <div className="space-y-2">
        <Label>পাসওয়ার্ড</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}লগইন
      </Button>
    </form>
  );
}

function SignupForm() {
  const [displayName, setDisplayName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [cpwVisible, setCpwVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { toast.error("নাম দিন"); return; }
    const creds = normalizeIdentifier(identifier);
    if (!creds) { toast.error("সঠিক ইমেইল ঠিকানা দিন"); return; }
    if (password !== confirmPassword) { toast.error("পাসওয়ার্ড মিলছে না"); return; }
    if (password.length < 6) { toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password, displayName: displayName.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "অ্যাকাউন্ট তৈরি ব্যর্থ");
      toast.success("অ্যাকাউন্ট তৈরি হয়েছে। সুপার এডমিনের অনুমোদনের পরে লগইন করতে পারবেন।");
      setDisplayName("");
      setIdentifier("");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message ?? "ত্রুটি");
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>নাম</Label>
        <Input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="আপনার পূর্ণ নাম" required />
      </div>
      <div className="space-y-2">
        <Label>ইমেইল ঠিকানা</Label>
        <Input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com" required />
      </div>
      <div className="space-y-2">
        <Label>পাসওয়ার্ড</Label>
        <div className="relative">
          <Input
            type={pwVisible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            className="pr-10"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setPwVisible((v) => !v)}
            className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
            aria-label={pwVisible ? "লুকান" : "দেখুন"}
          >
            {pwVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <Label>কনফার্ম পাসওয়ার্ড</Label>
        <div className="relative">
          <Input
            type={cpwVisible ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            required
            className="pr-10"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setCpwVisible((v) => !v)}
            className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
            aria-label={cpwVisible ? "লুকান" : "দেখুন"}
          >
            {cpwVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        অ্যাকাউন্ট তৈরি করুন
      </Button>
      <p className="text-xs text-muted-foreground text-center">অ্যাকাউন্ট তৈরির পরে সুপার এডমিন অনুমোদন করলে আপনি লগইন করতে পারবেন।</p>
    </form>
  );
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

export function IntroSplash({ onEnter, onSkipIfDisabled, enterLabel, forceShow }: { onEnter: () => void; onSkipIfDisabled?: () => void; enterLabel?: string; forceShow?: boolean }) {
  const { data } = useSamiti();
  const s = data.settings;
  const enabled = forceShow || s.splashEnabled !== false;
  useEffect(() => {
    if (!forceShow && !enabled && onSkipIfDisabled) onSkipIfDisabled();
  }, [enabled, onSkipIfDisabled, forceShow]);
  if (!enabled) return null;
  const quotes = (s.quotes && s.quotes.length > 0) ? s.quotes : DEFAULT_QUOTES;
  const goals = (s.goals && s.goals.length > 0) ? s.goals : DEFAULT_GOALS;
  const messagesRaw = (s.messages && s.messages.length > 0) ? s.messages : DEFAULT_MESSAGES;
  const messages = messagesRaw.filter((m) => (m.name?.trim() || m.message?.trim()));
  const title = s.splashTitle?.trim() || data.samitiName || "স্বপ্ন কুড়ি বন্ধন সমিতি";
  const subtitle = s.splashSubtitle?.trim() || `স্থাপিত: ${data.establishedDate || "ডিসেম্বর ২০২৫"} · একতাই শক্তি, একতাই বল`;
  const icon = s.splashIcon?.trim() || "🌾";
  const image = s.splashImage?.trim() || "";
  const imageSize = Math.max(48, Math.min(320, s.splashImageSize || 80));
  const footer = s.splashFooter?.trim() || `© ${new Date().getFullYear()} ${title}`;
  const goalsTitle = s.goalsSectionTitle?.trim() || "আমাদের লক্ষ্য ও উদ্দেশ্য";
  const goalsSubtitle = s.goalsSectionSubtitle?.trim() || "সদস্যদের কল্যাণ ও আর্থিক স্বনির্ভরতাই আমাদের মূল লক্ষ্য";
  const quotesTitle = s.quotesSectionTitle?.trim() || "অনুপ্রেরণামূলক বাণী";
  const messagesTitle = s.messagesSectionTitle?.trim() || "প্রতিষ্ঠাতা, সভাপতি ও সাধারণ সম্পাদকের বাণী";
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

        {messages.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl">{messagesTitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {messages.map((m, i) => (
                  <div key={i} className="rounded-lg border bg-card p-4 flex flex-col items-center text-center">
                    {m.photo ? (
                      <img src={m.photo} alt={m.name} className="h-24 w-24 rounded-full object-cover ring-2 ring-emerald-200/60 dark:ring-emerald-900/40" />
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500 to-sky-600 text-white flex items-center justify-center text-3xl">
                        {(m.name?.trim()?.[0]) || "👤"}
                      </div>
                    )}
                    <div className="mt-3 font-semibold text-foreground">{m.name || "—"}</div>
                    <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{m.role}</div>
                    {m.message && (
                      <p className="mt-2 text-sm text-muted-foreground italic">"{m.message}"</p>
                    )}
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
                    <p className="font-serif text-base md:text-lg text-foreground">"{q.bn}"</p>
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
