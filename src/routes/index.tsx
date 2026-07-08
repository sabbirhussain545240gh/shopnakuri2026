import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import {
  useSamiti, toBn, formatTk, memberTotalDeposit, loanPaid, loanTotalDue,
 DEFAULT_GOALS, DEFAULT_QUOTES, DEFAULT_MESSAGES, formatMemberSerial,
 type Member, type Loan, type Deposit, type Goal, type Quote, type Message, type CommitteeMember,
} from "@/lib/samiti-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Users, PiggyBank, HandCoins, LayoutDashboard, Trash2, Plus, CheckCircle2, Pencil, Settings as SettingsIcon, Wallet, Download, Upload, AlertTriangle, TrendingUp, TrendingDown, Menu, Printer, FileText, Receipt, Search, Eye, Share, ImageDown, Check, ChevronsUpDown, ShieldCheck, Loader2, ArrowRight, Banknote, QrCode, RefreshCw, X, Scale, Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { AuthGate, SignOutButton, CloudStatusBadge } from "@/components/AuthGate";
import { makeQrDataUrl } from "@/lib/receipt-qr";
import { buildClosureWithQr, printClosureHtml, closureSrcDoc } from "@/lib/closure-cert";
import { useMyRoles, allowedTabs, roleLabel, roleBadgeClass, canWrite, type TabKey } from "@/lib/permissions";
import { RoleManager } from "@/components/RoleManager";
import { getMyProfile } from "@/lib/roles.functions";
import { NotificationBell } from "@/components/NotificationBell";
import { MemberPortal } from "@/components/MemberPortal";
import { useServerFn } from "@tanstack/react-start";
import { listPendingAccounts } from "@/lib/approval.functions";

function usePendingApprovalCount(isAdmin: boolean) {
  const fetchPending = useServerFn(listPendingAccounts);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isAdmin) { setCount(0); return; }
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetchPending();
        if (!cancelled) setCount((r.profiles ?? []).filter((p: any) => p.status === "pending").length);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isAdmin, fetchPending]);
  return count;
}

function ReceiptQrPreview({ text }: { text: string }) {
  const [src, setSrc] = useState<string>("");
  useEffect(() => {
    let cancel = false;
    makeQrDataUrl(text).then((dataUrl) => { if (!cancel) setSrc(dataUrl); });
    return () => { cancel = true; };
  }, [text]);
  if (!src) return null;
  return (
    <div className="mt-4 p-3 rounded-lg border bg-background flex items-center gap-3">
      <div className="p-2 bg-white rounded-md border shadow-sm">
        <img src={src} alt="QR" className="h-32 w-32 block [image-rendering:pixelated]" />
      </div>
      <div className="text-xs text-muted-foreground leading-relaxed flex-1">
        <div className="text-foreground font-semibold mb-0.5 flex items-center gap-1.5">
          <QrCode className="h-3.5 w-3.5" /> ডিজিটাল রিসিপ্ট
        </div>
        মোবাইল ক্যামেরা দিয়ে স্ক্যান করে রিসিপ্টের তথ্য দেখুন।
      </div>
    </div>
  );
}


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "সমিতি ম্যানেজমেন্ট সিস্টেম" },
      { name: "description", content: "সদস্য, সঞ্চয়/চাদা ও ঋণ ব্যবস্থাপনার জন্য সম্পূর্ণ বাংলা সফটওয়্যার।" },
      { property: "og:title", content: "সমিতি ম্যানেজমেন্ট সিস্টেম" },
      { property: "og:description", content: "সদস্য, সঞ্চয়/চাদা ও ঋণ ব্যবস্থাপনার জন্য সম্পূর্ণ বাংলা সফটওয়্যার।" },
    ],
  }),
  component: GatedApp,
});

function GatedApp() {
  return (
    <AuthGate>
      {() => <RoleRouter />}
    </AuthGate>
  );
}

function RoleRouter() {
  const { roles, loading } = useMyRoles();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const isMemberOnly = roles.length > 0 && roles.every((r) => r === "member");
  if (isMemberOnly) return <MemberPortal />;
  return <SamitiApp />;
}



const today = () => new Date().toISOString().slice(0, 10);
const enMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (s: string) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  const dd = String(d).padStart(2, "0");
  return `${dd} ${enMonths[+m - 1] || m} ${y}`;
};
const bnMonths = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
const toBnDigits = (s: string | number) => String(s).replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);
const fmtMonthYearBn = (s: string) => {
  if (!s) return "";
  const [y, m] = s.split("-");
  return `${bnMonths[+m - 1] || m} ${toBnDigits(y)}`;
};
function buildQrText(fields: { memberName: string; memberSerial?: number; loanNo?: number; date: string; amount: number }) {
  const lines: string[] = [`সদস্য: ${fields.memberName}`];
  if (fields.memberSerial) lines.push(`সদস্য নং: ${toBn(fields.memberSerial)}`);
  if (fields.loanNo) lines.push(`ঋণ নং: ${toBn(fields.loanNo)}`);
  const [y, m, d] = fields.date.split("-");
  if (y && m && d) lines.push(`জমার তারিখ: ${toBn(d)} ${bnMonths[+m - 1] || m} ${toBn(y)}`);
  lines.push(`জমার পরিমাণ: ${formatTk(fields.amount)}`);
  return lines.join("\n");
}
const addMonths = (s: string, n: number) => {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, (m - 1) + n, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};
const monthlyInstallment = (amount: number, rate: number, months: number) => {
  if (!months || months <= 0) return 0;
  const interest = (amount * rate * months) / (100 * 12);
  return (amount + interest) / months;
};

// Shared print branding: watermark + header (logo + samiti name) for all reports/documents.
const printBrandCss = `.ps-wm{position:fixed;inset:0;background-repeat:no-repeat;background-position:center;background-size:60% auto;opacity:0.10;pointer-events:none;z-index:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}.ps-content{position:relative;z-index:1;}.ps-hdr{display:flex;align-items:center;justify-content:center;gap:14px;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:6px;}.ps-hdr img{height:72px;width:72px;object-fit:contain;border-radius:6px;flex-shrink:0;}.ps-hdr .ps-info{text-align:center;}.ps-hdr .ps-name{margin:0;font-size:22px;font-weight:700;}.ps-hdr .ps-addr{font-size:12px;color:#444;margin-top:2px;}.ps-hdr .ps-est{font-size:11px;color:#666;margin-top:2px;}.ps-sub{font-size:14px;font-weight:600;color:#222;text-align:center;margin:8px 0 12px;padding:4px 8px;border-bottom:1px dashed #999;}`;
const printWatermark = (logo?: string) => logo ? `<div class="ps-wm" style="background-image:url('${logo}')"></div>` : "";
const printHeader = (samitiName?: string, logo?: string, subtitle?: string, address?: string, established?: string) => `<div class="ps-hdr">${logo ? `<img src="${logo}" alt="logo" crossorigin="anonymous" />` : ""}<div class="ps-info"><div class="ps-name">${samitiName || "সমিতি"}</div>${address ? `<div class="ps-addr">📍 ${address}</div>` : ""}${established ? `<div class="ps-est">স্থাপিত: ${established}</div>` : ""}</div></div>${subtitle ? `<div class="ps-sub">${subtitle}</div>` : ""}`;


const navItems = [
  { value: "dashboard", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
  { value: "members", label: "সদস্য", icon: Users },
  { value: "savings", label: "সঞ্চয়/চাদা", icon: PiggyBank },
  { value: "loans", label: "ঋণ", icon: HandCoins },
  { value: "installments", label: "কিস্তি আদায়", icon: Receipt },
  { value: "receipts", label: "কিস্তি রিসিপ্ট ইতিহাস", icon: FileText },
  { value: "deposits", label: "চাঁদা জমা ইতিহাস", icon: PiggyBank },
  { value: "cashbook", label: "আয়-ব্যয়", icon: Wallet },
  { value: "reports", label: "রিপোর্ট", icon: FileText },
  { value: "reconciliation", label: "এমাউন্ট সমন্নয়", icon: Scale },
  { value: "settings", label: "সেটিংস", icon: SettingsIcon },
  { value: "admin", label: "সুপার এডমিন", icon: ShieldCheck },
];

function SidebarUserInfo() {
  const fetchProfile = useServerFn(getMyProfile);
  const [profile, setProfile] = useState<{ displayName: string | null; memberRef: string | null; memberSerial: number | null } | null>(null);
  useEffect(() => {
    let alive = true;
    fetchProfile().then((r) => { if (alive) setProfile(r); }).catch(() => {});
    return () => { alive = false; };
  }, [fetchProfile]);
  if (!profile || (!profile.displayName && !profile.memberSerial)) return null;
  return (
    <div className="text-center space-y-0.5">
      {profile.displayName && (
        <div className="text-sm font-medium text-foreground truncate">{profile.displayName}</div>
      )}
      {profile.memberSerial && (
        <div className="text-xs text-muted-foreground">সদস্য নং {toBn(profile.memberSerial)}</div>
      )}
    </div>
  );
}

function SamitiApp() {
  const s = useSamiti();
  const { data } = s;
  const { roles, loading: rolesLoading } = useMyRoles();
  const allowed = useMemo<TabKey[]>(() => allowedTabs(roles) as TabKey[], [roles]);
  const visibleNav = useMemo(
    () => navItems.filter((n) => allowed.includes(n.value as TabKey)),
    [allowed],
  );
  const [tab, setTab] = useState("dashboard");
  useEffect(() => {
    if (!rolesLoading && !allowed.includes(tab as TabKey)) {
      setTab(allowed[0] ?? "dashboard");
    }
  }, [allowed, rolesLoading, tab]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = roles.includes("admin");
  const pendingApprovals = usePendingApprovalCount(isAdmin);
  

  const totals = useMemo(() => {
    const totalDeposit = data.deposits.reduce((a, d) => a + d.amount, 0);
    const totalLoanGiven = data.loans.reduce((a, l) => a + l.amount, 0);
    const totalRepaid = data.payments.reduce((a, p) => a + p.amount, 0);
    const activeLoans = data.loans.filter((l) => l.status === "active").length;
    const outstanding = data.loans
      .filter((l) => l.status === "active")
      .reduce((a, l) => a + (loanTotalDue(l) - loanPaid(data.payments, l.id)), 0);
    const totalIncome = data.transactions.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
    const totalExpense = data.transactions.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
    const cashInHand = totalDeposit - totalLoanGiven + totalRepaid + totalIncome - totalExpense;
    const totalLoanIncome = data.loans.reduce((a, l) => a + (loanTotalDue(l) - l.amount), 0);
    const closedLoanIncome = data.loans.filter((l) => l.status === "closed").reduce((a, l) => a + (loanTotalDue(l) - l.amount), 0);
    return { totalDeposit, totalLoanGiven, totalRepaid, activeLoans, outstanding, totalIncome, totalExpense, cashInHand, totalLoanIncome, closedLoanIncome };
  }, [data]);

  return (
    <div className="min-h-screen flex">
      

      {/* Desktop Sidebar */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col sticky top-0 h-screen">
        <div className="p-4 border-b flex items-center gap-3">
          {data.samitiLogo ? (
            <img src={data.samitiLogo} alt="logo" className="h-10 w-10 rounded-xl object-cover ring-1 ring-border shadow-sm shrink-0 bg-white" />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-400 to-amber-400 text-white flex items-center justify-center font-display font-bold text-xl shadow-sm shrink-0">স</div>
          )}
          <div className="min-w-0">
            <h1 className="text-base font-bold text-foreground leading-tight truncate">{data.samitiName}</h1>
            <p className="text-xs text-muted-foreground">সমিতি ম্যানেজমেন্ট</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = tab === item.value;
            return (
              <button
                key={item.value}
                onClick={() => setTab(item.value)}
                className={cn(
                  "flex items-center w-full gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.value === "admin" && pendingApprovals > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                    {pendingApprovals}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t space-y-2">
          {roles.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {roles.map((r) => (
                <Badge key={r} variant="outline" className={`text-[11px] px-1.5 py-0.5 ${roleBadgeClass(r)}`}>
                  {roleLabel(r)}
                </Badge>
              ))}
            </div>
          )}
          <SidebarUserInfo />
          <div className="flex items-center justify-center gap-2"><CloudStatusBadge /><NotificationBell /></div>
          <SignOutButton />

        </div>


      </aside>



      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden border-b bg-card/70 backdrop-blur sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {data.samitiLogo ? (
              <img src={data.samitiLogo} alt="logo" className="h-9 w-9 rounded-lg object-cover ring-1 ring-border bg-white shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-500 via-teal-400 to-amber-400 text-white flex items-center justify-center font-display font-bold text-lg shadow-sm shrink-0">স</div>
            )}
            <h1 className="font-bold text-foreground truncate">{data.samitiName}</h1>
          </div>

          <div className="flex items-center gap-2">
            <CloudStatusBadge />
            <NotificationBell />
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen((o) => !o)} className="relative">
              <Menu className="h-5 w-5" />
              {pendingApprovals > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                  {pendingApprovals}
                </span>
              )}
            </Button>
          </div>

        </header>
        {mobileOpen && (
          <div className="md:hidden border-b bg-card p-3 space-y-1">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = tab === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => { setTab(item.value); setMobileOpen(false); }}
                  className={cn(
                    "flex items-center w-full gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.value === "admin" && pendingApprovals > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                      {pendingApprovals}
                    </span>
                  )}
                </button>
              );
            })}
            {roles.length > 0 && (
              <div className="pt-2 flex flex-wrap justify-center gap-1">
                {roles.map((r) => (
                  <Badge key={r} variant="outline" className={`text-[11px] px-1.5 py-0.5 ${roleBadgeClass(r)}`}>
                    {roleLabel(r)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}


        <main className="flex-1 container mx-auto px-4 py-6">
          {tab === "dashboard" && <Dashboard totals={totals} memberCount={data.members.length} data={data} onNavigate={setTab} />}
          {tab === "members" && <MembersTab />}
          {tab === "savings" && <SavingsTab />}
          {tab === "loans" && <LoansTab />}
          {tab === "installments" && <InstallmentsTab />}
          {tab === "receipts" && <ReceiptsHistoryTab />}
          {tab === "deposits" && <DepositsHistoryTab />}
          {tab === "cashbook" && <CashbookTab />}
          {tab === "reports" && <ReportsTab />}
          {tab === "reconciliation" && <ReconciliationTab />}
          {tab === "settings" && <SettingsTab />}
          {tab === "admin" && <AdminTab />}
        </main>

        <footer className="container mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
          তথ্য আপনার ব্রাউজারে সুরক্ষিতভাবে সংরক্ষিত থাকে।
        </footer>
      </div>
    </div>
  );
}

function EditSamitiName({ name, onSave }: { name: string; onSave: (n: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(name);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setVal(name); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm"><Pencil className="h-4 w-4 mr-1" />নাম পরিবর্তন</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>সমিতির নাম</DialogTitle></DialogHeader>
        <Input value={val} onChange={(e) => setVal(e.target.value)} />
        <DialogFooter>
          <Button onClick={() => { onSave(val.trim() || "আমাদের সমিতি"); setOpen(false); toast.success("সংরক্ষিত হয়েছে"); }}>সংরক্ষণ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, accent, icon: Icon, hint, rightHint, delay = 0 }: { label: string; value: string; accent?: string; icon?: any; hint?: string; rightHint?: string; delay?: number }) {
  return (
    <Card
      className="overflow-hidden relative group transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${delay}ms`, animationDuration: "500ms", animationFillMode: "both" }}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${accent ?? "bg-primary"} transition-all duration-300 group-hover:h-1.5`} />
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          {Icon && (
            <div className={`h-9 w-9 rounded-xl ${accent ?? "bg-primary"} flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
        <p className="text-2xl md:text-3xl font-bold mt-2 text-foreground tracking-tight tabular-nums">{value}</p>
        {(hint || rightHint) && (
          <div className="flex items-center justify-between gap-2 mt-1">
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            {rightHint && <p className="text-xs font-medium text-success">{rightHint}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Dashboard({ totals, memberCount, data, onNavigate }: any) {
  const { roles } = useMyRoles();
  const writeAllowed = canWrite(roles);
  const recentDeposits = [...data.deposits].sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 5);
  const recentPayments = [...data.payments].sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 5);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const memberById = new Map(data.members.map((m: Member) => [m.id, m]));
  const loanById = new Map(data.loans.map((l: Loan) => [l.id, l]));
  const activeLoanCount = data.loans.filter((l: Loan) => l.status === "active").length;
  const closedLoanCount = data.loans.filter((l: Loan) => l.status === "closed").length;
  const netSurplus = totals.cashInHand;

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-xl animate-in fade-in slide-in-from-top-2 duration-500 relative">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <CardContent className="p-5 sm:p-6 md:p-8 relative">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-6">
            {data.samitiLogo ? (
              <img
                src={data.samitiLogo}
                alt="logo"
                className="h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-2xl object-cover ring-2 ring-white/30 bg-white shrink-0 shadow-md transition-transform duration-500 hover:scale-105"
              />
            ) : (
              <div className="h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-2xl bg-white/15 ring-2 ring-white/30 grid place-items-center font-display font-bold text-2xl sm:text-3xl shrink-0">
                স
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-primary-foreground/60 font-medium truncate">সমিতি ম্যানেজমেন্ট ড্যাশবোর্ড</p>
              <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mt-1.5 truncate leading-tight drop-shadow-sm">{data.samitiName || "আমাদের সমিতি"}</h1>
              <div className="mt-2 h-px w-16 sm:w-20 bg-gradient-to-r from-white/50 to-transparent rounded-full" />
              {data.samitiAddress && <p className="text-xs sm:text-sm text-primary-foreground/80 mt-2 truncate">📍 {data.samitiAddress}</p>}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] sm:text-xs text-primary-foreground/70">
                {data.establishedDate && <span className="truncate">স্থাপিত: {fmtMonthYearBn(data.establishedDate)}</span>}
                <span className="truncate">আজ: {fmtDate(todayStr)}</span>
              </div>
            </div>
            <div className="col-span-2 md:col-span-1 md:text-right border-t md:border-t-0 md:border-l border-white/20 pt-3 md:pt-0 md:pl-6">
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-primary-foreground/70 font-medium">তহবিলে নগদ</p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mt-1 tabular-nums">{formatTk(netSurplus)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notice marquee */}
      <Card className="border-l-4 border-l-primary bg-secondary/40 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-500" style={{ animationDelay: "80ms", animationFillMode: "both" }}>
        <CardContent className="p-0">
          <div className="flex items-stretch">
            <div className="shrink-0 bg-primary text-primary-foreground px-3 sm:px-4 flex items-center gap-2 text-xs sm:text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              <span>নোটিশ</span>
            </div>
            <div className="relative flex-1 overflow-hidden py-2.5">
              <div className="whitespace-nowrap animate-marquee text-sm sm:text-base text-foreground/90">
                {data.settings.notice?.trim()
                  ? data.settings.notice
                  : `স্বাগতম ${data.samitiName || "আমাদের সমিতি"} ম্যানেজমেন্ট সিস্টেমে — নিয়মিত সঞ্চয় জমা দিন • ঋণের কিস্তি সময়মতো পরিশোধ করুন • যেকোনো জিজ্ঞাসায় কমিটির সাথে যোগাযোগ করুন • ধন্যবাদ।`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Quick Actions */}
      {writeAllowed && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-2 duration-500" style={{ animationDelay: "120ms", animationFillMode: "both" }}>
          <button
            onClick={() => onNavigate?.("savings")}
            className="group relative overflow-hidden rounded-xl border bg-card p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-success/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-success"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-success transition-all duration-300 group-hover:h-1.5" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                  <PiggyBank className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">নতুন জমা</p>
                  <p className="text-xs text-muted-foreground truncate">সঞ্চয়/চাদা জমা করুন</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:text-success group-hover:translate-x-0.5 shrink-0" />
            </div>
          </button>

          <button
            onClick={() => onNavigate?.("installments")}
            className="group relative overflow-hidden rounded-xl border bg-card p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-primary transition-all duration-300 group-hover:h-1.5" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">নতুন কিস্তি</p>
                  <p className="text-xs text-muted-foreground truncate">ঋণের কিস্তি আদায়</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:text-primary group-hover:translate-x-0.5 shrink-0" />
            </div>
          </button>

          <button
            onClick={() => onNavigate?.("loans")}
            className="group relative overflow-hidden rounded-xl border bg-card p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-warning/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-warning transition-all duration-300 group-hover:h-1.5" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                  <HandCoins className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">নতুন ঋণ</p>
                  <p className="text-xs text-muted-foreground truncate">সদস্যকে ঋণ দিন</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:text-warning group-hover:translate-x-0.5 shrink-0" />
            </div>
          </button>

          <button
            onClick={() => onNavigate?.("members")}
            className="group relative overflow-hidden rounded-xl border bg-card p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-chart-4/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-chart-4"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-chart-4 transition-all duration-300 group-hover:h-1.5" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-chart-4/10 text-chart-4 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">নতুন সদস্য</p>
                  <p className="text-xs text-muted-foreground truncate">সদস্য নিবন্ধন করুন</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:text-chart-4 group-hover:translate-x-0.5 shrink-0" />
            </div>
          </button>
        </div>
      )}

      {/* Overview */}
      <div>
        <h2 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">সংক্ষিপ্ত পরিসংখ্যান</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard delay={100} label="মোট সদস্য" value={toBn(memberCount)} accent="bg-chart-4" icon={Users} hint="নিবন্ধিত সদস্য" />
          <StatCard delay={160} label="মোট সঞ্চয়/চাদা" value={formatTk(totals.totalDeposit)} accent="bg-success" icon={PiggyBank} hint={`${toBn(data.deposits.length)}টি জমা`} />
          <StatCard delay={220} label="বকেয়া ঋণ" value={formatTk(totals.outstanding)} accent="bg-destructive" icon={AlertTriangle} hint={`${toBn(activeLoanCount)}টি চলমান ঋণ`} />
          <StatCard delay={280} label="হাতে নগদ" value={formatTk(totals.cashInHand)} accent="bg-primary" icon={Wallet} hint="বর্তমান তহবিল" />
        </div>
      </div>

      {/* Loans */}
      <div>
        <h2 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">ঋণ কার্যক্রম</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard delay={340} label="মোট ঋণ প্রদান" value={formatTk(totals.totalLoanGiven)} accent="bg-warning" icon={HandCoins} hint={`${toBn(data.loans.length)}টি ঋণ`} rightHint={`${toBn(closedLoanCount)}টি ঋণ শেষ`} />
          <StatCard delay={400} label="মোট ঋণ আদায়" value={formatTk(totals.totalRepaid)} accent="bg-chart-2" icon={Receipt} hint={`${toBn(data.payments.length)}টি কিস্তি`} />
          <StatCard delay={460} label="ঋণ থেকে আয়" value={formatTk(totals.closedLoanIncome)} accent="bg-chart-3" icon={Banknote} hint="শেষ হওয়া ঋণের আয়" />
          <StatCard delay={520} label="অন্যান্য আয়" value={formatTk(totals.totalIncome)} accent="bg-success" icon={TrendingUp} />
          <StatCard delay={580} label="অন্যান্য ব্যয়" value={formatTk(totals.totalExpense)} accent="bg-destructive" icon={TrendingDown} />
        </div>
      </div>



      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: "580ms", animationFillMode: "both" }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><PiggyBank className="h-4 w-4 text-success" />সাম্প্রতিক জমা</CardTitle>
              <CardDescription>সর্বশেষ ৫টি সঞ্চয়/চাদা</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {recentDeposits.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">এখনও কোনও জমা যোগ করা হয়নি।</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>তারিখ</TableHead><TableHead>সদস্য</TableHead><TableHead className="text-right">পরিমাণ</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {recentDeposits.map((d: any) => {
                    const m: any = memberById.get(d.memberId);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm">{fmtDate(d.date)}</TableCell>
                        <TableCell className="font-medium">{m?.name ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold text-success">{formatTk(d.amount)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" />সাম্প্রতিক কিস্তি</CardTitle>
              <CardDescription>সর্বশেষ ৫টি ঋণ আদায়</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">এখনও কোনও কিস্তি আদায় হয়নি।</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>তারিখ</TableHead><TableHead>সদস্য</TableHead><TableHead className="text-right">পরিমাণ</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((p: any) => {
                    const loan: any = loanById.get(p.loanId);
                    const m: any = loan ? memberById.get(loan.memberId) : undefined;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{fmtDate(p.date)}</TableCell>
                        <TableCell className="font-medium">{m?.name ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">{formatTk(p.amount)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Intro page button */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: "640ms", animationFillMode: "both" }}>
        <Link to="/intro" className="block">
          <Card className="overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg border-l-4 border-l-primary bg-gradient-to-r from-primary/5 via-background to-background">
            <CardContent className="p-4 sm:p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Users className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-base font-bold text-foreground">পরিচিতি ও বর্তমান কমিটি</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">সমিতির লক্ষ্য, বাণী ও কমিটি সদস্যদের তথ্য দেখুন</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </Link>
      </div>

    </div>
  );
}



// ===== Members =====
function MembersTab() {
  const { data, addMember, addMembers, updateMember, deleteMember } = useSamiti();
  const [open, setOpen] = useState(false);
  const emptyForm = {
    serial: "",
    category: "",
    name: "", fatherName: "", motherName: "", phone: "",
    birthDate: "", nid: "", address: "", photo: "",
    nominee: { name: "", relation: "", phone: "", nid: "" },
    nomineeCustomRelation: "",
    joinDate: today(),
  };
  const [form, setForm] = useState(emptyForm);
  const [viewMember, setViewMember] = useState<Member | null>(null);
  const [editMember, setEditMember] = useState<Member | null>(null);

  const nextSerial = data.members.length > 0 ? Math.max(...data.members.map((m) => m.serial || 0)) + 1 : 1;
  useEffect(() => {
    if (open) setForm((f) => ({ ...f, serial: String(nextSerial) }));
  }, [open, nextSerial]);

  const onPhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("ছবি ১০ MB এর কম হতে হবে"); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photo: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!form.name.trim()) { toast.error("নাম দিন"); return; }
    const serialNum = form.serial ? parseInt(form.serial, 10) : 0;
    const { nomineeCustomRelation, ...rest } = form;
    const finalRelation = form.nominee.relation === "অন্যান্য" ? nomineeCustomRelation.trim() : form.nominee.relation;
    addMember({ ...rest, serial: serialNum, category: form.category.trim().toUpperCase(), nominee: { ...form.nominee, relation: finalRelation || "" } });
    setForm(emptyForm);
    setOpen(false);
    toast.success("সদস্য যোগ হয়েছে");
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toIsoDate = (v: any): string => {
    if (v == null || v === "") return "";
    if (v instanceof Date) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const s = String(v).trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
      const [y, m, d] = s.split("-");
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m1) {
      let [, d, m, y] = m1;
      if (y.length === 2) y = "20" + y;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return "";
  };

  const pick = (row: any, keys: string[]): string => {
    for (const k of keys) {
      const v = row[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };

  const downloadTemplate = () => {
    const headers = [
      "সিরিয়াল", "নাম", "পিতার নাম", "মাতার নাম", "মোবাইল",
      "জন্ম তারিখ", "NID", "ঠিকানা", "যোগদানের তারিখ",
      "নমিনির নাম", "নমিনির সম্পর্ক", "নমিনির মোবাইল", "নমিনির NID",
    ];
    const sample = [{
      "সিরিয়াল": 1, "নাম": "মোঃ রহিম", "পিতার নাম": "মোঃ করিম", "মাতার নাম": "রহিমা বেগম",
      "মোবাইল": "01700000000", "জন্ম তারিখ": "1990-01-15", "NID": "1234567890",
      "ঠিকানা": "ঢাকা", "যোগদানের তারিখ": today(),
      "নমিনির নাম": "ফাতেমা", "নমিনির সম্পর্ক": "স্ত্রী", "নমিনির মোবাইল": "01800000000", "নমিনির NID": "",
    }];
    const ws = XLSX.utils.json_to_sheet(sample, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, "সদস্য-টেমপ্লেট.xlsx");
  };

  const handleBulkFile = async (file?: File) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
      if (rows.length === 0) { toast.error("ফাইলে কোনও তথ্য নেই"); return; }
      let nextS = data.members.length > 0 ? Math.max(...data.members.map((m) => m.serial || 0)) : 0;
      const batch: Array<Omit<Member, "id">> = [];
      let skipped = 0;
      for (const row of rows) {
        const name = pick(row, ["নাম", "Name", "name"]);
        if (!name) { skipped++; continue; }
        const serialStr = pick(row, ["সিরিয়াল", "সিরিয়াল নম্বর", "Serial", "serial"]);
        let serial: number;
        if (serialStr) { serial = parseInt(serialStr, 10); nextS = Math.max(nextS, serial); }
        else { serial = ++nextS; }
        batch.push({
          serial,
          name,
          fatherName: pick(row, ["পিতার নাম", "Father", "fatherName"]),
          motherName: pick(row, ["মাতার নাম", "Mother", "motherName"]),
          phone: pick(row, ["মোবাইল", "মোবাইল নং", "Phone", "phone"]),
          birthDate: toIsoDate(row["জন্ম তারিখ"] ?? row["Birth Date"] ?? row["birthDate"]),
          nid: pick(row, ["NID", "জন্ম সনদ", "NID/জন্ম সনদ", "nid"]),
          address: pick(row, ["ঠিকানা", "Address", "address"]),
          photo: "",
          joinDate: toIsoDate(row["যোগদানের তারিখ"] ?? row["Join Date"] ?? row["joinDate"]) || today(),
          nominee: {
            name: pick(row, ["নমিনির নাম", "Nominee Name"]),
            relation: pick(row, ["নমিনির সম্পর্ক", "Nominee Relation"]),
            phone: pick(row, ["নমিনির মোবাইল", "Nominee Phone"]),
            nid: pick(row, ["নমিনির NID", "Nominee NID"]),
          },
        });
      }
      const added = addMembers(batch);
      toast.success(`${toBn(added)} জন সদস্য যোগ হয়েছে${skipped ? ` (${toBn(skipped)} টি বাদ)` : ""}`);
    } catch (e) {
      console.error(e);
      toast.error("ফাইল পড়তে সমস্যা হয়েছে");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const printList = () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const rows = data.members.map((m) => {
      const totalDeposit = memberTotalDeposit(data.deposits, m.id);
      return `
        <tr>
          <td style="border:1px solid #ccc;padding:8px;text-align:center;">${toBn(m.serial || 0)}</td>
          <td style="border:1px solid #ccc;padding:8px;">${m.name}</td>
          <td style="border:1px solid #ccc;padding:8px;">${m.phone ? toBn(m.phone) : "—"}</td>
          <td style="border:1px solid #ccc;padding:8px;">${m.nid ? toBn(m.nid) : "—"}</td>
          <td style="border:1px solid #ccc;padding:8px;">${fmtDate(m.joinDate)}</td>
          <td style="border:1px solid #ccc;padding:8px;text-align:right;">${formatTk(totalDeposit)}</td>
        </tr>`;
    }).join("");
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>সদস্য তালিকা - ${data.samitiName}</title>
<style>
  body { font-family: "Segoe UI", "Noto Sans Bengali", sans-serif; margin: 0; padding: 24px; background: #fff; color: #111; position: relative; }
  p { margin: 0 0 16px; font-size: 14px; color: #555; text-align: center; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; background: transparent; }
  thead tr, tbody tr, td { background: transparent !important; }
  th { background: rgba(243,244,246,0.35); border: 1px solid #ccc; padding: 10px; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  th:nth-child(1), th:nth-child(6) { text-align: center; }
  @media print { body { padding: 0 12px; } .no-print { display: none; } }
  ${printBrandCss}
</style></head>
<body>
  ${printWatermark(data.samitiLogo)}
  <div class="ps-content">
  <div class="no-print" style="margin-bottom:16px;">
    <button onclick="window.print()" style="padding:8px 16px;font-size:14px;cursor:pointer;">প্রিন্ট করুন</button>
  </div>
  ${printHeader(data.samitiName, data.samitiLogo, "সদস্য তালিকা", data.samitiAddress, data.establishedDate)}
  <p>মোট ${toBn(data.members.length)} জন</p>
  <table>
    <thead><tr>
      <th>সি.নং</th><th>নাম</th><th>মোবাইল</th><th>NID/জন্ম সনদ</th><th>যোগদান</th><th style="text-align:right;">মোট সঞ্চয়/চাদা</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </div>
  <script>setTimeout(()=>window.print(),300)</script>
</body></html>`);
    w.document.close();
  };

  const downloadListExcel = () => {
    const rows = data.members.map((m) => ({
      "সি.নং": m.serial || 0,
      "নাম": m.name,
      "পিতার নাম": m.fatherName,
      "মাতার নাম": m.motherName,
      "মোবাইল": m.phone,
      "NID/জন্ম সনদ": m.nid,
      "ঠিকানা": m.address,
      "যোগদানের তারিখ": m.joinDate,
      "জন্ম তারিখ": m.birthDate,
      "নমিনির নাম": m.nominee?.name || "",
      "নমিনির সম্পর্ক": m.nominee?.relation || "",
      "নমিনির মোবাইল": m.nominee?.phone || "",
      "নমিনির NID": m.nominee?.nid || "",
      "মোট সঞ্চয়/চাদা": memberTotalDeposit(data.deposits, m.id),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "সদস্য তালিকা");
    XLSX.writeFile(wb, "সদস্য-তালিকা.xlsx");
  };

  const downloadListPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    pdf.setFontSize(16);
    pdf.text(data.samitiName || "সমিতি", 40, 30);
    pdf.setFontSize(12);
    pdf.text(`সদস্য তালিকা — মোট ${toBn(data.members.length)} জন`, 40, 50);
    autoTable(pdf, {
      startY: 65,
      head: [["সি.নং", "নাম", "মোবাইল", "NID/জন্ম সনদ", "যোগদান", "মোট সঞ্চয়/চাদা"]],
      body: data.members.map((m) => [
        toBn(m.serial || 0),
        m.name,
        m.phone ? toBn(m.phone) : "—",
        m.nid ? toBn(m.nid) : "—",
        fmtDate(m.joinDate),
        formatTk(memberTotalDeposit(data.deposits, m.id)).replace("৳ ", ""),
      ]),
      styles: { font: "helvetica", fontSize: 10 },
      headStyles: { fillColor: [52, 73, 94], textColor: 255 },
    });
    pdf.save("সদস্য-তালিকা.pdf");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle>সদস্য তালিকা</CardTitle>
          <CardDescription>মোট {toBn(data.members.length)} জন সদস্য</CardDescription>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {data.members.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={printList}>
                <Printer className="h-4 w-4 mr-1" />প্রিন্ট
              </Button>
              <Button variant="outline" size="sm" onClick={downloadListExcel}>
                <Download className="h-4 w-4 mr-1" />Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadListPdf().catch(() => toast.error("PDF তৈরিতে সমস্যা"))}>
                <FileText className="h-4 w-4 mr-1" />PDF
              </Button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => handleBulkFile(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" />টেমপ্লেট
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />Excel আপলোড
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(emptyForm); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />নতুন সদস্য</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>নতুন সদস্য যোগ করুন</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {/* Photo */}
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 rounded-lg border bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {form.photo ? <img src={form.photo} alt="" className="h-full w-full object-cover" /> : <Users className="h-8 w-8 text-muted-foreground" />}
                </div>
                <div className="space-y-2">
                  <Label>সদস্যের ছবি</Label>
                  <Input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} />
                  {form.photo && <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, photo: "" })}>ছবি সরান</Button>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>সিরিয়াল নম্বর</Label><Input type="number" value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} /></div>
                <div><Label>ক্যাটাগরি (A, B, C…)</Label><Input list="member-categories-add" maxLength={3} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value.toUpperCase() })} placeholder="যেমন: A" /><datalist id="member-categories-add">{Array.from(new Set(data.members.map((m) => (m.category || "").trim()).filter(Boolean))).sort().map((c) => (<option key={c} value={c} />))}</datalist></div>

                <div><Label>নাম *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>মোবাইল নং</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>পিতার নাম</Label><Input value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} /></div>
                <div><Label>মাতার নাম</Label><Input value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} /></div>
                <div><Label>জন্ম তারিখ</Label><Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></div>
                <div><Label>NID / জন্ম সনদ নং</Label><Input value={form.nid} onChange={(e) => setForm({ ...form, nid: e.target.value })} /></div>
              </div>
              <div><Label>ঠিকানা</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>যোগদানের তারিখ</Label><Input type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} /></div>

              <div className="border-t pt-3">
                <h4 className="font-semibold mb-2 text-foreground">নমিনি তথ্য</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><Label>নমিনির নাম</Label><Input value={form.nominee.name} onChange={(e) => setForm({ ...form, nominee: { ...form.nominee, name: e.target.value } })} /></div>
                  <div>
                    <Label>সম্পর্ক</Label>
                    <Select value={form.nominee.relation} onValueChange={(v) => setForm({ ...form, nominee: { ...form.nominee, relation: v } })}>
                      <SelectTrigger><SelectValue placeholder="সম্পর্ক নির্বাচন করুন" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="বাবা">বাবা</SelectItem>
                        <SelectItem value="মা">মা</SelectItem>
                        <SelectItem value="ভাই">ভাই</SelectItem>
                        <SelectItem value="বোন">বোন</SelectItem>
                        <SelectItem value="স্বামী">স্বামী</SelectItem>
                        <SelectItem value="স্ত্রী">স্ত্রী</SelectItem>
                        <SelectItem value="পুত্র">পুত্র</SelectItem>
                        <SelectItem value="কন্যা">কন্যা</SelectItem>
                        <SelectItem value="অন্যান্য">অন্যান্য</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.nominee.relation === "অন্যান্য" && (
                    <div><Label>কাস্টম সম্পর্ক</Label><Input value={form.nomineeCustomRelation} onChange={(e) => setForm({ ...form, nomineeCustomRelation: e.target.value })} placeholder="সম্পর্ক লিখুন" /></div>
                  )}
                  <div><Label>মোবাইল</Label><Input value={form.nominee.phone} onChange={(e) => setForm({ ...form, nominee: { ...form.nominee, phone: e.target.value } })} /></div>
                  <div><Label>NID / জন্ম সনদ</Label><Input value={form.nominee.nid} onChange={(e) => setForm({ ...form, nominee: { ...form.nominee, nid: e.target.value } })} /></div>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={submit}>সংরক্ষণ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {data.members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">এখনও কোনও সদস্য যোগ করা হয়নি।</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">সি.নং</TableHead>
                <TableHead>ছবি</TableHead>
                <TableHead>নাম</TableHead><TableHead>মোবাইল</TableHead>
                <TableHead>NID/জন্ম সনদ</TableHead><TableHead>যোগদান</TableHead>
                <TableHead className="text-right">মোট সঞ্চয়/চাদা</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.map((m) => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => setViewMember(m)}>
                  <TableCell className="text-center font-semibold">{toBn(formatMemberSerial(m, data.serialPrefix))}</TableCell>
                  <TableCell>
                    <div className="h-10 w-10 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                      {m.photo ? <img src={m.photo} alt={m.name} className="h-full w-full object-cover" /> : <Users className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.phone ? toBn(m.phone) : "—"}</TableCell>
                  <TableCell>{m.nid ? toBn(m.nid) : "—"}</TableCell>
                  <TableCell>{fmtDate(m.joinDate)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatTk(memberTotalDeposit(data.deposits, m.id))}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("সদস্য এবং সংশ্লিষ্ট তথ্য মুছবেন?")) { deleteMember(m.id); toast.success("মুছে ফেলা হয়েছে"); } }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!viewMember} onOpenChange={(o) => !o && setViewMember(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <DialogTitle>সদস্যের তথ্য</DialogTitle>
            {viewMember && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditMember(viewMember)}>
                  <Pencil className="h-4 w-4 mr-1" />সম্পাদনা
                </Button>
                <Button variant="outline" size="sm" onClick={() => printMemberCard(viewMember, data)}>
                  <Printer className="h-4 w-4 mr-1" />প্রিন্ট
                </Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  try { toast.loading("PDF তৈরি হচ্ছে...", { id: "mpdf" }); await exportMemberCardPdf(viewMember, data); toast.success("PDF ডাউনলোড হয়েছে", { id: "mpdf" }); }
                  catch (e) { toast.error("PDF তৈরিতে সমস্যা হয়েছে", { id: "mpdf" }); console.error(e); }
                }}>
                  <FileText className="h-4 w-4 mr-1" />PDF
                </Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  try { toast.loading("ছবি তৈরি হচ্ছে...", { id: "mjpg" }); await exportMemberCardJpeg(viewMember, data); toast.success("JPEG ডাউনলোড হয়েছে", { id: "mjpg" }); }
                  catch (e) { toast.error("ছবি তৈরিতে সমস্যা হয়েছে", { id: "mjpg" }); console.error(e); }
                }}>
                  <Download className="h-4 w-4 mr-1" />JPEG
                </Button>
              </div>
            )}
          </DialogHeader>
          {viewMember && (
            <div className="space-y-4 relative">
              {data.samitiLogo && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-center bg-no-repeat opacity-10 z-0"
                  style={{ backgroundImage: `url(${data.samitiLogo})`, backgroundSize: "70% auto" }}
                />
              )}
              <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-24 w-24 rounded-lg bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {viewMember.photo ? <img src={viewMember.photo} alt={viewMember.name} className="h-full w-full object-cover" /> : <Users className="h-8 w-8 text-muted-foreground" />}
                </div>
                <div>
                  <h3 className="text-xl font-bold">{viewMember.name}</h3>
                  <p className="text-sm text-muted-foreground">যোগদান: {fmtDate(viewMember.joinDate)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="সিরিয়াল নম্বর" value={toBn(formatMemberSerial(viewMember, data.serialPrefix))} />
                <Info label="পিতার নাম" value={viewMember.fatherName} />
                <Info label="মাতার নাম" value={viewMember.motherName} />
                <Info label="মোবাইল" value={viewMember.phone ? toBn(viewMember.phone) : ""} />
                <Info label="জন্ম তারিখ" value={viewMember.birthDate ? fmtDate(viewMember.birthDate) : ""} />
                <Info label="NID / জন্ম সনদ" value={viewMember.nid ? toBn(viewMember.nid) : ""} />
                <Info label="ঠিকানা" value={viewMember.address} className="col-span-2" />
              </div>
              <div className="border-t pt-3">
                <h4 className="font-semibold mb-2">নমিনি তথ্য</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="নাম" value={viewMember.nominee?.name} />
                  <Info label="সম্পর্ক" value={viewMember.nominee?.relation} />
                  <Info label="মোবাইল" value={viewMember.nominee?.phone ? toBn(viewMember.nominee.phone) : ""} />
                  <Info label="NID / জন্ম সনদ" value={viewMember.nominee?.nid ? toBn(viewMember.nominee.nid) : ""} />
                </div>
              </div>
              {(() => {
                const memberDeposits = data.deposits.filter((d) => d.memberId === viewMember.id);
                const totalDeposit = memberDeposits.reduce((s, d) => s + d.amount, 0);
                const memberLoans = data.loans
                  .map((l, idx) => ({ loan: l, no: idx + 1 }))
                  .filter((x) => x.loan.memberId === viewMember.id);
                const totalLoanAmt = memberLoans.reduce((s, x) => s + x.loan.amount, 0);
                const totalDue = memberLoans.reduce((s, x) => s + loanTotalDue(x.loan), 0);
                const totalPaid = memberLoans.reduce((s, x) => s + loanPaid(data.payments, x.loan.id), 0);
                return (
                  <>
                    <div className="border-t pt-3">
                      <h4 className="font-semibold mb-2">আর্থিক সারাংশ</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">মোট জমা</div><div className="font-semibold">{formatTk(totalDeposit)}</div></div>
                        <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">মোট ঋণ</div><div className="font-semibold">{formatTk(totalLoanAmt)}</div></div>
                        <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">মোট পরিশোধিত</div><div className="font-semibold">{formatTk(totalPaid)}</div></div>
                        <div className="rounded-md border p-2"><div className="text-xs text-muted-foreground">মোট বাকি</div><div className="font-semibold">{formatTk(Math.max(0, totalDue - totalPaid))}</div></div>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <h4 className="font-semibold mb-2">জমার ইতিহাস ({toBn(memberDeposits.length)})</h4>
                      {memberDeposits.length === 0 ? (
                        <p className="text-sm text-muted-foreground">কোনো জমা নেই</p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto rounded-md border">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/50 sticky top-0">
                              <tr><th className="text-left p-2">তারিখ</th><th className="text-right p-2">পরিমাণ</th><th className="text-left p-2">নোট</th></tr>
                            </thead>
                            <tbody>
                              {[...memberDeposits].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((d) => (
                                <tr key={d.id} className="border-t"><td className="p-2">{fmtDate(d.date)}</td><td className="p-2 text-right">{formatTk(d.amount)}</td><td className="p-2 text-muted-foreground">{d.note || "—"}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-3">
                      <h4 className="font-semibold mb-2">ঋণ ও কিস্তির ইতিহাস ({toBn(memberLoans.length)})</h4>
                      {memberLoans.length === 0 ? (
                        <p className="text-sm text-muted-foreground">কোনো ঋণ নেই</p>
                      ) : (
                        <div className="space-y-3">
                          {memberLoans.map(({ loan, no }) => {
                            const paid = loanPaid(data.payments, loan.id);
                            const due = loanTotalDue(loan);
                            const remaining = Math.max(0, due - paid);
                            const insts = data.payments.filter((p) => p.loanId === loan.id)
                              .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
                            return (
                              <div key={loan.id} className="rounded-md border p-2">
                                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                                  <div className="font-medium">ঋণ নং {toBn(no)} {loan.status === "closed" && <span className="text-xs text-green-600">(পরিশোধিত)</span>}</div>
                                  <div className="text-xs text-muted-foreground">তারিখ: {fmtDate(loan.date)}</div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-2">
                                  <div><span className="text-muted-foreground">ঋণ:</span> <span className="font-medium">{formatTk(loan.amount)}</span></div>
                                  <div><span className="text-muted-foreground">মোট দেয়:</span> <span className="font-medium">{formatTk(due)}</span></div>
                                  <div><span className="text-muted-foreground">পরিশোধ:</span> <span className="font-medium">{formatTk(paid)}</span></div>
                                  <div><span className="text-muted-foreground">বাকি:</span> <span className="font-medium">{formatTk(remaining)}</span></div>
                                </div>
                                {insts.length > 0 && (
                                  <div className="max-h-40 overflow-y-auto rounded border">
                                    <table className="w-full text-xs">
                                      <thead className="bg-muted/50 sticky top-0">
                                        <tr><th className="text-left p-1.5">#</th><th className="text-left p-1.5">তারিখ</th><th className="text-right p-1.5">কিস্তি</th><th className="text-right p-1.5">বাকি</th></tr>
                                      </thead>
                                      <tbody>
                                        {(() => {
                                          let running = 0;
                                          return insts.map((p, i) => {
                                            running += p.amount;
                                            return (
                                              <tr key={p.id} className="border-t">
                                                <td className="p-1.5">{toBn(i + 1)}</td>
                                                <td className="p-1.5">{fmtDate(p.date)}</td>
                                                <td className="p-1.5 text-right">{formatTk(p.amount)}</td>
                                                <td className="p-1.5 text-right">{formatTk(Math.max(0, due - running))}</td>
                                              </tr>
                                            );
                                          });
                                        })()}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editMember} onOpenChange={(o) => !o && setEditMember(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>সদস্য তথ্য সম্পাদনা</DialogTitle></DialogHeader>
          {editMember && (
            <EditMemberForm
              member={editMember}
              onSave={(updates) => {
                updateMember(editMember.id, updates);
                setEditMember(null);
                setViewMember(null);
                toast.success("সদস্য তথ্য আপডেট হয়েছে");
              }}
              onCancel={() => setEditMember(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const NOMINEE_RELATIONS = ["বাবা", "মা", "ভাই", "বোন", "স্বামী", "স্ত্রী", "পুত্র", "কন্যা"];

function EditMemberForm({ member, onSave, onCancel }: { member: Member; onSave: (u: Partial<Omit<Member, "id">>) => void; onCancel: () => void }) {
  const { data: samitiData } = useSamiti();
  const existingCategories = Array.from(new Set(samitiData.members.map((m) => (m.category || "").trim()).filter(Boolean))).sort();
  const isCustomRelation = member.nominee?.relation && !NOMINEE_RELATIONS.includes(member.nominee.relation);
  const [form, setForm] = useState({
    serial: String(member.serial || ""),
    category: member.category || "",
    name: member.name,
    fatherName: member.fatherName,
    motherName: member.motherName,
    phone: member.phone,
    birthDate: member.birthDate,
    nid: member.nid,
    address: member.address,
    photo: member.photo,
    nominee: { ...member.nominee, relation: isCustomRelation ? "অন্যান্য" : member.nominee?.relation || "" },
    nomineeCustomRelation: isCustomRelation ? member.nominee.relation : "",
    joinDate: member.joinDate,
  });

  const onPhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("ছবি ১০ MB এর কম হতে হবে"); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photo: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!form.name.trim()) { toast.error("নাম দিন"); return; }
    const serialNum = form.serial ? parseInt(form.serial, 10) : 0;
    const finalRelation = form.nominee.relation === "অন্যান্য" ? form.nomineeCustomRelation.trim() : form.nominee.relation;
    const { nomineeCustomRelation, ...rest } = form;
    onSave({ ...rest, serial: serialNum, category: form.category.trim().toUpperCase(), nominee: { ...form.nominee, relation: finalRelation || "" } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 rounded-lg border bg-muted overflow-hidden flex items-center justify-center shrink-0">
          {form.photo ? <img src={form.photo} alt="" className="h-full w-full object-cover" /> : <Users className="h-8 w-8 text-muted-foreground" />}
        </div>
        <div className="space-y-2">
          <Label>সদস্যের ছবি</Label>
          <Input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} />
          {form.photo && <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, photo: "" })}>ছবি সরান</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><Label>সিরিয়াল নম্বর</Label><Input type="number" value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} /></div>
        <div><Label>ক্যাটাগরি (A, B, C…)</Label><Input list="member-categories-edit" maxLength={3} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value.toUpperCase() })} placeholder="যেমন: A" /><datalist id="member-categories-edit">{existingCategories.map((c) => (<option key={c} value={c} />))}</datalist></div>
        <div><Label>নাম *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>মোবাইল নং</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>পিতার নাম</Label><Input value={form.fatherName} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} /></div>
        <div><Label>মাতার নাম</Label><Input value={form.motherName} onChange={(e) => setForm({ ...form, motherName: e.target.value })} /></div>
        <div><Label>জন্ম তারিখ</Label><Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></div>
        <div><Label>NID / জন্ম সনদ নং</Label><Input value={form.nid} onChange={(e) => setForm({ ...form, nid: e.target.value })} /></div>
      </div>
      <div><Label>ঠিকানা</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
      <div><Label>যোগদানের তারিখ</Label><Input type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} /></div>

      <div className="border-t pt-3">
        <h4 className="font-semibold mb-2 text-foreground">নমিনি তথ্য</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>নমিনির নাম</Label><Input value={form.nominee.name} onChange={(e) => setForm({ ...form, nominee: { ...form.nominee, name: e.target.value } })} /></div>
          <div>
            <Label>সম্পর্ক</Label>
            <Select value={form.nominee.relation} onValueChange={(v) => setForm({ ...form, nominee: { ...form.nominee, relation: v } })}>
              <SelectTrigger><SelectValue placeholder="সম্পর্ক নির্বাচন করুন" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="বাবা">বাবা</SelectItem>
                <SelectItem value="মা">মা</SelectItem>
                <SelectItem value="ভাই">ভাই</SelectItem>
                <SelectItem value="বোন">বোন</SelectItem>
                <SelectItem value="স্বামী">স্বামী</SelectItem>
                <SelectItem value="স্ত্রী">স্ত্রী</SelectItem>
                <SelectItem value="পুত্র">পুত্র</SelectItem>
                <SelectItem value="কন্যা">কন্যা</SelectItem>
                <SelectItem value="অন্যান্য">অন্যান্য</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.nominee.relation === "অন্যান্য" && (
            <div><Label>কাস্টম সম্পর্ক</Label><Input value={form.nomineeCustomRelation} onChange={(e) => setForm({ ...form, nomineeCustomRelation: e.target.value })} placeholder="সম্পর্ক লিখুন" /></div>
          )}
          <div><Label>মোবাইল</Label><Input value={form.nominee.phone} onChange={(e) => setForm({ ...form, nominee: { ...form.nominee, phone: e.target.value } })} /></div>
          <div><Label>NID / জন্ম সনদ</Label><Input value={form.nominee.nid} onChange={(e) => setForm({ ...form, nominee: { ...form.nominee, nid: e.target.value } })} /></div>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel}>বাতিল</Button>
        <Button onClick={submit}>সংরক্ষণ</Button>
      </div>
    </div>
  );
}

function Info({ label, value, className }: { label: string; value?: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

import { buildMemberCardHtml, printMemberCard, exportMemberCardJpeg, exportMemberCardPdf, type SamitiInfo } from "@/lib/member-card";


function buildLoanDetailHtml(
  loan: Loan,
  loanNo: number,
  member: Member | undefined,
  guarantor: Member | undefined,
  payments: { id: string; date: string; amount: number }[],
  samiti: SamitiInfo,
) {
  const due = loanTotalDue(loan);
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, due - paid);
  const inst = monthlyInstallment(loan.amount, loan.interestRate, loan.durationMonths);
  const headerHtml = `
    <div style="display:flex;align-items:center;gap:16px;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:16px;">
      ${samiti.samitiLogo ? `<img src="${samiti.samitiLogo}" style="width:90px;height:90px;object-fit:contain;" crossorigin="anonymous" />` : ""}
      <div style="flex:1;text-align:center;">
        <h1 style="margin:0;font-size:26px;">${samiti.samitiName}</h1>
        ${samiti.samitiAddress ? `<div style="font-size:14px;color:#444;margin-top:4px;">${samiti.samitiAddress}</div>` : ""}
        ${samiti.establishedDate ? `<div style="font-size:13px;color:#666;margin-top:4px;">স্থাপিত: ${samiti.establishedDate}</div>` : ""}
      </div>
      ${samiti.samitiLogo ? `<div style="width:90px;"></div>` : ""}
    </div>`;
  const rows: [string, string][] = [
    ["ঋণ নং", toBn(loanNo)],
    ["তারিখ", fmtDate(loan.date)],
    ["সদস্য", member?.name ?? "—"],
    ["মোবাইল", member?.phone ? toBn(member.phone) : "—"],
    ["মূল", formatTk(loan.amount)],
    ["মুনাফার হার", `${toBn(loan.interestRate)}%`],
    ["মেয়াদ", `${toBn(loan.durationMonths)} মাস`],
    ["মাসিক কিস্তি", formatTk(inst)],
    ["১ম কিস্তির তারিখ", fmtDate(addMonths(loan.date, 1))],
    ["ঋণ শেষ", fmtDate(addMonths(loan.date, loan.durationMonths))],
    ["মোট প্রদেয়", formatTk(due)],
    ["পরিশোধ", formatTk(paid)],
    ["বকেয়া", formatTk(remaining)],
    ["অবস্থা", loan.status === "active" ? "চলমান" : "পরিশোধিত"],
  ];
  const guarantorRows: [string, string][] = [["সদস্য জামিনদার", guarantor?.name ?? "—"]];
  if (loan.familyGuarantor) {
    guarantorRows.push(["পারিবারিক জামিনদার", `${loan.familyGuarantor.name} (${loan.familyGuarantor.relation}) — ${loan.familyGuarantor.phone}`]);
  }
  const tableRows = (items: [string, string][]) =>
    items.map(([k, v]) => `<tr><td style="padding:6px 10px;border:1px solid #ddd;background:#fafafa;font-weight:600;width:40%;">${k}</td><td style="padding:6px 10px;border:1px solid #ddd;">${v || "—"}</td></tr>`).join("");
  const paymentRows = payments.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:6px;">
        <thead><tr><th style="text-align:left;padding:6px 10px;border:1px solid #ddd;background:#f0f0f0;">তারিখ</th><th style="text-align:right;padding:6px 10px;border:1px solid #ddd;background:#f0f0f0;">পরিমাণ</th></tr></thead>
        <tbody>${payments.map((p) => `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${fmtDate(p.date)}</td><td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">${formatTk(p.amount)}</td></tr>`).join("")}</tbody>
      </table>`
    : `<div style="color:#666;font-size:13px;">কোনও কিস্তি নেই।</div>`;

  return `
    <div style="max-width:720px;margin:auto;">
      ${headerHtml}
      <div style="border:2px solid #333;padding:18px;border-radius:8px;">
        <h2 style="text-align:center;margin:0 0 14px 0;font-size:18px;border-bottom:2px solid #333;padding-bottom:6px;">ঋণের বিস্তারিত</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${tableRows(rows)}</table>
        <h3 style="font-size:15px;border-bottom:1px solid #ccc;padding-bottom:4px;margin:14px 0 6px;">জামিনদার</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">${tableRows(guarantorRows)}</table>
        <h3 style="font-size:15px;border-bottom:1px solid #ccc;padding-bottom:4px;margin:14px 0 6px;">কিস্তি (${toBn(payments.length)})</h3>
        ${paymentRows}
      </div>
    </div>`;
}

function printLoanDetail(
  loan: Loan,
  loanNo: number,
  member: Member | undefined,
  guarantor: Member | undefined,
  payments: { id: string; date: string; amount: number }[],
  samiti: SamitiInfo,
) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const inner = buildLoanDetailHtml(loan, loanNo, member, guarantor, payments, samiti);
  w.document.write(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8" /><title>ঋণের বিস্তারিত - ${member?.name ?? ""}</title>
    <style>
      body { font-family: "Segoe UI", "Noto Sans Bengali", sans-serif; margin: 0; padding: 24px; background: #fff; color: #111; }
      @media print { body { padding: 0; } .no-print { display: none; } }
    </style></head>
    <body>
      <div class="no-print" style="margin-bottom:16px;display:flex;gap:8px;">
        <button onclick="window.print()" style="padding:8px 16px;font-size:14px;cursor:pointer;">প্রিন্ট করুন</button>
      </div>
      ${inner}
      <script>setTimeout(()=>window.print(),400)</script>
    </body></html>
  `);
  w.document.close();
}

async function exportLoanDetailPdf(
  loan: Loan,
  loanNo: number,
  member: Member | undefined,
  guarantor: Member | undefined,
  payments: { id: string; date: string; amount: number }[],
  samiti: SamitiInfo,
) {
  const { default: html2canvasLib } = await import("html2canvas");
  const inner = buildLoanDetailHtml(loan, loanNo, member, guarantor, payments, samiti);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:780px;height:10px;border:0;";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;background:#ffffff;color:#111111;font-family:"Segoe UI","Noto Sans Bengali",Arial,sans-serif;}
      *{box-sizing:border-box;} h1,h2,h3,p,td,th,div{color:#111111;}
    </style></head><body><div id="r" style="width:740px;padding:20px;background:#fff;">${inner}</div></body></html>`);
    doc.close();
    const target = doc.getElementById("r")!;
    const imgs = Array.from(target.querySelectorAll("img"));
    await Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = () => res(null); })));
    await new Promise((r) => setTimeout(r, 50));
    const canvas = await html2canvasLib(target, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: 780, windowHeight: target.scrollHeight + 40 });
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    if (imgH <= pageH) {
      pdf.addImage(imgData, "JPEG", 0, 0, imgW, imgH);
    } else {
      let position = 0;
      let remaining = imgH;
      while (remaining > 0) {
        pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
        remaining -= pageH;
        if (remaining > 0) { position -= pageH; pdf.addPage(); }
      }
    }
    pdf.save(`loan-${toBn(loanNo)}-${member?.name ?? ""}.pdf`);
  } finally {
    document.body.removeChild(iframe);
  }
}




function PendingCollectRow({
  member,
  month,
  onCollect,
}: {
  member: Member;
  month: string;
  onCollect: (amount: number, date: string, note: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(`${month}-${String(new Date().getDate()).padStart(2, "0")}`);
  return (
    <TableRow>
      <TableCell className="font-medium">{toBn(member.serial || 0)}</TableCell>
      <TableCell>{member.name}</TableCell>
      <TableCell>
        <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="পরিমাণ" className="h-8" />
      </TableCell>
      <TableCell>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8" />
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          onClick={() => {
            const amt = Number(amount);
            if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
            if (date.slice(0, 7) !== month) { toast.error("তারিখটি নির্বাচিত মাসের নয়"); return; }
            onCollect(amt, date, "");
            setAmount("");
          }}
        >চাদা আদায়</Button>
      </TableCell>
    </TableRow>
  );
}

// ===== Savings =====
function SavingsTab() {
  const { data, addDeposit, addDeposits, updateDeposit, deleteDeposit } = useSamiti();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ memberId: "", amount: "", date: today(), note: "" });
  const [search, setSearch] = useState("");
  const [filterMemberId, setFilterMemberId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ memberId: "", amount: "", date: today(), note: "" });
  const [memberOpen, setMemberOpen] = useState(false);
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [receipt, setReceipt] = useState<null | DepositReceiptData>(null);

  const submit = () => {
    if (!form.memberId) { toast.error("সদস্য নির্বাচন করুন"); return; }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    addDeposit({ memberId: form.memberId, amount: amt, date: form.date, note: form.note });
    const mem = data.members.find((x) => x.id === form.memberId);
    const prevTotal = memberTotalDeposit(data.deposits, form.memberId);
    const depositNo = data.deposits.filter((d) => d.memberId === form.memberId).length + 1;
    setReceipt({
      memberName: mem?.name ?? "—",
      memberSerial: mem?.serial,
      amount: amt,
      date: form.date,
      totalAfter: prevTotal + amt,
      receiptNo: `CH-${toBn(mem?.serial ?? 0)}-${toBn(depositNo)}`,
      note: form.note.trim() || undefined,
      logo: data.samitiLogo || undefined,
    });
    setForm({ memberId: "", amount: "", date: today(), note: "" });
    setOpen(false);
    toast.success("জমা যোগ হয়েছে");
  };

  const submitEdit = () => {
    if (!editId) return;
    if (!editForm.memberId) { toast.error("সদস্য নির্বাচন করুন"); return; }
    const amt = Number(editForm.amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    updateDeposit(editId, { memberId: editForm.memberId, amount: amt, date: editForm.date, note: editForm.note });
    setEditId(null);
    toast.success("জমা আপডেট হয়েছে");
  };

  const startEdit = (d: Deposit) => {
    setEditId(d.id);
    setEditForm({ memberId: d.memberId, amount: String(d.amount), date: d.date, note: d.note || "" });
  };

  const selectedMember = data.members.find((m) => m.id === form.memberId);
  const selectedEditMember = data.members.find((m) => m.id === editForm.memberId);

  const replicateFromFirst = () => {
    const sorted = [...data.members].sort((a, b) => (a.serial || 0) - (b.serial || 0));
    const first = sorted[0];
    if (!first) { toast.error("কোনও সদস্য নেই"); return; }
    const firstDeps = data.deposits.filter((d) => d.memberId === first.id);
    if (firstDeps.length === 0) { toast.error(`${toBn(first.serial)} নং সদস্যের কোনও জমা নেই`); return; }
    const others = sorted.filter((m) => m.id !== first.id);
    if (others.length === 0) { toast.error("অন্য কোনও সদস্য নেই"); return; }
    const existing = new Set(data.deposits.map((d) => `${d.memberId}|${d.date}|${d.amount}`));
    const batch: Array<Omit<Deposit, "id">> = [];
    for (const m of others) {
      for (const d of firstDeps) {
        const key = `${m.id}|${d.date}|${d.amount}`;
        if (existing.has(key)) continue;
        batch.push({ memberId: m.id, amount: d.amount, date: d.date, note: d.note });
        existing.add(key);
      }
    }
    if (batch.length === 0) { toast.info("সব সদস্যের জন্য ইতিমধ্যে এন্ট্রি করা আছে"); return; }
    const n = addDeposits(batch);
    toast.success(`${toBn(n)}টি এন্ট্রি যোগ হয়েছে`);
  };

  const filteredDeposits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...data.deposits]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((d) => {
        if (filterMemberId !== "all" && d.memberId !== filterMemberId) return false;
        if (dateFrom && d.date < dateFrom) return false;
        if (dateTo && d.date > dateTo) return false;
        if (monthFilter !== "all" && d.date.slice(0, 7) !== monthFilter) return false;
        if (q) {
          const m = data.members.find((x) => x.id === d.memberId);
          const text = `${m?.serial || ""} ${m?.name || ""} ${d.note || ""} ${d.date}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        return true;
      });
  }, [data.deposits, data.members, search, filterMemberId, dateFrom, dateTo, monthFilter]);

  const depositSeq = useMemo(() => {
    const map = new Map<string, number>();
    const counters = new Map<string, number>();
    [...data.deposits]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1))
      .forEach((d) => {
        const n = (counters.get(d.memberId) ?? 0) + 1;
        counters.set(d.memberId, n);
        map.set(d.id, n);
      });
    return map;
  }, [data.deposits]);

  const receiptNoFor = (d: { id: string; memberId: string }) => {
    const m = data.members.find((x) => x.id === d.memberId);
    return `CH-${toBn(m?.serial ?? 0)}-${toBn(depositSeq.get(d.id) ?? 1)}`;
  };

  const resetFilters = () => {
    setSearch("");
    setFilterMemberId("all");
    setDateFrom("");
    setDateTo("");
    setMonthFilter("all");
  };

  const printDeposits = () => {
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) return;
    const rows = filteredDeposits.map((d, i) => {
      const m = data.members.find((x) => x.id === d.memberId);
      return `<tr>
        <td class="c">${toBn(i + 1)}</td>
        <td class="c">${receiptNoFor(d)}</td>
        <td class="c">${fmtDate(d.date)}</td>
        <td class="c">${toBn(m?.serial || 0)}</td>
        <td>${m?.name || "—"}</td>
        <td>${d.note || ""}</td>
        <td class="r">${formatTk(d.amount)}</td>
      </tr>`;
    }).join("");
    const total = filteredDeposits.reduce((s, d) => s + d.amount, 0);
    const filterParts: string[] = [];
    if (filterMemberId !== "all") {
      const m = data.members.find((x) => x.id === filterMemberId);
      if (m) filterParts.push(`সদস্য: ${toBn(m.serial || 0)}. ${m.name}`);
    }
    if (dateFrom) filterParts.push(`শুরু: ${fmtDate(dateFrom)}`);
    if (dateTo) filterParts.push(`শেষ: ${fmtDate(dateTo)}`);
    if (monthFilter !== "all") filterParts.push(`মাস: ${monthFilter}`);
    if (search.trim()) filterParts.push(`সার্চ: ${search.trim()}`);
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>সঞ্চয়/চাদা তালিকা - ${data.samitiName}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: "Segoe UI", "Noto Sans Bengali", sans-serif; color: #111; margin: 0; padding: 8px 12px; position: relative; }
  .wm { position: fixed; inset: 0; background-repeat: no-repeat; background-position: center; background-size: 60% auto; opacity: 0.10; pointer-events: none; z-index: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .content { position: relative; z-index: 1; }
  .hdr { display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:4px; }
  .hdr img { height:48px; width:48px; object-fit:contain; border-radius:6px; }
  h2 { margin: 0; font-size: 18px; text-align: center; }
  .sub { text-align: center; font-size: 12px; color: #555; margin: 2px 0 4px; }
  .filters { font-size: 11px; color: #444; text-align: center; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #333; padding: 4px 6px; background: transparent; }
  th { background: #e5e7eb; text-align: center; }
  td.c { text-align: center; }
  td.r { text-align: right; }
  tfoot td { font-weight: bold; background: #f3f4f6; }
  @media print { .no-print { display: none; } body { padding: 0; } }
</style></head>
<body>
  ${data.samitiLogo ? `<div class="wm" style="background-image:url('${data.samitiLogo}')"></div>` : ""}
  <div class="content">
  <div class="no-print" style="text-align:right;margin-bottom:6px;">
    <button onclick="window.print()" style="padding:6px 14px;cursor:pointer;">প্রিন্ট করুন</button>
  </div>
  <div class="hdr">
    ${data.samitiLogo ? `<img src="${data.samitiLogo}" alt="logo" />` : ""}
    <h2>${data.samitiName}</h2>
  </div>
  <div class="sub">সঞ্চয়/চাদা / জমা তালিকা</div>
  ${filterParts.length ? `<div class="filters">${filterParts.join(" • ")}</div>` : ""}
  <table>
    <thead><tr>
      <th style="width:5%">ক্রম</th><th style="width:14%">রিসিপ্ট নং</th><th style="width:12%">তারিখ</th><th style="width:7%">সি.নং</th>
      <th style="width:24%">সদস্যের নাম</th><th>মন্তব্য</th><th style="width:14%">পরিমাণ</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="7" class="c">কোনও তথ্য নেই</td></tr>`}</tbody>
    <tfoot><tr><td colspan="6" class="r">মোট (${toBn(filteredDeposits.length)}টি)</td><td class="r">${formatTk(total)}</td></tr></tfoot>
  </table>
  </div>
  <script>setTimeout(()=>window.print(),300)</script>
</body></html>`);
    w.document.close();
  };



  const collectionRows = useMemo(() => {
    const sorted = [...data.members].sort((a, b) => (a.serial || 0) - (b.serial || 0));
    return sorted.map((m) => {
      const activeLoans = data.loans.filter((l) => l.memberId === m.id && l.status !== "closed");
      let inst = 0;
      let due = 0;
      for (const l of activeLoans) {
        inst += monthlyInstallment(l.amount, l.interestRate, l.durationMonths);
        due += loanTotalDue(l) - loanPaid(data.payments, l.id);
      }
      return { m, inst: Math.round(inst), due: Math.round(due), hasLoan: activeLoans.length > 0 };
    });
  }, [data.members, data.loans, data.payments]);

  const printCollectionForm = () => {
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) return;
    const monthLabel = new Date().toLocaleDateString("bn-BD", { year: "numeric", month: "long" });
    const rows = collectionRows.map(({ m, inst, due, hasLoan }) => `
      <tr>
        <td class="c">${toBn(m.serial || 0)}</td>
        <td>${m.name}</td>
        <td class="r"></td>
        <td class="r">${hasLoan ? formatTk(due) : "—"}</td>
        <td class="r">${hasLoan ? formatTk(inst) : "—"}</td>
        <td class="r"></td>
        <td></td>
      </tr>`).join("");
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>কালেকশন ফর্ম - ${data.samitiName}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: "Segoe UI", "Noto Sans Bengali", sans-serif; margin: 0; padding: 8px 12px; color: #111; }
  h2 { margin: 0; font-size: 18px; text-align: center; }
  .sub { text-align: center; font-size: 12px; color: #555; margin: 2px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
  th, td { border: 1px solid #333; padding: 4px 6px; }
  th { background: #e5e7eb; text-align: center; font-size: 12px; }
  td.c { text-align: center; }
  td.r { text-align: right; }
  tbody tr { height: 22px; }
  .foot { display:flex; justify-content: space-between; font-size: 12px; margin-top: 14px; }
  @media print { .no-print { display: none; } body { padding: 0 12px; } }
  ${printBrandCss}
</style></head>
<body>
  ${printWatermark(data.samitiLogo)}
  <div class="ps-content">
  <div class="no-print" style="text-align:right;margin-bottom:6px;">
    <button onclick="window.print()" style="padding:6px 14px;cursor:pointer;">প্রিন্ট করুন</button>
  </div>
  ${printHeader(data.samitiName, data.samitiLogo, `মাসিক চাদা ও ঋণের কিস্তি আদায় ফর্ম — ${monthLabel}`, data.samitiAddress, data.establishedDate)}
  <table>
    <colgroup>
      <col style="width:6%"><col style="width:22%"><col style="width:13%"><col style="width:13%"><col style="width:13%"><col style="width:13%"><col style="width:20%">
    </colgroup>
    <thead><tr>
      <th>সি.নং</th><th>সদস্যের নাম</th><th>মাসিক চাদা</th><th>বকেয়া ঋণ</th><th>মাসিক কিস্তি</th><th>আদায়কৃত কিস্তি</th><th>স্বাক্ষর</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="foot">
    <div>কালেকটরের স্বাক্ষর: ____________________</div>
    <div>সভাপতি/সম্পাদকের স্বাক্ষর: ____________________</div>
  </div>
  </div>
  <script>setTimeout(()=>window.print(),300)</script>
</body></html>`);
    w.document.close();
  };

  const downloadCollectionPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const monthLabel = new Date().toLocaleDateString("bn-BD", { year: "numeric", month: "long" });
    pdf.setFontSize(14);
    pdf.text(data.samitiName || "সমিতি", pageW / 2, 28, { align: "center" });
    pdf.setFontSize(11);
    pdf.text(`Monthly Collection Form — ${monthLabel}`, pageW / 2, 46, { align: "center" });
    autoTable(pdf, {
      startY: 58,
      head: [["Sl", "Name", "Monthly Chada", "Loan Due", "Installment", "Paid", "Signature"]],
      body: collectionRows.map(({ m, inst, due, hasLoan }) => [
        toBn(m.serial || 0),
        m.name,
        "",
        hasLoan ? formatTk(due).replace("৳ ", "") : "—",
        hasLoan ? formatTk(inst).replace("৳ ", "") : "—",
        "",
        "",
      ]),
      styles: { font: "helvetica", fontSize: 9, cellPadding: 3, minCellHeight: 16 },
      headStyles: { fillColor: [52, 73, 94], textColor: 255, halign: "center" },
      columnStyles: {
        0: { halign: "center", cellWidth: 35 },
        1: { cellWidth: 160 },
        2: { halign: "right", cellWidth: 90 },
        3: { halign: "right", cellWidth: 90 },
        4: { halign: "right", cellWidth: 90 },
        5: { halign: "right", cellWidth: 90 },
        6: { cellWidth: 140 },
      },
      margin: { left: 20, right: 20 },
    });
    pdf.save("কালেকশন-ফর্ম.pdf");
  };

  const downloadCollectionExcel = () => {
    const monthLabel = new Date().toLocaleDateString("bn-BD", { year: "numeric", month: "long" });
    const rows = collectionRows.map(({ m, inst, due, hasLoan }) => ({
      "সি.নং": m.serial || 0,
      "সদস্যের নাম": m.name,
      "মাসিক চাদা": "",
      "বকেয়া ঋণ": hasLoan ? due : "—",
      "মাসিক কিস্তি": hasLoan ? inst : "—",
      "আদায়কৃত কিস্তি": "",
      "স্বাক্ষর": "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `কালেকশন ফর্ম ${monthLabel}`);
    XLSX.writeFile(wb, `কালেকশন-ফর্ম-${monthLabel}.xlsx`);
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle>সঞ্চয়/চাদা / জমা</CardTitle>
          <CardDescription>মোট {toBn(data.deposits.length)}টি লেনদেন</CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" disabled={data.deposits.length === 0} onClick={printDeposits}>
            <Printer className="h-4 w-4 mr-1" />প্রিন্ট তালিকা
          </Button>
          <Button variant="outline" size="sm" disabled={data.members.length === 0} onClick={printCollectionForm}>
            <Printer className="h-4 w-4 mr-1" />কালেকশন ফর্ম
          </Button>
          <Button variant="outline" size="sm" disabled={data.members.length === 0} onClick={() => downloadCollectionPdf().catch(() => toast.error("PDF তৈরিতে সমস্যা"))}>
            <FileText className="h-4 w-4 mr-1" />ফর্ম PDF
          </Button>
          <Button variant="outline" size="sm" disabled={data.members.length === 0} onClick={downloadCollectionExcel}>
            <Download className="h-4 w-4 mr-1" />ফর্ম Excel
          </Button>
          <Button variant="outline" disabled={data.members.length < 2} onClick={replicateFromFirst}>
            ১ নং অনুযায়ী সকলের চাঁদা
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button disabled={data.members.length === 0}><Plus className="h-4 w-4 mr-1" />নতুন জমা</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>নতুন জমা</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>সদস্য *</Label>
                  <Popover open={memberOpen} onOpenChange={setMemberOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {selectedMember ? `${toBn(selectedMember.serial || 0)}. ${selectedMember.name}` : "সদস্য নির্বাচন করুন"}
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                        <CommandInput placeholder="ক্রম বা নাম দিয়ে খুঁজুন..." />
                        <CommandList>
                          <CommandEmpty>কোনও সদস্য পাওয়া যায়নি</CommandEmpty>
                          <CommandGroup>
                            {data.members.map((m) => (
                              <CommandItem key={m.id} value={`${toBn(m.serial || 0)} ${m.serial} ${m.name} ${m.phone || ""}`} onSelect={() => { setForm({ ...form, memberId: m.id }); setMemberOpen(false); }}>
                                <Check className={cn("h-4 w-4", form.memberId === m.id ? "opacity-100" : "opacity-0")} />
                                {toBn(m.serial || 0)}. {m.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div><Label>পরিমাণ (টাকা) *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div><Label>তারিখ</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>মন্তব্য</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>সংরক্ষণ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>জমা সম্পাদনা</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>সদস্য *</Label>
                  <Popover open={editMemberOpen} onOpenChange={setEditMemberOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {selectedEditMember ? `${toBn(selectedEditMember.serial || 0)}. ${selectedEditMember.name}` : "সদস্য নির্বাচন করুন"}
                        <ChevronsUpDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                        <CommandInput placeholder="ক্রম বা নাম দিয়ে খুঁজুন..." />
                        <CommandList>
                          <CommandEmpty>কোনও সদস্য পাওয়া যায়নি</CommandEmpty>
                          <CommandGroup>
                            {data.members.map((m) => (
                              <CommandItem key={m.id} value={`${toBn(m.serial || 0)} ${m.serial} ${m.name} ${m.phone || ""}`} onSelect={() => { setEditForm({ ...editForm, memberId: m.id }); setEditMemberOpen(false); }}>
                                <Check className={cn("h-4 w-4", editForm.memberId === m.id ? "opacity-100" : "opacity-0")} />
                                {toBn(m.serial || 0)}. {m.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div><Label>পরিমাণ (টাকা) *</Label><Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} /></div>
                <div><Label>তারিখ</Label><Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></div>
                <div><Label>মন্তব্য</Label><Input value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditId(null)}>বাতিল</Button>
                <Button onClick={submitEdit}>সংরক্ষণ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {data.members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">প্রথমে সদস্য যোগ করুন।</p>
        ) : data.deposits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">কোনও জমা নেই।</p>
        ) : (
          <>
          <div className="flex flex-wrap items-end gap-2 mb-3 p-2 rounded-md border bg-muted/30">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">সদস্য</Label>
              <Select value={filterMemberId} onValueChange={setFilterMemberId}>
                <SelectTrigger className="h-8 w-48 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সকল সদস্য</SelectItem>
                  {[...data.members].sort((a, b) => (a.serial || 0) - (b.serial || 0)).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{toBn(m.serial || 0)}. {m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">শুরুর তারিখ</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-40 text-xs" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">শেষ তারিখ</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-40 text-xs" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">মাস</Label>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সকল মাস</SelectItem>
                  {Array.from(new Set(data.deposits.map((d) => d.date.slice(0, 7))))
                    .sort((a, b) => b.localeCompare(a))
                    .map((ym) => (
                      <SelectItem key={ym} value={ym}>{ym}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8">রিসেট</Button>
            <div className="ml-auto text-xs text-muted-foreground self-center">
              {toBn(filteredDeposits.length)}টি / মোট {formatTk(filteredDeposits.reduce((s, d) => s + d.amount, 0))}
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>রিসিপ্ট নং</TableHead>
                <TableHead>তারিখ</TableHead>
                <TableHead>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="সদস্য সার্চ..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-7 h-7 text-xs w-40"
                    />
                  </div>
                </TableHead>
                <TableHead>মন্তব্য</TableHead>
                <TableHead className="text-right">পরিমাণ</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeposits.map((d) => {
                const m = data.members.find((x) => x.id === d.memberId);
                const q = search.trim().toLowerCase();
                const nameText = m?.name ?? "—";
                let highlightedName: React.ReactNode = nameText;
                if (q && nameText !== "—") {
                  const lower = nameText.toLowerCase();
                  const idx = lower.indexOf(q);
                  if (idx !== -1) {
                    highlightedName = (
                      <>
                        {nameText.slice(0, idx)}
                        <mark className="bg-yellow-200 dark:bg-yellow-700 rounded px-0.5">
                          {nameText.slice(idx, idx + q.length)}
                        </mark>
                        {nameText.slice(idx + q.length)}
                      </>
                    );
                  }
                }
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{receiptNoFor(d)}</TableCell>
                    <TableCell>{fmtDate(d.date)}</TableCell>
                    <TableCell className="font-medium">{toBn(m?.serial || 0)}. {highlightedName}</TableCell>
                    <TableCell className="text-muted-foreground">{d.note || "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-success">{formatTk(d.amount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(d)}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { deleteDeposit(d.id); toast.success("মুছে ফেলা হয়েছে"); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {monthFilter !== "all" && (() => {
            const paidIds = new Set(
              data.deposits.filter((d) => d.date.slice(0, 7) === monthFilter).map((d) => d.memberId),
            );
            const pending = [...data.members]
              .filter((m) => !paidIds.has(m.id))
              .sort((a, b) => (a.serial || 0) - (b.serial || 0));
            if (pending.length === 0) return (
              <div className="mt-4 text-sm text-center text-success">এই মাসে সকল সদস্য জমা দিয়েছেন ✓</div>
            );
            return (
              <div className="mt-6">
                <div className="text-sm font-semibold mb-2 text-destructive">
                  ⚠ জমা হয়নি ({toBn(pending.length)} জন) — {monthFilter}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">ক্র নং</TableHead>
                      <TableHead>নাম</TableHead>
                      <TableHead className="w-40">পরিমাণ (৳)</TableHead>
                      <TableHead className="w-40">তারিখ</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((m) => (
                      <PendingCollectRow
                        key={m.id}
                        member={m}
                        month={monthFilter}
                        onCollect={(amount, date, note) => {
                          addDeposit({ memberId: m.id, amount, date, note });
                          const prevTotal = memberTotalDeposit(data.deposits, m.id);
                          const depositNo = data.deposits.filter((d) => d.memberId === m.id).length + 1;
                          setReceipt({
                            memberName: m.name,
                            memberSerial: m.serial,
                            amount,
                            date,
                            totalAfter: prevTotal + amount,
                            receiptNo: `CH-${toBn(m.serial ?? 0)}-${toBn(depositNo)}`,
                            note: note || undefined,
                            logo: data.samitiLogo || undefined,
                          });
                          toast.success("জমা যোগ হয়েছে");
                        }}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })()}
          </>
        )}
      </CardContent>
    </Card>

    <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>জমা রিসিপ্ট</DialogTitle></DialogHeader>
        {receipt && (
          <div id="deposit-receipt" className="border rounded-md p-4 text-sm bg-card">
            <div className="flex items-center justify-center gap-3 mb-3">
              {receipt.logo && (
                <img src={receipt.logo} alt="logo" className="h-12 w-12 object-contain rounded" />
              )}
              <div className="text-center">
                <div className="text-lg font-bold">{data.samitiName || "সমিতি"}</div>
                <div className="text-xs text-muted-foreground">সঞ্চয়/চাদা জমা রিসিপ্ট</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">রিসিপ্ট নং:</span> <span className="font-medium">{receipt.receiptNo}</span></div>
              <div><span className="text-muted-foreground">তারিখ:</span> <span className="font-medium">{fmtDate(receipt.date)}</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">সদস্য:</span> <span className="font-medium">{receipt.memberSerial ? `${toBn(receipt.memberSerial)}. ` : ""}{receipt.memberName}</span></div>
            </div>
            <div className="mt-3 border-t pt-2 flex justify-between text-base">
              <span className="font-medium">জমার পরিমাণ</span>
              <span className="font-bold text-success">{formatTk(receipt.amount)}</span>
            </div>
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">মোট সঞ্চয় (এই জমা সহ):</span> <span className="font-semibold">{formatTk(receipt.totalAfter)}</span>
            </div>
            {receipt.note && (
              <div className="mt-3 text-sm border-t pt-2">
                <span className="text-muted-foreground">নোট:</span> <span className="font-medium whitespace-pre-wrap">{receipt.note}</span>
              </div>
            )}
            <ReceiptQrPreview text={buildQrText({
              memberName: receipt.memberName, memberSerial: receipt.memberSerial,
              date: receipt.date, amount: receipt.amount,
            })} />
            <div className="mt-6 flex justify-between text-xs text-muted-foreground">
              <div>—————————<br />গ্রহীতা</div>
              <TreasurerSignBlock committee={data.settings.committee} />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setReceipt(null)}>বন্ধ</Button>
          <Button variant="secondary" onClick={async () => {
            if (!receipt) return;
            try {
              toast.loading("ছবি তৈরি হচ্ছে...", { id: "djpg" });
              const canvas = await renderDepositReceiptCanvas(receipt, data.samitiName || "সমিতি", findTreasurer(data.settings.committee));
              const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.95));
              if (!blob) throw new Error("blob");
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `জমা-রিসিপ্ট-${receipt.receiptNo}.jpg`;
              document.body.appendChild(link);
              link.click();
              link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              toast.success("JPEG ডাউনলোড হয়েছে", { id: "djpg" });
            } catch (e) {
              console.error(e);
              toast.error("ডাউনলোড ব্যর্থ হয়েছে", { id: "djpg" });
            }
          }}><ImageDown className="h-4 w-4 mr-1" />JPEG ডাউনলোড</Button>
          <Button variant="secondary" onClick={async () => {
            if (!receipt) return;
            const text = `জমা রিসিপ্ট\nসমিতি: ${data.samitiName || "সমিতি"}\nরিসিপ্ট নং: ${receipt.receiptNo}\nতারিখ: ${fmtDate(receipt.date)}\nসদস্য: ${receipt.memberSerial ? `${toBn(receipt.memberSerial)}. ` : ""}${receipt.memberName}\nজমার পরিমাণ: ${formatTk(receipt.amount)}\nমোট সঞ্চয়: ${formatTk(receipt.totalAfter)}`;
            try {
              toast.loading("শেয়ার প্রস্তুত হচ্ছে...", { id: "dshare" });
              const canvas = await renderDepositReceiptCanvas(receipt, data.samitiName || "সমিতি", findTreasurer(data.settings.committee));
              const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.95));
              toast.dismiss("dshare");
              const file = blob ? new File([blob], `জমা-রিসিপ্ট-${receipt.receiptNo}.jpg`, { type: "image/jpeg" }) : null;
              const nav: any = navigator;
              if (file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
                try { await nav.share({ title: "জমা রিসিপ্ট", text, files: [file] }); return; } catch (e: any) {
                  if (e?.name === "AbortError") return;
                }
              }
              if (nav.share) {
                try { await nav.share({ title: "জমা রিসিপ্ট", text }); return; } catch (e: any) {
                  if (e?.name === "AbortError") return;
                }
              }
              await navigator.clipboard.writeText(text);
              toast.success("রিসিপ্টের তথ্য কপি হয়েছে");
            } catch (e) {
              console.error(e);
              try { await navigator.clipboard.writeText(text); toast.success("রিসিপ্টের তথ্য কপি হয়েছে", { id: "dshare" }); }
              catch { toast.error("শেয়ার ব্যর্থ হয়েছে", { id: "dshare" }); }
            }
          }}><Share className="h-4 w-4 mr-1" />শেয়ার</Button>
          <Button onClick={async () => {
            if (!receipt) return;
            const qrDataUrl = await buildDepositQr(receipt, data.samitiName || "সমিতি");
            const html = buildDepositReceiptHtml(receipt, data.samitiName || "সমিতি", qrDataUrl, findTreasurer(data.settings.committee));
            const w = window.open("", "_blank", "width=600,height=800");
            if (!w) return;
            w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>জমা রিসিপ্ট</title><style>${receiptCss}</style></head><body>${html}<script>setTimeout(()=>window.print(),300)</script></body></html>`);
            w.document.close();
            w.focus();
          }}><Printer className="h-4 w-4 mr-1" />প্রিন্ট</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ===== Loans =====
function LoansTab() {
  const { data, addLoan, updateLoan, addPayment, closeLoan, refreshLoanStatus, deleteLoan } = useSamiti();
  const [open, setOpen] = useState(false);
  const [payFor, setPayFor] = useState<Loan | null>(null);
  const [editFor, setEditFor] = useState<Loan | null>(null);
  const [detailFor, setDetailFor] = useState<Loan | null>(null);
  const [editForm, setEditForm] = useState({ memberId: "", amount: "", interestRate: "", durationMonths: "", date: "" });
  const [form, setForm] = useState({ memberId: "", amount: "", interestRate: String(data.settings.defaultInterestRate), durationMonths: String(data.settings.defaultDurationMonths), date: today(), memberGuarantorId: "", familyGuarantorName: "", familyGuarantorRelation: "", familyGuarantorCustomRelation: "", familyGuarantorPhone: "" });
  const [payForm, setPayForm] = useState({ amount: "", date: today(), note: "" });
  const [receipt, setReceipt] = useState<null | { loan: Loan; memberName: string; memberSerial?: number; amount: number; date: string; paidAfter: number; remainingAfter: number; receiptNo: string; note?: string; logo?: string; loanNo?: number }>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loanSearch, setLoanSearch] = useState("");
  const [loanStatusFilter, setLoanStatusFilter] = useState<"all" | "active" | "closed">("all");
  const [closureView, setClosureView] = useState<string | null>(null);

  const setField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  };

  const submit = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.memberId.trim()) nextErrors.memberId = "সদস্য নির্বাচন করুন";
    const amt = Number(form.amount);
    if (!form.amount.trim() || isNaN(amt) || amt <= 0) nextErrors.amount = "সঠিক পরিমাণ দিন";
    const rate = Number(form.interestRate);
    if (!form.interestRate.trim() || isNaN(rate) || rate <= 0) nextErrors.interestRate = "সঠিক মুনাফার হার দিন";
    if (!form.memberGuarantorId.trim()) nextErrors.memberGuarantorId = "সদস্য জামিনদার নির্বাচন করুন";
    if (!form.familyGuarantorName.trim()) nextErrors.familyGuarantorName = "জামিনদারের নাম দিন";
    if (!form.familyGuarantorRelation.trim()) nextErrors.familyGuarantorRelation = "সম্পর্ক নির্বাচন করুন";
    if (form.familyGuarantorRelation === "অন্যান্য" && !form.familyGuarantorCustomRelation.trim()) nextErrors.familyGuarantorCustomRelation = "কাস্টম সম্পর্ক লিখুন";
    if (!form.familyGuarantorPhone.trim()) nextErrors.familyGuarantorPhone = "মোবাইল নম্বর দিন";

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const relation = form.familyGuarantorRelation === "অন্যান্য" ? form.familyGuarantorCustomRelation.trim() : form.familyGuarantorRelation.trim();

    addLoan({
      memberId: form.memberId, amount: amt,
      interestRate: rate,
      durationMonths: Number(form.durationMonths) || 12,
      date: form.date,
      memberGuarantorId: form.memberGuarantorId,
      familyGuarantor: { name: form.familyGuarantorName.trim(), relation, phone: form.familyGuarantorPhone.trim() },
    });
    setForm({ memberId: "", amount: "", interestRate: String(data.settings.defaultInterestRate), durationMonths: String(data.settings.defaultDurationMonths), date: today(), memberGuarantorId: "", familyGuarantorName: "", familyGuarantorRelation: "", familyGuarantorCustomRelation: "", familyGuarantorPhone: "" });
    setErrors({});
    setOpen(false);
    toast.success("ঋণ প্রদান হয়েছে");
  };

  const submitPay = () => {
    const amt = Number(payForm.amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    if (!payFor) return;
    addPayment({ loanId: payFor.id, amount: amt, date: payForm.date, note: payForm.note.trim() || undefined });
    const mem = data.members.find((x) => x.id === payFor.memberId);
    const prevPaid = loanPaid(data.payments, payFor.id);
    const due = loanTotalDue(payFor);
    const paidAfter = prevPaid + amt;
    const remainingAfter = Math.max(0, due - paidAfter);
    setReceipt({
      loan: payFor,
      memberName: mem?.name ?? "—",
      memberSerial: mem?.serial,
      amount: amt,
      date: payForm.date,
      paidAfter,
      remainingAfter,
      receiptNo: `KS-${toBn(data.loans.findIndex((l) => l.id === payFor.id) + 1)}-${toBn(data.payments.filter((p) => p.loanId === payFor.id).length + 1)}`,
      loanNo: data.loans.findIndex((l) => l.id === payFor.id) + 1,
      note: payForm.note.trim() || undefined,
      logo: data.samitiLogo || undefined,
    });
    setPayForm({ amount: "", date: today(), note: "" });
    setPayFor(null);
    toast.success("কিস্তি যোগ হয়েছে");
  };

  const startEdit = (l: Loan) => {
    setEditFor(l);
    setEditForm({ memberId: l.memberId, amount: String(l.amount), interestRate: String(l.interestRate), durationMonths: String(l.durationMonths), date: l.date });
  };
  const submitEdit = () => {
    if (!editFor) return;
    const amt = Number(editForm.amount);
    const rate = Number(editForm.interestRate);
    const dur = Number(editForm.durationMonths);
    if (!editForm.memberId || !amt || amt <= 0 || isNaN(rate) || rate <= 0 || !dur) { toast.error("সঠিক তথ্য দিন"); return; }
    updateLoan(editFor.id, { memberId: editForm.memberId, amount: amt, interestRate: rate, durationMonths: dur, date: editForm.date });
    setEditFor(null);
    toast.success("ঋণ আপডেট হয়েছে");
  };

  const filteredLoans = useMemo(() => {
    const term = loanSearch.trim().toLowerCase();
    return data.loans.filter((l) => {
      const m = data.members.find((x) => x.id === l.memberId);
      const name = (m?.name ?? "").toLowerCase();
      const loanNo = String(data.loans.findIndex((x) => x.id === l.id) + 1);
      const matchesSearch = !term || name.includes(term) || loanNo.includes(term);
      const matchesStatus = loanStatusFilter === "all" || l.status === loanStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data.loans, data.members, loanSearch, loanStatusFilter]);

  const printLoans = () => {
    const w = window.open("", "_blank", "width=1100,height=700");
    if (!w) return;
    const rows = filteredLoans.map((l) => {
      const m = data.members.find((x) => x.id === l.memberId);
      const due = loanTotalDue(l);
      const paid = loanPaid(data.payments, l.id);
      const remaining = Math.max(0, due - paid);
      const inst = monthlyInstallment(l.amount, l.interestRate, l.durationMonths);
      const firstPay = addMonths(l.date, 1);
      const endDate = addMonths(l.date, l.durationMonths);
      const originalLoanNo = data.loans.findIndex((x) => x.id === l.id) + 1;
      return {
        loanNo: toBn(originalLoanNo),
        member: `${m?.name ?? "—"}${m?.serial ? ` -${toBn(m.serial)}` : ""}`,
        date: fmtDate(l.date),
        principal: formatTk(l.amount),
        totalDue: formatTk(due),
        installment: formatTk(inst),
        firstPay: firstPay ? fmtDate(firstPay) : "—",
        endDate: endDate ? fmtDate(endDate) : "—",
        paid: formatTk(paid),
        remaining: formatTk(remaining),
        status: l.status === "active" ? "চলমান" : "পরিশোধিত",
      };
    });
    const sumPrincipal = filteredLoans.reduce((s, l) => s + l.amount, 0);
    const sumDue = filteredLoans.reduce((s, l) => s + loanTotalDue(l), 0);
    const sumPaid = filteredLoans.reduce((s, l) => s + loanPaid(data.payments, l.id), 0);
    const sumRemaining = filteredLoans.reduce((s, l) => s + Math.max(0, loanTotalDue(l) - loanPaid(data.payments, l.id)), 0);
    const html = `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">ঋণ নং</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">সদস্য</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">তারিখ</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">মূল</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">মোট প্রদেয়</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">মাসিক কিস্তি</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">১ম কিস্তি</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">ঋণ শেষ</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">পরিশোধ</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">বকেয়া</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">অবস্থা</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td style="border:1px solid #ccc;padding:8px;">${r.loanNo}</td>
              <td style="border:1px solid #ccc;padding:8px;">${r.member}</td>
              <td style="border:1px solid #ccc;padding:8px;">${r.date}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.principal}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.totalDue}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.installment}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.firstPay}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.endDate}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.paid}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.remaining}</td>
              <td style="border:1px solid #ccc;padding:8px;">${r.status}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr style="background:#f5f5f5;font-weight:bold;">
            <td style="border:1px solid #ccc;padding:8px;" colspan="3">সর্বমোট</td>
            <td style="border:1px solid #ccc;padding:8px;text-align:right;">${formatTk(sumPrincipal)}</td>
            <td style="border:1px solid #ccc;padding:8px;text-align:right;">${formatTk(sumDue)}</td>
            <td style="border:1px solid #ccc;padding:8px;" colspan="3"></td>
            <td style="border:1px solid #ccc;padding:8px;text-align:right;">${formatTk(sumPaid)}</td>
            <td style="border:1px solid #ccc;padding:8px;text-align:right;">${formatTk(sumRemaining)}</td>
            <td style="border:1px solid #ccc;padding:8px;"></td>
          </tr>
        </tfoot>
      </table>
    `;
    w.document.write(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8" /><title>ঋণ ব্যবস্থাপনা - ${data.samitiName || "সমিতি"}</title>
      <style>
        body { font-family: "Segoe UI", "Noto Sans Bengali", sans-serif; margin: 0; padding: 24px; color: #111; background:#fff; position: relative; }
        @media print { body { padding: 0 12px; } .no-print { display: none; } }
        ${printBrandCss}
      </style></head>
      <body>
        ${printWatermark(data.samitiLogo)}
        <div class="ps-content">
        <div class="no-print" style="margin-bottom:16px;">
          <button onclick="window.print()" style="padding:8px 16px;font-size:14px;cursor:pointer;">প্রিন্ট করুন</button>
        </div>
        ${printHeader(data.samitiName, data.samitiLogo, `ঋণ ব্যবস্থাপনা — মোট ${toBn(filteredLoans.length)}টি ঋণ | প্রিন্ট তারিখ: ${fmtDate(today())}`, data.samitiAddress, data.establishedDate)}
        ${html}
        </div>
        <script>setTimeout(()=>window.print(),300)</script>
      </body></html>
    `);
    w.document.close();
  };
  const downloadLoansPDF = () => {
    const w = window.open("", "_blank", "width=1100,height=700");
    if (!w) return;
    const rows = filteredLoans.map((l) => {
      const m = data.members.find((x) => x.id === l.memberId);
      const due = loanTotalDue(l);
      const paid = loanPaid(data.payments, l.id);
      const remaining = Math.max(0, due - paid);
      const inst = monthlyInstallment(l.amount, l.interestRate, l.durationMonths);
      const firstPay = addMonths(l.date, 1);
      const endDate = addMonths(l.date, l.durationMonths);
      const originalLoanNo = data.loans.findIndex((x) => x.id === l.id) + 1;
      return {
        loanNo: toBn(originalLoanNo),
        member: `${m?.name ?? "—"}${m?.serial ? ` -${toBn(m.serial)}` : ""}`,
        date: fmtDate(l.date),
        principal: formatTk(l.amount),
        totalDue: formatTk(due),
        installment: formatTk(inst),
        firstPay: firstPay ? fmtDate(firstPay) : "—",
        endDate: endDate ? fmtDate(endDate) : "—",
        paid: formatTk(paid),
        remaining: formatTk(remaining),
        status: l.status === "active" ? "চলমান" : "পরিশোধিত",
      };
    });
    const sumPrincipal = filteredLoans.reduce((s, l) => s + l.amount, 0);
    const sumDue = filteredLoans.reduce((s, l) => s + loanTotalDue(l), 0);
    const sumPaid = filteredLoans.reduce((s, l) => s + loanPaid(data.payments, l.id), 0);
    const sumRemaining = filteredLoans.reduce((s, l) => s + Math.max(0, loanTotalDue(l) - loanPaid(data.payments, l.id)), 0);
    const html = `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">ঋণ নং</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">সদস্য</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">তারিখ</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">মূল</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">মোট প্রদেয়</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">মাসিক কিস্তি</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">১ম কিস্তি</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">ঋণ শেষ</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">পরিশোধ</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:right;">বকেয়া</th>
            <th style="border:1px solid #ccc;padding:8px;text-align:left;">অবস্থা</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td style="border:1px solid #ccc;padding:8px;">${r.loanNo}</td>
              <td style="border:1px solid #ccc;padding:8px;">${r.member}</td>
              <td style="border:1px solid #ccc;padding:8px;">${r.date}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.principal}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.totalDue}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.installment}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.firstPay}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.endDate}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.paid}</td>
              <td style="border:1px solid #ccc;padding:8px;text-align:right;">${r.remaining}</td>
              <td style="border:1px solid #ccc;padding:8px;">${r.status}</td>
            </tr>
          `).join("")}
        </tbody>
        <tfoot>
          <tr style="background:#f5f5f5;font-weight:bold;">
            <td style="border:1px solid #ccc;padding:8px;" colspan="3">সর্বমোট</td>
            <td style="border:1px solid #ccc;padding:8px;text-align:right;">${formatTk(sumPrincipal)}</td>
            <td style="border:1px solid #ccc;padding:8px;text-align:right;">${formatTk(sumDue)}</td>
            <td style="border:1px solid #ccc;padding:8px;" colspan="3"></td>
            <td style="border:1px solid #ccc;padding:8px;text-align:right;">${formatTk(sumPaid)}</td>
            <td style="border:1px solid #ccc;padding:8px;text-align:right;">${formatTk(sumRemaining)}</td>
            <td style="border:1px solid #ccc;padding:8px;"></td>
          </tr>
        </tfoot>
      </table>
    `;
    w.document.write(`
      <!DOCTYPE html>
      <html><head><meta charset="utf-8" /><title>ঋণ তালিকা - ${data.samitiName || "সমিতি"}</title>
      <style>
        body { font-family: "Segoe UI", "Noto Sans Bengali", sans-serif; margin: 0; padding: 24px; color: #111; background:#fff; position: relative; }
        @media print {
          body { padding: 0 12px; }
          .no-print { display: none; }
          @page { size: A4 landscape; margin: 10mm; }
        }
        ${printBrandCss}
      </style></head>
      <body>
        ${printWatermark(data.samitiLogo)}
        <div class="ps-content">
        <div class="no-print" style="margin-bottom:16px; display:flex; gap:8px;">
          <button onclick="window.print()" style="padding:8px 16px;font-size:14px;cursor:pointer;">প্রিন্ট / PDF সংরক্ষণ</button>
        </div>
        ${printHeader(data.samitiName, data.samitiLogo, `ঋণ ব্যবস্থাপনা — মোট ${toBn(filteredLoans.length)}টি ঋণ | তারিখ: ${fmtDate(today())}`, data.samitiAddress, data.establishedDate)}
        ${html}
        </div>
      </body></html>
    `);
    w.document.close();
  };

  const downloadLoansExcel = () => {
    const rows = filteredLoans.map((l) => {
      const m = data.members.find((x) => x.id === l.memberId);
      const due = loanTotalDue(l);
      const paid = loanPaid(data.payments, l.id);
      const remaining = Math.max(0, due - paid);
      const inst = monthlyInstallment(l.amount, l.interestRate, l.durationMonths);
      const firstPay = addMonths(l.date, 1);
      const endDate = addMonths(l.date, l.durationMonths);
      const originalLoanNo = data.loans.findIndex((x) => x.id === l.id) + 1;
      return {
        "ঋণ নং": originalLoanNo,
        "সদস্য": m?.name ?? "—",
        "সদস্য নং": m?.serial ?? "",
        "তারিখ": l.date,
        "মূল": l.amount,
        "মুনাফার হার (%)": l.interestRate,
        "মেয়াদ (মাস)": l.durationMonths,
        "মোট প্রদেয়": due,
        "মাসিক কিস্তি": Math.round(inst),
        "১ম কিস্তির তারিখ": firstPay,
        "ঋণ শেষ": endDate,
        "পরিশোধ": paid,
        "বকেয়া": remaining,
        "অবস্থা": l.status === "active" ? "চলমান" : "পরিশোধিত",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ঋণ তালিকা");
    XLSX.writeFile(wb, `ঋণ-তালিকা-${today()}.xlsx`);
    toast.success("Excel ডাউনলোড হয়েছে");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>ঋণ ব্যবস্থাপনা</CardTitle>
          <CardDescription>মোট {toBn(data.loans.length)}টি ঋণ</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setErrors({}); }}>
          <DialogTrigger asChild><Button disabled={data.members.length === 0}><Plus className="h-4 w-4 mr-1" />নতুন ঋণ</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>নতুন ঋণ প্রদান</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>সদস্য (সিরিয়াল ও নাম) *</Label>
                <Select value={form.memberId} onValueChange={(v) => setField("memberId", v)}>
                  <SelectTrigger className={errors.memberId ? "border-destructive" : ""}><SelectValue placeholder="সদস্য নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>{data.members.map((m) => <SelectItem key={m.id} value={m.id}>{toBn(m.serial)} — {m.name}</SelectItem>)}</SelectContent>
                </Select>
                {errors.memberId && <p className="text-xs text-destructive mt-1">{errors.memberId}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>পরিমাণ *</Label>
                  <Input type="number" className={errors.amount ? "border-destructive" : ""} value={form.amount} onChange={(e) => setField("amount", e.target.value)} />
                  {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount}</p>}
                </div>
                <div>
                  <Label>মুনাফার হার (%) *</Label>
                  <Input type="number" className={errors.interestRate ? "border-destructive" : ""} value={form.interestRate} onChange={(e) => setField("interestRate", e.target.value)} />
                  {errors.interestRate && <p className="text-xs text-destructive mt-1">{errors.interestRate}</p>}
                </div>
                <div><Label>মেয়াদ (মাস)</Label><Input type="number" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} /></div>
                <div><Label>তারিখ</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              </div>
              {(() => {
                const amt = Number(form.amount) || 0;
                const rate = Number(form.interestRate) || 0;
                const dur = Number(form.durationMonths) || 0;
                const inst = monthlyInstallment(amt, rate, dur);
                const first = form.date && dur > 0 ? addMonths(form.date, 1) : "";
                const end = form.date && dur > 0 ? addMonths(form.date, dur) : "";
                return (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div><span className="text-muted-foreground">মাসিক কিস্তি:</span> <span className="font-semibold">{formatTk(inst)}</span></div>
                    <div><span className="text-muted-foreground">১ম কিস্তির তারিখ:</span> <span className="font-medium">{first ? fmtDate(first) : "—"}</span></div>
                    <div><span className="text-muted-foreground">ঋণ শেষ:</span> <span className="font-medium">{end ? fmtDate(end) : "—"}</span></div>
                  </div>
                );
              })()}
              <div>
                <Label>সদস্য জামিনদার *</Label>
                <Select value={form.memberGuarantorId} onValueChange={(v) => setField("memberGuarantorId", v)}>
                  <SelectTrigger className={errors.memberGuarantorId ? "border-destructive" : ""}><SelectValue placeholder="জামিনদার সদস্য নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>{data.members.filter((m) => m.id !== form.memberId).map((m) => <SelectItem key={m.id} value={m.id}>{toBn(m.serial)} — {m.name}</SelectItem>)}</SelectContent>
                </Select>
                {errors.memberGuarantorId && <p className="text-xs text-destructive mt-1">{errors.memberGuarantorId}</p>}
              </div>
              <div>
                <Label>পারিবারিক জামিনদার — নাম *</Label>
                <Input className={errors.familyGuarantorName ? "border-destructive" : ""} value={form.familyGuarantorName} onChange={(e) => setField("familyGuarantorName", e.target.value)} placeholder="নাম" />
                {errors.familyGuarantorName && <p className="text-xs text-destructive mt-1">{errors.familyGuarantorName}</p>}
              </div>
              <div>
                <Label>পারিবারিক জামিনদার — সম্পর্ক *</Label>
                <Select value={form.familyGuarantorRelation} onValueChange={(v) => setField("familyGuarantorRelation", v)}>
                  <SelectTrigger className={errors.familyGuarantorRelation ? "border-destructive" : ""}><SelectValue placeholder="সম্পর্ক নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="বাবা">বাবা</SelectItem>
                    <SelectItem value="মা">মা</SelectItem>
                    <SelectItem value="ভাই">ভাই</SelectItem>
                    <SelectItem value="বোন">বোন</SelectItem>
                    <SelectItem value="স্বামী">স্বামী</SelectItem>
                    <SelectItem value="স্ত্রী">স্ত্রী</SelectItem>
                    <SelectItem value="পুত্র">পুত্র</SelectItem>
                    <SelectItem value="কন্যা">কন্যা</SelectItem>
                    <SelectItem value="অন্যান্য">অন্যান্য</SelectItem>
                  </SelectContent>
                </Select>
                {errors.familyGuarantorRelation && <p className="text-xs text-destructive mt-1">{errors.familyGuarantorRelation}</p>}
              </div>
              {form.familyGuarantorRelation === "অন্যান্য" && (
                <div>
                  <Label>কাস্টম সম্পর্ক *</Label>
                  <Input className={errors.familyGuarantorCustomRelation ? "border-destructive" : ""} value={form.familyGuarantorCustomRelation} onChange={(e) => setField("familyGuarantorCustomRelation", e.target.value)} placeholder="সম্পর্ক লিখুন" />
                  {errors.familyGuarantorCustomRelation && <p className="text-xs text-destructive mt-1">{errors.familyGuarantorCustomRelation}</p>}
                </div>
              )}
              <div>
                <Label>পারিবারিক জামিনদার — মোবাইল *</Label>
                <Input className={errors.familyGuarantorPhone ? "border-destructive" : ""} value={form.familyGuarantorPhone} onChange={(e) => setField("familyGuarantorPhone", e.target.value)} placeholder="মোবাইল নম্বর" />
                {errors.familyGuarantorPhone && <p className="text-xs text-destructive mt-1">{errors.familyGuarantorPhone}</p>}
              </div>
            </div>
            <DialogFooter><Button onClick={submit}>ঋণ প্রদান</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={printLoans} title="প্রিন্ট">
            <Printer className="h-4 w-4 mr-1" />প্রিন্ট
          </Button>
          <Button variant="outline" size="sm" onClick={downloadLoansPDF} title="PDF ডাউনলোড">
            <FileText className="h-4 w-4 mr-1" />PDF
          </Button>
          <Button variant="outline" size="sm" onClick={downloadLoansExcel} title="Excel ডাউনলোড">
            <Download className="h-4 w-4 mr-1" />Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {data.loans.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="নাম বা ঋণ নং দিয়ে খুঁজুন..."
                value={loanSearch}
                onChange={(e) => setLoanSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={loanStatusFilter} onValueChange={(v) => setLoanStatusFilter(v as "all" | "active" | "closed")}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="স্ট্যাটাস" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব ঋণ</SelectItem>
                <SelectItem value="active">চলমান</SelectItem>
                <SelectItem value="closed">পরিশোধিত</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              title="পরিষ্কার"
              disabled={!loanSearch && loanStatusFilter === "all"}
              onClick={() => { setLoanSearch(""); setLoanStatusFilter("all"); }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        {data.loans.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">কোনও ঋণ নেই।</p>
        ) : filteredLoans.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">ফিল্টারে কোনও ঋণ পাওয়া যায়নি।</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              <strong>গণনা পদ্ধতি:</strong> মাসিক কিস্তি = (মূল + মুনাফা) ÷ মেয়াদ (মাস)। মুনাফা = মূল × মুনাফার হার × মেয়াদ ÷ (১০০ × ১২)। ১ম কিস্তির তারিখ = ঋণ প্রদানের তারিখ থেকে ১ মাস পর। ঋণ শেষ = ঋণ প্রদানের তারিখ + মেয়াদ (মাস)।
            </p>
            <Table>
            <TableHeader>
              <TableRow>
                 <TableHead>ঋণ নং</TableHead>
                 <TableHead>সদস্য</TableHead>
                 <TableHead>তারিখ</TableHead>
                <TableHead className="text-right">মূল</TableHead><TableHead className="text-right">মোট প্রদেয়</TableHead>
                <TableHead className="text-right">মাসিক কিস্তি</TableHead>
                <TableHead className="text-right">১ম কিস্তির তারিখ</TableHead>
                <TableHead className="text-right">ঋণ শেষ</TableHead>
                <TableHead className="text-right">পরিশোধ</TableHead><TableHead className="text-right">বকেয়া</TableHead>
                <TableHead>অবস্থা</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLoans.map((l, idx) => {
                const m = data.members.find((x) => x.id === l.memberId);
                const due = loanTotalDue(l);
                const paid = loanPaid(data.payments, l.id);
                const remaining = Math.max(0, due - paid);
                const inst = monthlyInstallment(l.amount, l.interestRate, l.durationMonths);
                const firstPay = addMonths(l.date, 1);
                const endDate = addMonths(l.date, l.durationMonths);
                const originalLoanNo = data.loans.findIndex((x) => x.id === l.id) + 1;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        className="text-foreground hover:text-primary underline-offset-2 hover:underline cursor-pointer"
                        title="বিস্তারিত দেখুন"
                        onClick={() => setDetailFor(l)}
                      >
                        {toBn(originalLoanNo)}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        className="text-foreground hover:text-primary underline-offset-2 hover:underline cursor-pointer"
                        title="বিস্তারিত দেখুন"
                        onClick={() => setDetailFor(l)}
                      >
                         {m?.name ?? "—"}{m?.serial ? ` -${toBn(m.serial)}` : ""}
                       </button>
                     </TableCell>
                    <TableCell>{fmtDate(l.date)}</TableCell>
                    <TableCell className="text-right">{formatTk(l.amount)}</TableCell>
                    <TableCell className="text-right">{formatTk(due)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {l.status === "active" ? (
                        <button
                          type="button"
                          className="text-primary underline-offset-2 hover:underline cursor-pointer"
                          title="ক্লিক করে কিস্তি গ্রহণ করুন"
                          onClick={() => { setPayFor(l); setPayForm({ amount: String(Math.round(Math.min(inst, remaining))), date: today(), note: "" }); }}
                        >
                          {formatTk(inst)}
                        </button>
                      ) : formatTk(inst)}
                    </TableCell>
                    <TableCell className="text-right">{firstPay ? fmtDate(firstPay) : "—"}</TableCell>
                    <TableCell className="text-right">{endDate ? fmtDate(endDate) : "—"}</TableCell>
                    <TableCell className="text-right text-success font-medium">{formatTk(paid)}</TableCell>
                    <TableCell className="text-right text-destructive font-semibold">{formatTk(remaining)}</TableCell>
                    <TableCell>
                      {l.status === "active"
                        ? <Badge variant="secondary">চলমান</Badge>
                        : <Badge className="bg-success text-success-foreground">পরিশোধিত</Badge>}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      {l.status === "active" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => { setPayFor(l); setPayForm({ amount: String(Math.round(Math.min(inst, remaining))), date: today(), note: "" }); }}>কিস্তি</Button>
                          {remaining <= 0 && (
                            <Button size="icon" variant="ghost" onClick={() => { closeLoan(l.id); toast.success("ঋণ পরিশোধিত"); }}>
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                          )}
                        </>
                      )}
                      <Button size="icon" variant="ghost" title="বিস্তারিত" onClick={() => setDetailFor(l)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="এডিট" onClick={() => startEdit(l)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("ঋণ ও কিস্তি মুছবেন?")) { deleteLoan(l.id); toast.success("মুছে ফেলা হয়েছে"); } }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
           </Table>
          </>
        )}
      </CardContent>

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>কিস্তি গ্রহণ</DialogTitle></DialogHeader>
          {payFor && (() => {
            const mem = data.members.find((x) => x.id === payFor.memberId);
            const inst = monthlyInstallment(payFor.amount, payFor.interestRate, payFor.durationMonths);
            const paid = loanPaid(data.payments, payFor.id);
            const remaining = Math.max(0, loanTotalDue(payFor) - paid);
            return (
              <div className="rounded-md border bg-muted/40 p-3 text-sm grid grid-cols-2 gap-2 mb-2">
                <div><span className="text-muted-foreground">সদস্য:</span> <span className="font-medium">{mem?.name ?? "—"}</span></div>
                <div><span className="text-muted-foreground">মাসিক কিস্তি:</span> <span className="font-semibold">{formatTk(inst)}</span></div>
                <div><span className="text-muted-foreground">বকেয়া:</span> <span className="font-semibold text-destructive">{formatTk(remaining)}</span></div>
                <div><span className="text-muted-foreground">পরিশোধিত:</span> <span className="text-success">{formatTk(paid)}</span></div>
              </div>
            );
          })()}
          <div className="space-y-3">
            <div><Label>পরিমাণ *</Label><Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
            <div><Label>তারিখ</Label><Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></div>
            <div><Label>মন্তব্য / নোট</Label><Textarea rows={2} placeholder="ঐচ্ছিক — কিস্তি সংক্রান্ত নোট লিখুন" value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={submitPay}>সংরক্ষণ ও রিসিপ্ট</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>কিস্তি রিসিপ্ট</DialogTitle></DialogHeader>
          {receipt && (
            <div id="installment-receipt" className="border rounded-md p-4 text-sm bg-card">
              <div className="flex items-center justify-center gap-3 mb-3">
                {receipt.logo && (
                  <img src={receipt.logo} alt="logo" className="h-12 w-12 object-contain rounded" />
                )}
                <div className="text-center">
                  <div className="text-lg font-bold">{data.samitiName || "সমিতি"}</div>
                  <div className="text-xs text-muted-foreground">কিস্তি প্রাপ্তি রিসিপ্ট</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">রিসিপ্ট নং:</span> <span className="font-medium">{receipt.receiptNo}</span></div>
                <div><span className="text-muted-foreground">তারিখ:</span> <span className="font-medium">{fmtDate(receipt.date)}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">সদস্য:</span> <span className="font-medium">{receipt.memberName}{receipt.loanNo ? ` (ঋণ নং ${toBn(receipt.loanNo)})` : ""}</span></div>
                <div><span className="text-muted-foreground">ঋণ মূল:</span> {formatTk(receipt.loan.amount)}</div>
                <div><span className="text-muted-foreground">মেয়াদ:</span> {toBn(receipt.loan.durationMonths)} মাস</div>
              </div>
              <div className="mt-3 border-t pt-2 flex justify-between text-base">
                <span className="font-medium">প্রাপ্ত কিস্তি</span>
                <span className="font-bold text-success">{formatTk(receipt.amount)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">মোট পরিশোধিত:</span> <span className="font-medium">{formatTk(receipt.paidAfter)}</span></div>
                <div><span className="text-muted-foreground">অবশিষ্ট বকেয়া:</span> <span className="font-semibold text-destructive">{formatTk(receipt.remainingAfter)}</span></div>
              </div>
              {receipt.note && (
                <div className="mt-3 text-sm border-t pt-2">
                  <span className="text-muted-foreground">নোট:</span> <span className="font-medium whitespace-pre-wrap">{receipt.note}</span>
                </div>
              )}
              <ReceiptQrPreview text={buildQrText({
                memberName: receipt.memberName, memberSerial: receipt.memberSerial,
                loanNo: receipt.loanNo, date: receipt.date, amount: receipt.amount,
              })} />
              <div className="mt-6 flex justify-between text-xs text-muted-foreground">
                <div>—————————<br />গ্রহীতা</div>
                <TreasurerSignBlock committee={data.settings.committee} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setReceipt(null)}>বন্ধ</Button>
            <Button variant="secondary" onClick={async () => {
              if (!receipt) return;
              try {
                toast.loading("ছবি তৈরি হচ্ছে...", { id: "rjpg" });
                const canvas = await renderReceiptCanvas(receipt, data.samitiName || "সমিতি", findTreasurer(data.settings.committee));
                const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.95));
                if (!blob) throw new Error("blob");
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `রিসিপ্ট-${receipt.receiptNo}.jpg`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                toast.success("JPEG ডাউনলোড হয়েছে", { id: "rjpg" });
              } catch (e) {
                console.error(e);
                toast.error("ডাউনলোড ব্যর্থ হয়েছে", { id: "rjpg" });
              }
            }}><ImageDown className="h-4 w-4 mr-1" />JPEG ডাউনলোড</Button>
            <Button variant="secondary" onClick={async () => {
              if (!receipt) return;
              const text = `কিস্তি রিসিপ্ট\nসমিতি: ${data.samitiName || "সমিতি"}\nরিসিপ্ট নং: ${receipt.receiptNo}\nতারিখ: ${fmtDate(receipt.date)}\nসদস্য: ${receipt.memberName}${receipt.loanNo ? ` (ঋণ নং ${toBn(receipt.loanNo)})` : ""}\nপ্রাপ্ত কিস্তি: ${formatTk(receipt.amount)}\nমোট পরিশোধিত: ${formatTk(receipt.paidAfter)}\nঅবশিষ্ট বকেয়া: ${formatTk(receipt.remainingAfter)}`;
              try {
                toast.loading("শেয়ার প্রস্তুত হচ্ছে...", { id: "rshare" });
                const canvas = await renderReceiptCanvas(receipt, data.samitiName || "সমিতি", findTreasurer(data.settings.committee));
                const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.95));
                toast.dismiss("rshare");
                const file = blob ? new File([blob], `রিসিপ্ট-${receipt.receiptNo}.jpg`, { type: "image/jpeg" }) : null;
                const nav: any = navigator;
                if (file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
                  try { await nav.share({ title: "কিস্তি রিসিপ্ট", text, files: [file] }); return; } catch (e: any) {
                    if (e?.name === "AbortError") return;
                  }
                }
                if (nav.share) {
                  try { await nav.share({ title: "কিস্তি রিসিপ্ট", text }); return; } catch (e: any) {
                    if (e?.name === "AbortError") return;
                  }
                }
                await navigator.clipboard.writeText(text);
                toast.success("রিসিপ্টের তথ্য কপি হয়েছে");
              } catch (e) {
                console.error(e);
                try { await navigator.clipboard.writeText(text); toast.success("রিসিপ্টের তথ্য কপি হয়েছে", { id: "rshare" }); }
                catch { toast.error("শেয়ার ব্যর্থ হয়েছে", { id: "rshare" }); }
              }
            }}><Share className="h-4 w-4 mr-1" />শেয়ার</Button>
            <Button onClick={async () => {
              if (!receipt) return;
              const qrDataUrl = await buildInstallmentQr(receipt, data.samitiName || "সমিতি");
              const html = buildReceiptHtml(receipt, data.samitiName || "সমিতি", qrDataUrl, findTreasurer(data.settings.committee));
              const w = window.open("", "_blank", "width=600,height=800");
              if (!w) return;
              w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>রিসিপ্ট</title><style>${receiptCss}</style></head><body>${html}<script>setTimeout(()=>window.print(),300)</script></body></html>`);
              w.document.close();
              w.focus();
            }}><Printer className="h-4 w-4 mr-1" />প্রিন্ট</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editFor} onOpenChange={(o) => !o && setEditFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>ঋণ সম্পাদনা</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>সদস্য</Label>
              <Select value={editForm.memberId} onValueChange={(v) => setEditForm({ ...editForm, memberId: v })}>
                <SelectTrigger><SelectValue placeholder="সদস্য নির্বাচন করুন" /></SelectTrigger>
                <SelectContent>{data.members.map((m) => <SelectItem key={m.id} value={m.id}>{toBn(m.serial)} — {m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>পরিমাণ</Label><Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} /></div>
              <div><Label>মুনাফার হার (%)</Label><Input type="number" value={editForm.interestRate} onChange={(e) => setEditForm({ ...editForm, interestRate: e.target.value })} /></div>
              <div><Label>মেয়াদ (মাস)</Label><Input type="number" value={editForm.durationMonths} onChange={(e) => setEditForm({ ...editForm, durationMonths: e.target.value })} /></div>
              <div><Label>তারিখ</Label><Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></div>
            </div>
            {(() => {
              const amt = Number(editForm.amount) || 0;
              const rate = Number(editForm.interestRate) || 0;
              const dur = Number(editForm.durationMonths) || 0;
              const inst = monthlyInstallment(amt, rate, dur);
              const first = editForm.date && dur > 0 ? addMonths(editForm.date, 1) : "";
              const end = editForm.date && dur > 0 ? addMonths(editForm.date, dur) : "";
              return (
                <div className="rounded-md border bg-muted/40 p-3 text-sm grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div><span className="text-muted-foreground">মাসিক কিস্তি:</span> <span className="font-semibold">{formatTk(inst)}</span></div>
                  <div><span className="text-muted-foreground">১ম কিস্তির তারিখ:</span> <span className="font-medium">{first ? fmtDate(first) : "—"}</span></div>
                  <div><span className="text-muted-foreground">ঋণ শেষ:</span> <span className="font-medium">{end ? fmtDate(end) : "—"}</span></div>
                </div>
              );
            })()}
          </div>
          <DialogFooter><Button onClick={submitEdit}>সংরক্ষণ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailFor} onOpenChange={(o) => !o && setDetailFor(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>ঋণের বিস্তারিত</DialogTitle></DialogHeader>
          {detailFor && (() => {
            const currentLoan = data.loans.find((x) => x.id === detailFor.id) ?? detailFor;
            const m = data.members.find((x) => x.id === currentLoan.memberId);
            const gm = data.members.find((x) => x.id === currentLoan.memberGuarantorId);
            const due = loanTotalDue(currentLoan);
            const pays = data.payments.filter((p) => p.loanId === currentLoan.id);
            const paid = pays.reduce((s, p) => s + p.amount, 0);
            const idx = data.loans.findIndex((x) => x.id === currentLoan.id);
            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">ঋণ নং:</span> {toBn(idx + 1)}</div>
                  <div><span className="text-muted-foreground">তারিখ:</span> {fmtDate(currentLoan.date)}</div>
                  <div><span className="text-muted-foreground">সদস্য:</span> {m?.name ?? "—"}</div>
                  <div><span className="text-muted-foreground">মোবাইল:</span> {m?.phone ?? "—"}</div>
                  <div><span className="text-muted-foreground">মূল:</span> {formatTk(currentLoan.amount)}</div>
                  <div><span className="text-muted-foreground">মুনাফার হার:</span> {toBn(currentLoan.interestRate)}%</div>
                  <div><span className="text-muted-foreground">মেয়াদ:</span> {toBn(currentLoan.durationMonths)} মাস</div>
                  <div><span className="text-muted-foreground">মাসিক কিস্তি:</span> {formatTk(monthlyInstallment(currentLoan.amount, currentLoan.interestRate, currentLoan.durationMonths))}</div>
                  <div><span className="text-muted-foreground">১ম কিস্তির তারিখ:</span> {fmtDate(addMonths(currentLoan.date, 1))}</div>
                  <div><span className="text-muted-foreground">ঋণ শেষ:</span> {fmtDate(addMonths(currentLoan.date, currentLoan.durationMonths))}</div>
                  <div><span className="text-muted-foreground">মোট প্রদেয়:</span> {formatTk(due)}</div>
                  <div><span className="text-success">পরিশোধ:</span> {formatTk(paid)}</div>
                  <div><span className="text-destructive">বকেয়া:</span> {formatTk(Math.max(0, due - paid))}</div>
                  <div><span className="text-muted-foreground">অবস্থা:</span> {currentLoan.status === "active" ? "চলমান" : "পরিশোধিত"}</div>
                </div>
                <div className="border-t pt-2">
                  <div className="font-medium mb-1">জামিনদার</div>
                  <div>সদস্য জামিনদার: {gm?.name ?? "—"}</div>
                  {currentLoan.familyGuarantor && (
                    <div>পারিবারিক: {currentLoan.familyGuarantor.name} ({currentLoan.familyGuarantor.relation}) — {currentLoan.familyGuarantor.phone}</div>
                  )}
                </div>
                <div className="border-t pt-2">
                  <div className="font-medium mb-1">কিস্তি ({toBn(pays.length)})</div>
                  {pays.length === 0 ? (
                    <p className="text-muted-foreground">কোনও কিস্তি নেই।</p>
                  ) : (
                    <Table>
                      <TableHeader><TableRow><TableHead>তারিখ</TableHead><TableHead className="text-right">পরিমাণ</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {pays.map((p) => (
                          <TableRow key={p.id}><TableCell>{fmtDate(p.date)}</TableCell><TableCell className="text-right">{formatTk(p.amount)}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
                <div className="border-t pt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newStatus = refreshLoanStatus(currentLoan.id);
                      setDetailFor((prev) => prev && newStatus ? { ...prev, status: newStatus } : prev);
                      if (newStatus === "closed") {
                        toast.success("ঋণের স্ট্যাটাস আপডেট হয়েছে — এখন পরিশোধিত");
                      } else {
                        toast.success("ঋণের স্ট্যাটাস আপডেট হয়েছে — চলমান");
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4" /> স্ট্যাটাস আপডেট
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const samiti: SamitiInfo = {
                        samitiName: data.samitiName,
                        samitiLogo: data.samitiLogo,
                        samitiAddress: data.samitiAddress,
                        establishedDate: data.establishedDate,
                      };
                      printLoanDetail(currentLoan, idx + 1, m, gm, pays, samiti);
                    }}
                  >
                    <Printer className="h-4 w-4" /> প্রিন্ট
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      const samiti: SamitiInfo = {
                        samitiName: data.samitiName,
                        samitiLogo: data.samitiLogo,
                        samitiAddress: data.samitiAddress,
                        establishedDate: data.establishedDate,
                      };
                      try {
                        await exportLoanDetailPdf(currentLoan, idx + 1, m, gm, pays, samiti);
                      } catch (e) {
                        toast.error("PDF ডাউনলোড ব্যর্থ হয়েছে");
                      }
                    }}
                  >
                    <Download className="h-4 w-4" /> PDF ডাউনলোড
                  </Button>
                  {currentLoan.status === "closed" && (() => {
                    const buildCert = async () => {
                      const lastPay = [...pays].sort((a, b) => b.date.localeCompare(a.date))[0];
                      const closeDate = lastPay?.date || today();
                      const certNo = `C-${toBn(idx + 1)}`;
                      return await buildClosureWithQr({
                        samitiName: data.samitiName,
                        logo: data.samitiLogo,
                        memberName: m?.name ?? "",
                        memberSerial: m?.serial,
                        loanNo: idx + 1,
                        loanAmount: currentLoan.amount,
                        interestRate: currentLoan.interestRate,
                        durationMonths: currentLoan.durationMonths,
                        totalDue: due,
                        totalPaid: paid,
                        loanDate: currentLoan.date,
                        closeDate,
                        certNo,
                        committee: data.settings.committee,
                      });
                    };
                    return (
                      <>
                        <Button variant="outline" onClick={async () => { try { setClosureView(await buildCert()); } catch { toast.error("সনদ তৈরি ব্যর্থ"); } }}>
                          <Eye className="h-4 w-4" /> সনদ দেখুন
                        </Button>
                        <Button variant="outline" onClick={async () => { try { printClosureHtml(await buildCert()); } catch { toast.error("প্রিন্ট ব্যর্থ"); } }}>
                          <Printer className="h-4 w-4" /> সনদ প্রিন্ট
                        </Button>
                      </>
                    );
                  })()}
                  {currentLoan.status === "active" && (() => {
                    const inst = monthlyInstallment(currentLoan.amount, currentLoan.interestRate, currentLoan.durationMonths);
                    const remaining = Math.max(0, due - paid);
                    return (
                      <Button
                        onClick={() => {
                          const target = Math.min(inst, remaining);
                          setPayFor(currentLoan);
                          setPayForm({ amount: String(Math.round(target)), date: today(), note: "" });
                          setDetailFor(null);
                        }}
                      >
                        ঋণ আদায়
                      </Button>
                    );
                  })()}
                </div>

              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!closureView} onOpenChange={(o) => !o && setClosureView(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2"><DialogTitle>ঋণ পরিশোধ সনদ</DialogTitle></DialogHeader>
          {closureView && (
            <iframe title="closure" srcDoc={closureSrcDoc(closureView)} className="w-full h-[70vh] border-0" />
          )}
          <div className="p-3 border-t flex justify-end gap-2">
            <Button variant="outline" onClick={() => closureView && printClosureHtml(closureView)}><Printer className="h-4 w-4" /> প্রিন্ট</Button>
            <Button variant="ghost" onClick={() => setClosureView(null)}>বন্ধ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ===== Installments (কিস্তি আদায়) =====
function InstallmentsTab() {
  const { data, addPayment, deletePayment, closeLoan } = useSamiti();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ loanId: "", amount: "", date: today(), note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterMember, setFilterMember] = useState<string>("all");
  const [filterLoan, setFilterLoan] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>(today().slice(0, 7));
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "closed">("all");
  const [loanOpen, setLoanOpen] = useState(false);

  const activeLoans = data.loans.filter((l) => l.status === "active");
  const loanInfo = (loanId: string) => {
    const loan = data.loans.find((l) => l.id === loanId);
    if (!loan) return null;
    const member = data.members.find((m) => m.id === loan.memberId);
    const due = loanTotalDue(loan);
    const paid = loanPaid(data.payments, loan.id);
    const remaining = Math.max(0, due - paid);
    const installment = loan.durationMonths > 0 ? due / loan.durationMonths : 0;
    return { loan, member, due, paid, remaining, installment };
  };

  const selected = form.loanId ? loanInfo(form.loanId) : null;

  const setField = (k: string, v: string) => {
    setForm((p) => ({ ...p, [k]: v }));
    setErrors((p) => { const n = { ...p }; delete n[k]; return n; });
  };

  const submit = () => {
    const next: Record<string, string> = {};
    if (!form.loanId) next.loanId = "ঋণ নির্বাচন করুন";
    const amt = Number(form.amount);
    if (!form.amount.trim() || isNaN(amt) || amt <= 0) next.amount = "সঠিক পরিমাণ দিন";
    if (!form.date) next.date = "তারিখ দিন";
    if (selected && amt > selected.remaining + 0.01) next.amount = `বকেয়ার চেয়ে বেশি (বকেয়া ${formatTk(selected.remaining)})`;
    if (Object.keys(next).length) { setErrors(next); return; }

    addPayment({ loanId: form.loanId, amount: amt, date: form.date, note: form.note.trim() || undefined });
    if (selected) {
      const newPaid = selected.paid + amt;
      if (newPaid >= selected.due - 0.01) {
        closeLoan(form.loanId);
        toast.success("কিস্তি গৃহীত — ঋণ পরিশোধিত");
      } else {
        toast.success("কিস্তি গৃহীত");
      }
    }
    setForm({ loanId: "", amount: "", date: today(), note: "" });
    setErrors({});
    setOpen(false);
  };

  const allPayments = [...data.payments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((p) => {
      const loan = data.loans.find((l) => l.id === p.loanId);
      if (filterStatus !== "all" && loan?.status !== filterStatus) return false;
      if (filterLoan !== "all" && p.loanId !== filterLoan) return false;
      if (filterMonth && !p.date.startsWith(filterMonth)) return false;
      if (filterMember === "all") return true;
      return loan?.memberId === filterMember;
    });

  // মাসিক কিস্তি স্থিতি: কোন কোন ঋণির এই মাসে কিস্তি আছে এবং কে পরিশোধ করেছে
  const monthlyStatus = useMemo(() => {
    if (!filterMonth) return [] as Array<{ loan: Loan; loanNo: number; member?: Member; installment: number; paidInMonth: number; status: "paid" | "partial" | "unpaid" }>;
    return data.loans
      .filter((l) => l.date.slice(0, 7) <= filterMonth) // ঋণটি ঐ মাসের আগে/সমান শুরু হয়েছে
      .filter((l) => filterStatus === "all" || l.status === filterStatus)
      .filter((l) => filterMember === "all" || l.memberId === filterMember)
      .filter((l) => filterLoan === "all" || l.id === filterLoan)
      .map((l) => {
        const loanNo = data.loans.findIndex((x) => x.id === l.id) + 1;
        const member = data.members.find((m) => m.id === l.memberId);
        const installment = l.durationMonths > 0 ? loanTotalDue(l) / l.durationMonths : 0;
        const paidInMonth = data.payments
          .filter((p) => p.loanId === l.id && p.date.startsWith(filterMonth))
          .reduce((s, p) => s + p.amount, 0);
        const status: "paid" | "partial" | "unpaid" =
          paidInMonth >= installment - 0.01 ? "paid" : paidInMonth > 0 ? "partial" : "unpaid";
        return { loan: l, loanNo, member, installment, paidInMonth, status };
      })
      .sort((a, b) => (a.member?.serial || 0) - (b.member?.serial || 0));
  }, [data, filterMonth, filterMember, filterLoan, filterStatus]);

  const totalCollected = allPayments.reduce((s, p) => s + p.amount, 0);
  const totalOutstanding = activeLoans.reduce((s, l) => s + Math.max(0, loanTotalDue(l) - loanPaid(data.payments, l.id)), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="মোট আদায়" value={formatTk(totalCollected)} accent="bg-success" />
        <StatCard label="মোট বকেয়া" value={formatTk(totalOutstanding)} accent="bg-destructive" />
        <StatCard label="চলমান ঋণ" value={toBn(activeLoans.length)} accent="bg-primary" />
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle>কিস্তি আদায়</CardTitle>
            <CardDescription>মোট {toBn(allPayments.length)}টি কিস্তি</CardDescription>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Popover open={loanOpen} onOpenChange={setLoanOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={loanOpen} className="w-56 justify-between">
                  <span className="truncate">
                    {filterLoan === "all"
                      ? "সকল ঋণি"
                      : (() => {
                          const l = data.loans.find((x) => x.id === filterLoan);
                          if (!l) return "ঋণি নির্বাচন";
                          const idx = data.loans.findIndex((x) => x.id === l.id);
                          const m = data.members.find((x) => x.id === l.memberId);
                          return `ঋণ নং ${toBn(idx + 1)} — ${m?.name ?? "—"}${l.status === "closed" ? " (পরিশোধিত)" : ""}`;
                        })()}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0">
                <Command>
                  <CommandInput placeholder="ঋণ নং বা নাম খুঁজুন..." />
                  <CommandList>
                    <CommandEmpty>কোনো ঋণ পাওয়া যায়নি</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="all"
                        onSelect={() => { setFilterLoan("all"); setLoanOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", filterLoan === "all" ? "opacity-100" : "opacity-0")} />
                        সকল ঋণি
                      </CommandItem>
                      {data.loans.map((l, idx) => {
                        const m = data.members.find((x) => x.id === l.memberId);
                        const label = `ঋণ নং ${toBn(idx + 1)} — ${m?.name ?? "—"}${l.status === "closed" ? " (পরিশোধিত)" : ""}`;
                        return (
                          <CommandItem
                            key={l.id}
                            value={label}
                            onSelect={() => { setFilterLoan(l.id); setLoanOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", filterLoan === l.id ? "opacity-100" : "opacity-0")} />
                            {label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "active" | "closed")}>
              <SelectTrigger className="w-36"><SelectValue placeholder="স্ট্যাটাস" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সকল স্ট্যাটাস</SelectItem>
                <SelectItem value="active">চলমান</SelectItem>
                <SelectItem value="closed">পরিশোধিত</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMember} onValueChange={setFilterMember}>
              <SelectTrigger className="w-44"><SelectValue placeholder="সদস্য ফিল্টার" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সকল সদস্য</SelectItem>
                {data.members.map((m) => <SelectItem key={m.id} value={m.id}>{toBn(m.serial)} — {m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Input type="month" className="w-40" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} title="মাস ফিল্টার" />
              {filterMonth && <Button size="sm" variant="ghost" onClick={() => setFilterMonth("")}>সকল মাস</Button>}
            </div>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setErrors({}); }}>
              <DialogTrigger asChild>
                <Button disabled={activeLoans.length === 0}><Plus className="h-4 w-4 mr-1" />নতুন কিস্তি</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>কিস্তি আদায়</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>ঋণ নির্বাচন *</Label>
                    <Select value={form.loanId} onValueChange={(v) => setField("loanId", v)}>
                      <SelectTrigger className={errors.loanId ? "border-destructive" : ""}><SelectValue placeholder="চলমান ঋণ নির্বাচন করুন" /></SelectTrigger>
                      <SelectContent>
                        {activeLoans.map((l) => {
                          const m = data.members.find((x) => x.id === l.memberId);
                          const rem = Math.max(0, loanTotalDue(l) - loanPaid(data.payments, l.id));
                          const loanNo = data.loans.findIndex((x) => x.id === l.id) + 1;
                          return <SelectItem key={l.id} value={l.id}>ঋণ নং {toBn(loanNo)} | {m ? `${toBn(m.serial)} — ${m.name}` : "—"} | বকেয়া {formatTk(rem)}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                    {errors.loanId && <p className="text-xs text-destructive mt-1">{errors.loanId}</p>}
                  </div>
                  {selected && (
                    <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">মূল ঋণ</span><span>{formatTk(selected.loan.amount)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">মোট প্রদেয়</span><span>{formatTk(selected.due)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">পরিশোধিত</span><span className="text-success font-medium">{formatTk(selected.paid)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">বকেয়া</span><span className="text-destructive font-semibold">{formatTk(selected.remaining)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">মাসিক কিস্তি (আনু.)</span><span>{formatTk(selected.installment)}</span></div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>পরিমাণ *</Label>
                      <Input type="number" className={errors.amount ? "border-destructive" : ""} value={form.amount} onChange={(e) => setField("amount", e.target.value)} />
                      {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount}</p>}
                      {selected && !errors.amount && (
                        <button type="button" className="text-xs text-primary mt-1 underline" onClick={() => setField("amount", String(Math.round(Math.min(selected.installment, selected.remaining))))}>
                          মাসিক কিস্তি বসান
                        </button>
                      )}
                    </div>
                    <div>
                      <Label>তারিখ *</Label>
                      <Input type="date" className={errors.date ? "border-destructive" : ""} value={form.date} onChange={(e) => setField("date", e.target.value)} />
                      {errors.date && <p className="text-xs text-destructive mt-1">{errors.date}</p>}
                    </div>
                  </div>
                  <div>
                    <Label>মন্তব্য / নোট</Label>
                    <Textarea rows={2} placeholder="ঐচ্ছিক — কিস্তি সংক্রান্ত নোট লিখুন" value={form.note} onChange={(e) => setField("note", e.target.value)} />
                  </div>
                </div>
                <DialogFooter><Button onClick={submit}>সংরক্ষণ</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {allPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">কোনও কিস্তি নেই।</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>রিসিপ্ট নং</TableHead>
                  <TableHead>তারিখ</TableHead>
                  <TableHead>ঋণ নং</TableHead>
                  <TableHead>সদস্য</TableHead>
                  <TableHead className="text-right">ঋণ পরিমাণ</TableHead>
                  <TableHead className="text-right">কিস্তি</TableHead>
                  <TableHead className="text-right">বর্তমান বকেয়া</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allPayments.map((p) => {
                  const loan = data.loans.find((l) => l.id === p.loanId);
                  const loanIdx = loan ? data.loans.findIndex((l) => l.id === loan.id) + 1 : 0;
                  const m = loan ? data.members.find((x) => x.id === loan.memberId) : null;
                  const rem = loan ? Math.max(0, loanTotalDue(loan) - loanPaid(data.payments, loan.id)) : 0;
                  const payNoForLoan = loan ? data.payments.filter((x) => x.loanId === loan.id).findIndex((x) => x.id === p.id) + 1 : 0;
                  const receiptNo = loan && m ? `KS-${toBn(loanIdx)}-${toBn(payNoForLoan)}` : "—";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium font-mono text-xs">{receiptNo}</TableCell>
                      <TableCell>{fmtDate(p.date)}</TableCell>
                      <TableCell className="font-medium">{loan ? toBn(loanIdx) : "—"}</TableCell>
                      <TableCell className="font-medium">{m ? `${toBn(m.serial)} — ${m.name}` : "—"}</TableCell>
                      <TableCell className="text-right">{loan ? formatTk(loan.amount) : "—"}</TableCell>
                      <TableCell className="text-right text-success font-semibold">{formatTk(p.amount)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatTk(rem)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("কিস্তি মুছবেন?")) { deletePayment(p.id); toast.success("মুছে ফেলা হয়েছে"); } }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {filterMonth && (
        <Card>
          <CardHeader>
            <CardTitle>মাসিক কিস্তি স্থিতি — {filterMonth}</CardTitle>
            <CardDescription>
              মোট {toBn(monthlyStatus.length)}টি চলমান ঋণ |{" "}
              পরিশোধিত: {toBn(monthlyStatus.filter((r) => r.status === "paid").length)} |{" "}
              আংশিক: {toBn(monthlyStatus.filter((r) => r.status === "partial").length)} |{" "}
              বকেয়া: {toBn(monthlyStatus.filter((r) => r.status === "unpaid").length)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">এই মাসে কোনও চলমান ঋণ নেই।</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ঋণ নং</TableHead>
                    <TableHead>সদস্য</TableHead>
                    <TableHead className="text-right">মাসিক কিস্তি</TableHead>
                    <TableHead className="text-right">এ মাসে পরিশোধ</TableHead>
                    <TableHead>অবস্থা</TableHead>
                    <TableHead className="text-right">কার্যক্রম</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...monthlyStatus]
                    .sort((a, b) => {
                      const order = { unpaid: 0, partial: 1, paid: 2 } as const;
                      return order[a.status] - order[b.status];
                    })
                    .map((r) => {
                      const rem = Math.max(0, loanTotalDue(r.loan) - loanPaid(data.payments, r.loan.id));
                      const dueThisMonth = Math.max(0, r.installment - r.paidInMonth);
                      const suggested = Math.round(Math.min(dueThisMonth || r.installment, rem));
                      const defaultDate = filterMonth === today().slice(0, 7)
                        ? today()
                        : `${filterMonth}-${String(new Date(Number(filterMonth.slice(0, 4)), Number(filterMonth.slice(5, 7)), 0).getDate()).padStart(2, "0")}`;
                      return (
                        <TableRow key={r.loan.id}>
                          <TableCell className="font-medium">{toBn(r.loanNo)}</TableCell>
                          <TableCell className="font-medium">{r.member ? `${toBn(r.member.serial)} — ${r.member.name}` : "—"}</TableCell>
                          <TableCell className="text-right">{formatTk(r.installment)}</TableCell>
                          <TableCell className="text-right text-success font-semibold">{formatTk(r.paidInMonth)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {r.status === "paid" ? (
                                <Badge className="bg-success text-success-foreground h-6 px-2 text-xs">পরিশোধিত</Badge>
                              ) : r.status === "partial" ? (
                                <Badge variant="outline" className="border-amber-500 text-amber-600 h-6 px-2 text-xs">আংশিক</Badge>
                              ) : (
                                <Badge variant="destructive" className="h-6 px-2 text-xs">বকেয়া</Badge>
                              )}
                              {r.status !== "paid" && r.loan.status === "active" && rem > 0 && (
                                <Button
                                  className="h-6 px-2 text-xs"
                                  onClick={() => {
                                    setForm({ loanId: r.loan.id, amount: String(suggested), date: defaultDate, note: "" });
                                    setErrors({});
                                    setOpen(true);
                                  }}
                                >
                                  কিস্তি আদায়
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right"></TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>

              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReceiptsHistoryTab() {
  const { data, updatePayment, deletePayment } = useSamiti();
  const [q, setQ] = useState("");
  const [receipt, setReceipt] = useState<null | { loan: Loan; memberName: string; memberSerial?: number; amount: number; date: string; paidAfter: number; remainingAfter: number; receiptNo: string; note?: string; logo?: string; loanNo?: number }>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: "", date: today(), note: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);


  const rows = useMemo(() => {
    const memberById = new Map(data.members.map((m) => [m.id, m]));
    const loanIndexById = new Map(data.loans.map((l, i) => [l.id, i + 1]));
    const loanById = new Map(data.loans.map((l) => [l.id, l]));
    const paymentsByLoan = new Map<string, typeof data.payments>();
    for (const p of data.payments) {
      const arr = paymentsByLoan.get(p.loanId) ?? [];
      arr.push(p);
      paymentsByLoan.set(p.loanId, arr);
    }
    return [...data.payments]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((p) => {
        const loan = loanById.get(p.loanId);
        const member = loan ? memberById.get(loan.memberId) : undefined;
        const loanPays = paymentsByLoan.get(p.loanId) ?? [];
        const payNo = loanPays.findIndex((x) => x.id === p.id) + 1;
        const receiptNo = `KS-${toBn(loanIndexById.get(p.loanId) ?? 0)}-${toBn(payNo)}`;
        return {
          id: p.id,
          loanId: p.loanId,
          loan,
          date: p.date,
          memberName: member?.name ?? "—",
          memberSerial: member?.serial ?? 0,
          loanNo: loanIndexById.get(p.loanId) ?? 0,
          amount: p.amount,
          note: p.note ?? "",
          receiptNo,
        };
      })
      .filter((r) => {
        if (!q.trim()) return true;
        const s = q.toLowerCase();
        return (
          r.memberName.toLowerCase().includes(s) ||
          String(r.loanNo).includes(s) ||
          toBn(r.loanNo).includes(s) ||
          r.receiptNo.toLowerCase().includes(s) ||
          r.note.toLowerCase().includes(s)
        );
      });
  }, [data, q]);


  const total = rows.reduce((s, r) => s + r.amount, 0);

  const openReceipt = (r: typeof rows[number]) => {
    if (!r.loan) { toast.error("ঋণ পাওয়া যায়নি"); return; }
    const loanPayments = data.payments.filter((p) => p.loanId === r.loanId);
    const paidAfter = loanPayments
      .filter((p) => p.date < r.date || (p.date === r.date && p.id <= r.id))
      .reduce((s, p) => s + p.amount, 0);
    const remainingAfter = Math.max(0, loanTotalDue(r.loan) - paidAfter);
    setReceipt({
      loan: r.loan,
      memberName: r.memberName,
      memberSerial: r.memberSerial,
      amount: r.amount,
      date: r.date,
      paidAfter,
      remainingAfter,
      receiptNo: `KS-${toBn(r.loanNo)}-${toBn(loanPayments.findIndex((p) => p.id === r.id) + 1)}`,
      note: r.note,
      logo: data.samitiLogo,
      loanNo: r.loanNo,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">কিস্তি রিসিপ্ট ইতিহাস</h2>
          <p className="text-sm text-muted-foreground">সকল কিস্তি আদায়ের তালিকা</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="সদস্য / ঋণ নং / নোট খুঁজুন" className="pl-9" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">ক্রম</TableHead>
                <TableHead>তারিখ</TableHead>
                <TableHead className="w-20 text-center">ঋণ নং</TableHead>
                <TableHead>সদস্য</TableHead>
                <TableHead>নোট</TableHead>
                <TableHead className="font-mono text-xs">রিসিপ্ট নং</TableHead>
                <TableHead className="text-right">পরিমাণ</TableHead>

                <TableHead className="w-36 text-center">কার্যক্রম</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">কোনো রিসিপ্ট পাওয়া যায়নি</TableCell></TableRow>
              ) : rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="text-center text-muted-foreground">{toBn(i + 1)}</TableCell>
                  <TableCell>{fmtDate(r.date)}</TableCell>
                  <TableCell className="text-center font-semibold">{toBn(r.loanNo)}</TableCell>
                  <TableCell className="font-medium">{r.memberName} <span className="text-xs text-muted-foreground">(ঋণ নং {toBn(r.loanNo)})</span></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.note || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.receiptNo}</TableCell>
                  <TableCell className="text-right font-semibold text-success">{formatTk(r.amount)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" title="রিসিপ্ট দেখুন" onClick={() => openReceipt(r)}>
                        <Receipt className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" title="সম্পাদনা" onClick={() => { setEditId(r.id); setEditForm({ amount: String(r.amount), date: r.date, note: r.note }); }}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" title="বাতিল/মুছে ফেলুন" onClick={() => setDeleteId(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {rows.length > 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-right font-semibold">মোট</TableCell>
                  <TableCell className="text-right font-bold">{formatTk(total)}</TableCell>
                  <TableCell />
                </TableRow>
              )}

            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>কিস্তি রিসিপ্ট</DialogTitle></DialogHeader>
          {receipt && (
            <div className="border rounded-md p-4 text-sm bg-card">
              <div className="flex items-center justify-center gap-3 mb-3">
                {receipt.logo && (
                  <img src={receipt.logo} alt="logo" className="h-12 w-12 object-contain rounded" />
                )}
                <div className="text-center">
                  <div className="text-lg font-bold">{data.samitiName || "সমিতি"}</div>
                  <div className="text-xs text-muted-foreground">কিস্তি প্রাপ্তি রিসিপ্ট</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">রিসিপ্ট নং:</span> <span className="font-medium">{receipt.receiptNo}</span></div>
                <div><span className="text-muted-foreground">তারিখ:</span> <span className="font-medium">{fmtDate(receipt.date)}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">সদস্য:</span> <span className="font-medium">{receipt.memberName}{receipt.loanNo ? ` (ঋণ নং ${toBn(receipt.loanNo)})` : ""}</span></div>
                <div><span className="text-muted-foreground">ঋণ মূল:</span> {formatTk(receipt.loan.amount)}</div>
                <div><span className="text-muted-foreground">মেয়াদ:</span> {toBn(receipt.loan.durationMonths)} মাস</div>
              </div>
              <div className="mt-3 border-t pt-2 flex justify-between text-base">
                <span className="font-medium">প্রাপ্ত কিস্তি</span>
                <span className="font-bold text-success">{formatTk(receipt.amount)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">মোট পরিশোধিত:</span> <span className="font-medium">{formatTk(receipt.paidAfter)}</span></div>
                <div><span className="text-muted-foreground">অবশিষ্ট বকেয়া:</span> <span className="font-semibold text-destructive">{formatTk(receipt.remainingAfter)}</span></div>
              </div>
              {receipt.note && (
                <div className="mt-3 text-sm border-t pt-2">
                  <span className="text-muted-foreground">নোট:</span> <span className="font-medium whitespace-pre-wrap">{receipt.note}</span>
                </div>
              )}
              <ReceiptQrPreview text={buildQrText({
                memberName: receipt.memberName, memberSerial: receipt.memberSerial,
                loanNo: receipt.loanNo, date: receipt.date, amount: receipt.amount,
              })} />
              <div className="mt-6 flex justify-between text-xs text-muted-foreground">
                <div>—————————<br />গ্রহীতা</div>
                <TreasurerSignBlock committee={data.settings.committee} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setReceipt(null)}>বন্ধ</Button>
            <Button variant="secondary" onClick={async () => {
              if (!receipt) return;
              try {
                toast.loading("ছবি তৈরি হচ্ছে...", { id: "rhjpg" });
                const canvas = await renderReceiptCanvas(receipt, data.samitiName || "সমিতি", findTreasurer(data.settings.committee));
                const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.95));
                if (!blob) throw new Error("blob");
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `রিসিপ্ট-${receipt.receiptNo}.jpg`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                toast.success("JPEG ডাউনলোড হয়েছে", { id: "rhjpg" });
              } catch (e) {
                console.error(e);
                toast.error("ডাউনলোড ব্যর্থ হয়েছে", { id: "rhjpg" });
              }
            }}><ImageDown className="h-4 w-4 mr-1" />JPEG ডাউনলোড</Button>
            <Button variant="secondary" onClick={async () => {
              if (!receipt) return;
              const text = `কিস্তি রিসিপ্ট\nসমিতি: ${data.samitiName || "সমিতি"}\nরিসিপ্ট নং: ${receipt.receiptNo}\nতারিখ: ${fmtDate(receipt.date)}\nসদস্য: ${receipt.memberName}${receipt.loanNo ? ` (ঋণ নং ${toBn(receipt.loanNo)})` : ""}\nপ্রাপ্ত কিস্তি: ${formatTk(receipt.amount)}\nমোট পরিশোধিত: ${formatTk(receipt.paidAfter)}\nঅবশিষ্ট বকেয়া: ${formatTk(receipt.remainingAfter)}`;
              try {
                toast.loading("শেয়ার প্রস্তুত হচ্ছে...", { id: "rhshare" });
                const canvas = await renderReceiptCanvas(receipt, data.samitiName || "সমিতি", findTreasurer(data.settings.committee));
                const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.95));
                toast.dismiss("rhshare");
                const file = blob ? new File([blob], `রিসিপ্ট-${receipt.receiptNo}.jpg`, { type: "image/jpeg" }) : null;
                const nav: any = navigator;
                if (file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
                  try { await nav.share({ title: "কিস্তি রিসিপ্ট", text, files: [file] }); return; } catch (e: any) {
                    if (e?.name === "AbortError") return;
                  }
                }
                if (nav.share) {
                  try { await nav.share({ title: "কিস্তি রিসিপ্ট", text }); return; } catch (e: any) {
                    if (e?.name === "AbortError") return;
                  }
                }
                await navigator.clipboard.writeText(text);
                toast.success("রিসিপ্টের তথ্য কপি হয়েছে");
              } catch (e) {
                console.error(e);
                try { await navigator.clipboard.writeText(text); toast.success("রিসিপ্টের তথ্য কপি হয়েছে", { id: "rhshare" }); }
                catch { toast.error("শেয়ার ব্যর্থ হয়েছে", { id: "rhshare" }); }
              }
            }}><Share className="h-4 w-4 mr-1" />শেয়ার</Button>
            <Button onClick={async () => {
              if (!receipt) return;
              const qrDataUrl = await buildInstallmentQr(receipt, data.samitiName || "সমিতি");
              const html = buildReceiptHtml(receipt, data.samitiName || "সমিতি", qrDataUrl, findTreasurer(data.settings.committee));
              const w = window.open("", "_blank", "width=600,height=800");
              if (!w) return;
              w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>রিসিপ্ট</title><style>${receiptCss}</style></head><body>${html}<script>setTimeout(()=>window.print(),300)</script></body></html>`);
              w.document.close();
              w.focus();
            }}><Printer className="h-4 w-4 mr-1" />প্রিন্ট</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>কিস্তি সম্পাদনা</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>পরিমাণ (টাকা) *</Label><Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} /></div>
            <div><Label>তারিখ</Label><Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></div>
            <div><Label>মন্তব্য</Label><Input value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>বাতিল</Button>
            <Button onClick={() => {
              if (!editId) return;
              const amt = Number(editForm.amount);
              if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
              updatePayment(editId, { amount: amt, date: editForm.date, note: editForm.note });
              setEditId(null);
              toast.success("কিস্তি আপডেট হয়েছে");
            }}>সংরক্ষণ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>কিস্তি বাতিল করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const r = rows.find((x) => x.id === deleteId);
                return r ? (
                  <>
                    <span className="font-medium text-foreground">{r.memberName}</span> (ঋণ নং {toBn(r.loanNo)}) — {formatTk(r.amount)} ({fmtDate(r.date)})।
                    <br />এই কিস্তিটি স্থায়ীভাবে মুছে যাবে এবং ঋণের বকেয়া হিসেবে যোগ হবে। এই কাজটি ফেরানো যাবে না।
                  </>
                ) : "এই কিস্তিটি স্থায়ীভাবে মুছে যাবে।";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!deleteId) return;
              deletePayment(deleteId);
              setDeleteId(null);
              toast.success("কিস্তি বাতিল করা হয়েছে");
            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">হ্যাঁ, বাতিল করুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}


function DepositsHistoryTab() {
  const { data, updateDeposit, deleteDeposit } = useSamiti();
  const [q, setQ] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ memberId: "", amount: "", date: today(), note: "" });
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<null | DepositReceiptData>(null);

  const openReceipt = (r: { id: string; memberId: string; memberName: string; memberSerial: number; amount: number; date: string; note: string; depositNo: number }) => {
    const memberDeposits = data.deposits.filter((d) => d.memberId === r.memberId);
    const totalAfter = memberDeposits
      .filter((d) => d.date < r.date || (d.date === r.date && d.id <= r.id))
      .reduce((s, d) => s + d.amount, 0);
    setReceipt({
      memberName: r.memberName,
      memberSerial: r.memberSerial,
      amount: r.amount,
      date: r.date,
      totalAfter,
      receiptNo: `CH-${toBn(r.memberSerial ?? 0)}-${toBn(r.depositNo)}`,
      note: r.note,
      logo: data.samitiLogo,
    });
  };


  const rows = useMemo(() => {
    const memberById = new Map(data.members.map((m) => [m.id, m]));
    const seqByDepositId = new Map<string, number>();
    const counters = new Map<string, number>();
    [...data.deposits]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1))
      .forEach((d) => {
        const n = (counters.get(d.memberId) ?? 0) + 1;
        counters.set(d.memberId, n);
        seqByDepositId.set(d.id, n);
      });
    return [...data.deposits]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((d) => {
        const member = memberById.get(d.memberId);
        return {
          id: d.id,
          memberId: d.memberId,
          date: d.date,
          depositNo: seqByDepositId.get(d.id) ?? 1,
          memberName: member?.name ?? "—",
          memberSerial: member?.serial ?? 0,
          amount: d.amount,
          note: d.note ?? "",
        };
      })
      .filter((r) => {
        if (q.trim()) {
          const s = q.toLowerCase();
          const ok = (
            r.memberName.toLowerCase().includes(s) ||
            String(r.memberSerial).includes(s) ||
            toBn(r.memberSerial).includes(s) ||
            r.note.toLowerCase().includes(s)
          );
          if (!ok) return false;
        }
        const mn = Number(minAmount);
        const mx = Number(maxAmount);
        if (minAmount && !isNaN(mn) && r.amount < mn) return false;
        if (maxAmount && !isNaN(mx) && r.amount > mx) return false;
        if (monthFilter !== "all" && r.date.slice(0, 7) !== monthFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "amount_desc") return b.amount - a.amount;
        if (sortBy === "amount_asc") return a.amount - b.amount;
        if (sortBy === "date_asc") return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
        return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      });
  }, [data, q, minAmount, maxAmount, sortBy, monthFilter]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    data.deposits.forEach((d) => set.add(d.date.slice(0, 7)));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [data.deposits]);

  const fmtMonth = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    const names = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${names[(m || 1) - 1]} ${y}`;
  };

  const total = rows.reduce((s, r) => s + r.amount, 0);

  const missingMembers = useMemo(() => {
    if (monthFilter === "all") return [];
    const paidIds = new Set(rows.map((r) => r.memberId));
    return [...data.members]
      .filter((m) => !paidIds.has(m.id))
      .sort((a, b) => (a.serial || 0) - (b.serial || 0));
  }, [rows, data.members, monthFilter]);

  const paidMembersList = useMemo(() => {
    if (monthFilter === "all") return [];
    const totals = new Map<string, number>();
    rows.forEach((r) => totals.set(r.memberId, (totals.get(r.memberId) || 0) + r.amount));
    return [...data.members]
      .filter((m) => totals.has(m.id))
      .sort((a, b) => (a.serial || 0) - (b.serial || 0))
      .map((m) => ({ ...m, paidAmount: totals.get(m.id) || 0 }));
  }, [rows, data.members, monthFilter]);

  const startEdit = (r: { id: string; memberId: string; amount: number; date: string; note: string }) => {
    setEditId(r.id);
    setEditForm({ memberId: r.memberId, amount: String(r.amount), date: r.date, note: r.note });
  };

  const submitEdit = () => {
    if (!editId) return;
    if (!editForm.memberId) { toast.error("সদস্য নির্বাচন করুন"); return; }
    const amt = Number(editForm.amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    updateDeposit(editId, { memberId: editForm.memberId, amount: amt, date: editForm.date, note: editForm.note });
    setEditId(null);
    toast.success("জমা আপডেট হয়েছে");
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteDeposit(deleteId);
    setDeleteId(null);
    toast.success("জমা বাতিল করা হয়েছে");
  };

  const selectedEditMember = data.members.find((m) => m.id === editForm.memberId);
  const deletingRow = rows.find((r) => r.id === deleteId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">চাঁদা জমা ইতিহাস</h2>
          <p className="text-sm text-muted-foreground">সকল সঞ্চয়/চাদা জমার তালিকা</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="সদস্য / সদস্য নং / নোট খুঁজুন" className="pl-9" />
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">সর্বনিম্ন পরিমাণ</Label>
          <Input type="number" inputMode="numeric" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="০" />
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">সর্বোচ্চ পরিমাণ</Label>
          <Input type="number" inputMode="numeric" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="∞" />
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">সাজান</Label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">তারিখ (নতুন → পুরাতন)</SelectItem>
              <SelectItem value="date_asc">তারিখ (পুরাতন → নতুন)</SelectItem>
              <SelectItem value="amount_desc">পরিমাণ (বেশি → কম)</SelectItem>
              <SelectItem value="amount_asc">পরিমাণ (কম → বেশি)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">মাস</Label>
          <div className="flex gap-1">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger><SelectValue placeholder="সকল মাস" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সকল মাস</SelectItem>
                {monthOptions.map((ym) => (
                  <SelectItem key={ym} value={ym}>{fmtMonth(ym)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" type="button" aria-label="ক্যালেন্ডার থেকে মাস বাছুন">
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  captionLayout="dropdown"
                  selected={monthFilter !== "all" ? new Date(monthFilter + "-01") : undefined}
                  onSelect={(d: Date | undefined) => {
                    if (d) {
                      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                      setMonthFilter(ym);
                    }
                  }}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {(minAmount || maxAmount || sortBy !== "date_desc" || monthFilter !== "all") && (
          <Button variant="outline" onClick={() => { setMinAmount(""); setMaxAmount(""); setSortBy("date_desc"); setMonthFilter("all"); }}>রিসেট</Button>
        )}
      </div>

      {monthFilter !== "all" && (paidMembersList.length > 0 || missingMembers.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {paidMembersList.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => {
              const w = window.open("", "_blank"); if (!w) return;
              const rowsHtml = paidMembersList.map((m, i) => `<tr><td style="text-align:center">${toBn(i+1)}</td><td style="text-align:center">${toBn(m.serial || 0)}</td><td>${m.name}</td><td style="text-align:right">${formatTk(m.paidAmount)}</td></tr>`).join("");
              const totalPaid = paidMembersList.reduce((s, m) => s + m.paidAmount, 0);
              w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>পরিশোধিত তালিকা - ${fmtMonth(monthFilter)}</title><style>body{font-family:"Segoe UI","Noto Sans Bengali",sans-serif;padding:20px;position:relative;}h3{text-align:center;margin:4px 0;color:#047857;}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #ccc;padding:6px 8px;font-size:13px;}th{background:#d1fae5;}@media print{.no-print{display:none;}body{padding:0 12px;}}${printBrandCss}</style></head><body>${printWatermark(data.samitiLogo)}<div class="ps-content"><div class="no-print" style="margin-bottom:12px;text-align:center;"><button onclick="window.print()" style="padding:8px 16px;cursor:pointer;">প্রিন্ট করুন</button></div>${printHeader(data.samitiName, data.samitiLogo, `✓ ${fmtMonth(monthFilter)} মাসে পরিশোধিত সদস্য তালিকা (${toBn(paidMembersList.length)} জন)`, data.samitiAddress, data.establishedDate)}<table><thead><tr><th>ক্রম</th><th>সদস্য নং</th><th>নাম</th><th>পরিমাণ</th></tr></thead><tbody>${rowsHtml}<tr><td colspan="3" style="text-align:right;font-weight:bold">মোট</td><td style="text-align:right;font-weight:bold">${formatTk(totalPaid)}</td></tr></tbody></table></div><script>setTimeout(()=>window.print(),300)</script></body></html>`);
              w.document.close();
            }}>
              <Printer className="h-4 w-4 mr-1" />পরিশোধিত তালিকা প্রিন্ট
            </Button>
          )}
          {missingMembers.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => {
              const w = window.open("", "_blank"); if (!w) return;
              const rowsHtml = missingMembers.map((m, i) => `<tr><td style="text-align:center">${toBn(i+1)}</td><td style="text-align:center">${toBn(m.serial || 0)}</td><td>${m.name}</td><td style="text-align:center;color:#b91c1c;font-weight:bold">জমা হয়নি</td></tr>`).join("");
              w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>বকেয়া তালিকা - ${fmtMonth(monthFilter)}</title><style>body{font-family:"Segoe UI","Noto Sans Bengali",sans-serif;padding:20px;position:relative;}h3{text-align:center;margin:4px 0;color:#b91c1c;}table{width:100%;border-collapse:collapse;margin-top:12px;}th,td{border:1px solid #ccc;padding:6px 8px;font-size:13px;}th{background:#fee2e2;}@media print{.no-print{display:none;}body{padding:0 12px;}}${printBrandCss}</style></head><body>${printWatermark(data.samitiLogo)}<div class="ps-content"><div class="no-print" style="margin-bottom:12px;text-align:center;"><button onclick="window.print()" style="padding:8px 16px;cursor:pointer;">প্রিন্ট করুন</button></div>${printHeader(data.samitiName, data.samitiLogo, `⚠ ${fmtMonth(monthFilter)} মাসে যাদের চাঁদা জমা হয়নি (${toBn(missingMembers.length)} জন)`, data.samitiAddress, data.establishedDate)}<table><thead><tr><th>ক্রম</th><th>সদস্য নং</th><th>নাম</th><th>অবস্থা</th></tr></thead><tbody>${rowsHtml}</tbody></table></div><script>setTimeout(()=>window.print(),300)</script></body></html>`);
              w.document.close();
            }}>
              <Printer className="h-4 w-4 mr-1" />বকেয়া তালিকা প্রিন্ট
            </Button>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">ক্রম</TableHead>
                <TableHead>তারিখ</TableHead>
                <TableHead className="w-32 text-center">রিসিপ্ট নং</TableHead>
                <TableHead>সদস্য</TableHead>
                <TableHead>নোট</TableHead>
                <TableHead className="text-right">পরিমাণ</TableHead>
                <TableHead className="w-36 text-center">কার্যক্রম</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">কোনো জমা পাওয়া যায়নি</TableCell></TableRow>
              ) : rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="text-center text-muted-foreground">{toBn(i + 1)}</TableCell>
                  <TableCell>{fmtDate(r.date)}</TableCell>
                  <TableCell className="text-center font-semibold">CH-{toBn(r.memberSerial)}-{toBn(r.depositNo)}</TableCell>
                  <TableCell className="font-medium">{r.memberName} <span className="text-xs text-muted-foreground">(সদস্য নং {toBn(r.memberSerial)})</span></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.note || "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-success">{formatTk(r.amount)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" title="রিসিপ্ট দেখুন" onClick={() => openReceipt(r)}>
                        <Receipt className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" title="সম্পাদনা" onClick={() => startEdit(r)}>
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" title="বাতিল/মুছে ফেলুন" onClick={() => setDeleteId(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                  </TableCell>
                </TableRow>
              ))}
              {rows.length > 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-semibold">মোট</TableCell>
                  <TableCell className="text-right font-bold">{formatTk(total)}</TableCell>
                  <TableCell />
                </TableRow>
              )}
              {missingMembers.length > 0 && (
                <>
                  <TableRow className="bg-destructive/10 hover:bg-destructive/10">
                    <TableCell colSpan={7} className="text-center font-semibold text-destructive py-2">
                      ⚠ {fmtMonth(monthFilter)} মাসে যাদের চাঁদা জমা হয়নি ({toBn(missingMembers.length)} জন)
                    </TableCell>
                  </TableRow>
                  {missingMembers.map((m, i) => (
                    <TableRow key={`missing-${m.id}`} className="bg-destructive/5 hover:bg-destructive/10">
                      <TableCell className="text-center">{toBn(i + 1)}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell className="text-center">—</TableCell>
                      <TableCell className="font-medium">
                        {m.name} <span className="text-xs">(সদস্য নং {toBn(m.serial || 0)})</span>
                      </TableCell>
                      <TableCell colSpan={2} className="text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">
                          ● জমা হয়নি
                        </span>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ))}
                </>
              )}
              {monthFilter !== "all" && paidMembersList.length > 0 && (
                <>
                  <TableRow className="bg-emerald-500/10 hover:bg-emerald-500/10">
                    <TableCell colSpan={7} className="text-center font-semibold text-emerald-700 dark:text-emerald-400 py-2">
                      ✓ {fmtMonth(monthFilter)} মাসে যাদের চাঁদা পরিশোধ হয়েছে ({toBn(paidMembersList.length)} জন)
                    </TableCell>
                  </TableRow>
                  {paidMembersList.map((m, i) => (
                    <TableRow key={`paid-${m.id}`} className="bg-emerald-500/5 hover:bg-emerald-500/10">
                      <TableCell className="text-center">{toBn(i + 1)}</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell className="text-center">—</TableCell>
                      <TableCell className="font-medium">
                        {m.name} <span className="text-xs">(সদস্য নং {toBn(m.serial || 0)})</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatTk(m.paidAmount)}</TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          ● পরিশোধ
                        </span>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>জমা সম্পাদনা</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>সদস্য *</Label>
              <Popover open={editMemberOpen} onOpenChange={setEditMemberOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedEditMember ? `${toBn(selectedEditMember.serial || 0)}. ${selectedEditMember.name}` : "সদস্য নির্বাচন করুন"}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                    <CommandInput placeholder="ক্রম বা নাম দিয়ে খুঁজুন..." />
                    <CommandList>
                      <CommandEmpty>কোনও সদস্য পাওয়া যায়নি</CommandEmpty>
                      <CommandGroup>
                        {data.members.map((m) => (
                          <CommandItem key={m.id} value={`${toBn(m.serial || 0)} ${m.serial} ${m.name} ${m.phone || ""}`} onSelect={() => { setEditForm({ ...editForm, memberId: m.id }); setEditMemberOpen(false); }}>
                            <Check className={cn("h-4 w-4", editForm.memberId === m.id ? "opacity-100" : "opacity-0")} />
                            {toBn(m.serial || 0)}. {m.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div><Label>পরিমাণ (টাকা) *</Label><Input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} /></div>
            <div><Label>তারিখ</Label><Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></div>
            <div><Label>মন্তব্য</Label><Input value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>বাতিল</Button>
            <Button onClick={submitEdit}>সংরক্ষণ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>জমা বাতিল করবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingRow ? (
                <>
                  <span className="font-medium text-foreground">{deletingRow.memberName}</span> (সদস্য নং {toBn(deletingRow.memberSerial)}) — {formatTk(deletingRow.amount)} ({fmtDate(deletingRow.date)})।
                  <br />এই জমাটি স্থায়ীভাবে মুছে যাবে এবং সদস্যের মোট সঞ্চয় থেকে বাদ পড়বে। এই কাজটি ফেরানো যাবে না।
                </>
              ) : "এই জমাটি স্থায়ীভাবে মুছে যাবে।"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>না</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">হ্যাঁ, বাতিল করুন</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>জমা রিসিপ্ট</DialogTitle></DialogHeader>
          {receipt && (
            <div id="deposit-receipt-history" className="border rounded-md p-4 text-sm bg-card">
              <div className="flex items-center justify-center gap-3 mb-3">
                {receipt.logo && (
                  <img src={receipt.logo} alt="logo" className="h-12 w-12 object-contain rounded" />
                )}
                <div className="text-center">
                  <div className="text-lg font-bold">{data.samitiName || "সমিতি"}</div>
                  <div className="text-xs text-muted-foreground">সঞ্চয়/চাদা জমা রিসিপ্ট</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">রিসিপ্ট নং:</span> <span className="font-medium">{receipt.receiptNo}</span></div>
                <div><span className="text-muted-foreground">তারিখ:</span> <span className="font-medium">{fmtDate(receipt.date)}</span></div>
                <div className="col-span-2"><span className="text-muted-foreground">সদস্য:</span> <span className="font-medium">{receipt.memberSerial ? `${toBn(receipt.memberSerial)}. ` : ""}{receipt.memberName}</span></div>
              </div>
              <div className="mt-3 border-t pt-2 flex justify-between text-base">
                <span className="font-medium">জমার পরিমাণ</span>
                <span className="font-bold text-success">{formatTk(receipt.amount)}</span>
              </div>
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">মোট সঞ্চয় (এই জমা পর্যন্ত):</span> <span className="font-semibold">{formatTk(receipt.totalAfter)}</span>
              </div>
              {receipt.note && (
                <div className="mt-3 text-sm border-t pt-2">
                  <span className="text-muted-foreground">নোট:</span> <span className="font-medium whitespace-pre-wrap">{receipt.note}</span>
                </div>
              )}
              <ReceiptQrPreview text={buildQrText({
                memberName: receipt.memberName, memberSerial: receipt.memberSerial,
                date: receipt.date, amount: receipt.amount,
              })} />
              <div className="mt-6 flex justify-between text-xs text-muted-foreground">
                <div>—————————<br />গ্রহীতা</div>
                <TreasurerSignBlock committee={data.settings.committee} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setReceipt(null)}>বন্ধ</Button>
            <Button variant="secondary" onClick={async () => {
              if (!receipt) return;
              try {
                toast.loading("ছবি তৈরি হচ্ছে...", { id: "djpg" });
                const canvas = await renderDepositReceiptCanvas(receipt, data.samitiName || "সমিতি", findTreasurer(data.settings.committee));
                const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.95));
                if (!blob) throw new Error("blob");
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `জমা-রিসিপ্ট-${receipt.receiptNo}.jpg`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                toast.success("JPEG ডাউনলোড হয়েছে", { id: "djpg" });
              } catch (e) {
                console.error(e);
                toast.error("ডাউনলোড ব্যর্থ হয়েছে", { id: "djpg" });
              }
            }}><ImageDown className="h-4 w-4 mr-1" />JPEG ডাউনলোড</Button>
            <Button variant="secondary" onClick={async () => {
              if (!receipt) return;
              const text = `জমা রিসিপ্ট\nসমিতি: ${data.samitiName || "সমিতি"}\nরিসিপ্ট নং: ${receipt.receiptNo}\nতারিখ: ${fmtDate(receipt.date)}\nসদস্য: ${receipt.memberSerial ? `${toBn(receipt.memberSerial)}. ` : ""}${receipt.memberName}\nজমার পরিমাণ: ${formatTk(receipt.amount)}\nমোট সঞ্চয়: ${formatTk(receipt.totalAfter)}`;
              try {
                toast.loading("শেয়ার প্রস্তুত হচ্ছে...", { id: "dshare" });
                const canvas = await renderDepositReceiptCanvas(receipt, data.samitiName || "সমিতি", findTreasurer(data.settings.committee));
                const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.95));
                toast.dismiss("dshare");
                const file = blob ? new File([blob], `জমা-রিসিপ্ট-${receipt.receiptNo}.jpg`, { type: "image/jpeg" }) : null;
                const nav: any = navigator;
                if (file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
                  try { await nav.share({ title: "জমা রিসিপ্ট", text, files: [file] }); return; } catch (e: any) {
                    if (e?.name === "AbortError") return;
                  }
                }
                if (nav.share) {
                  try { await nav.share({ title: "জমা রিসিপ্ট", text }); return; } catch (e: any) {
                    if (e?.name === "AbortError") return;
                  }
                }
                await navigator.clipboard.writeText(text);
                toast.success("রিসিপ্টের তথ্য কপি হয়েছে");
              } catch (e) {
                console.error(e);
                try { await navigator.clipboard.writeText(text); toast.success("রিসিপ্টের তথ্য কপি হয়েছে", { id: "dshare" }); }
                catch { toast.error("শেয়ার ব্যর্থ হয়েছে", { id: "dshare" }); }
              }
            }}><Share className="h-4 w-4 mr-1" />শেয়ার</Button>
            <Button onClick={async () => {
              if (!receipt) return;
              const qrDataUrl = await buildDepositQr(receipt, data.samitiName || "সমিতি");
              const html = buildDepositReceiptHtml(receipt, data.samitiName || "সমিতি", qrDataUrl, findTreasurer(data.settings.committee));
              const w = window.open("", "_blank", "width=600,height=800");
              if (!w) return;
              w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>জমা রিসিপ্ট</title><style>${receiptCss}</style></head><body>${html}<script>setTimeout(()=>window.print(),300)</script></body></html>`);
              w.document.close();
              w.focus();
            }}><Printer className="h-4 w-4 mr-1" />প্রিন্ট</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}

const INCOME_CATS = ["সদস্য ফি", "ভর্তি ফি", "অনুদান", "মুনাফা আয়", "ঋণ আবেদন", "অন্যান্য"];
const EXPENSE_CATS = ["স্টেশনারি", "মিটিং খরচ", "যাতায়াত", "ভাড়া", "বিল", "অন্যান্য"];

function CashbookTab() {
  const { data, addTransaction, deleteTransaction } = useSamiti();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ type: "income" | "expense"; category: string; customCategory: string; amount: string; date: string; note: string }>({
    type: "income", category: "", customCategory: "", amount: "", date: today(), note: "",
  });

  const submit = () => {
    if (!form.category) { toast.error("ধরন নির্বাচন করুন"); return; }
    const finalCat = form.category === "অন্যান্য" ? form.customCategory.trim() : form.category;
    if (form.category === "অন্যান্য" && !finalCat) { toast.error("খাতের নাম লিখুন"); return; }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    addTransaction({ type: form.type, category: finalCat, amount: amt, date: form.date, note: form.note });
    setForm({ type: "income", category: "", customCategory: "", amount: "", date: today(), note: "" });
    setOpen(false);
    toast.success("সংরক্ষিত হয়েছে");
  };

  const income = data.transactions.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
  const expense = data.transactions.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
  const cats = form.type === "income" ? INCOME_CATS : EXPENSE_CATS;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="মোট আয়" value={formatTk(income)} accent="bg-success" />
        <StatCard label="মোট ব্যয়" value={formatTk(expense)} accent="bg-destructive" />
        <StatCard label="অবশিষ্ট" value={formatTk(income - expense)} accent="bg-primary" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>আয়-ব্যয় খতিয়ান</CardTitle>
            <CardDescription>মোট {toBn(data.transactions.length)}টি লেনদেন</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />নতুন লেনদেন</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>আয় বা ব্যয় যোগ করুন</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={form.type === "income" ? "default" : "outline"} onClick={() => setForm({ ...form, type: "income", category: "", customCategory: "" })}>
                    <TrendingUp className="h-4 w-4 mr-1" />আয়
                  </Button>
                  <Button type="button" variant={form.type === "expense" ? "default" : "outline"} onClick={() => setForm({ ...form, type: "expense", category: "", customCategory: "" })}>
                    <TrendingDown className="h-4 w-4 mr-1" />ব্যয়
                  </Button>
                </div>
                <div>
                  <Label>ধরন *</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, customCategory: v === "অন্যান্য" ? form.customCategory : "" })}>
                    <SelectTrigger><SelectValue placeholder="ধরন নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {form.category === "অন্যান্য" && (
                  <div><Label>খাতের নাম *</Label><Input value={form.customCategory} onChange={(e) => setForm({ ...form, customCategory: e.target.value })} placeholder="খাতের নাম লিখুন" /></div>
                )}
                <div><Label>পরিমাণ *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div><Label>তারিখ</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div><Label>মন্তব্য</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={submit}>সংরক্ষণ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {data.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">এখনও কোনও লেনদেন নেই।</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>তারিখ</TableHead><TableHead>ধরন</TableHead><TableHead>খাত</TableHead>
                  <TableHead>মন্তব্য</TableHead><TableHead className="text-right">পরিমাণ</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{fmtDate(t.date)}</TableCell>
                    <TableCell>
                      {t.type === "income"
                        ? <Badge className="bg-success text-success-foreground">আয়</Badge>
                        : <Badge variant="destructive">ব্যয়</Badge>}
                    </TableCell>
                    <TableCell className="font-medium">{t.category}</TableCell>
                    <TableCell className="text-muted-foreground">{t.note || "—"}</TableCell>
                    <TableCell className={`text-right font-semibold ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                      {t.type === "income" ? "+" : "−"} {formatTk(t.amount)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { deleteTransaction(t.id); toast.success("মুছে ফেলা হয়েছে"); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Settings =====
function SettingsTab() {
  // RoleManager self-gates: shows bootstrap, full panel, or nothing based on server state.
  const { data, updateSamitiInfo, updateSettings, resetAll, importData } = useSamiti();
  const [name, setName] = useState(data.samitiName);
  const [address, setAddress] = useState(data.samitiAddress || "");
  const [estDate, setEstDate] = useState(data.establishedDate || "");
  const [serialPrefix, setSerialPrefix] = useState(data.serialPrefix || "");
  const [logo, setLogo] = useState(data.samitiLogo || "");
  const [rate, setRate] = useState(String(data.settings.defaultInterestRate));
  const [dur, setDur] = useState(String(data.settings.defaultDurationMonths));
  const [notice, setNotice] = useState(data.settings.notice || "");
  const [goals, setGoals] = useState<Goal[]>(data.settings.goals && data.settings.goals.length > 0 ? data.settings.goals : DEFAULT_GOALS);
  const [quotes, setQuotes] = useState<Quote[]>(data.settings.quotes && data.settings.quotes.length > 0 ? data.settings.quotes : DEFAULT_QUOTES);
  const [messages, setMessages] = useState<Message[]>(data.settings.messages && data.settings.messages.length > 0 ? data.settings.messages : DEFAULT_MESSAGES);
  const [messagesSectionTitle, setMessagesSectionTitle] = useState(data.settings.messagesSectionTitle || "");
  const [committee, setCommittee] = useState<CommitteeMember[]>(data.settings.committee || []);
  const [committeeSectionTitle, setCommitteeSectionTitle] = useState(data.settings.committeeSectionTitle || "");
  const [committeeSectionSubtitle, setCommitteeSectionSubtitle] = useState(data.settings.committeeSectionSubtitle || "");
  const [splashEnabled, setSplashEnabled] = useState<boolean>(data.settings.splashEnabled !== false);
  const [splashTitle, setSplashTitle] = useState(data.settings.splashTitle || "");
  const [splashSubtitle, setSplashSubtitle] = useState(data.settings.splashSubtitle || "");
  const [splashIcon, setSplashIcon] = useState(data.settings.splashIcon || "");
  const [splashImage, setSplashImage] = useState(data.settings.splashImage || "");
  const [splashImageSize, setSplashImageSize] = useState<number>(data.settings.splashImageSize || 96);
  const [splashFooter, setSplashFooter] = useState(data.settings.splashFooter || "");
  const [goalsSectionTitle, setGoalsSectionTitle] = useState(data.settings.goalsSectionTitle || "");
  const [goalsSectionSubtitle, setGoalsSectionSubtitle] = useState(data.settings.goalsSectionSubtitle || "");
  const [quotesSectionTitle, setQuotesSectionTitle] = useState(data.settings.quotesSectionTitle || "");
  const [confirmReset, setConfirmReset] = useState(false);

  const onLogo = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("লোগো ২ MB এর কম হতে হবে"); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const saveGeneral = () => {
    updateSamitiInfo({
      samitiName: name.trim() || "আমাদের সমিতি",
      samitiAddress: address.trim(),
      establishedDate: estDate,
      serialPrefix: serialPrefix.trim().toUpperCase(),
      samitiLogo: logo,
    });
    updateSettings({
      defaultInterestRate: Number(rate) || 0,
      defaultDurationMonths: Number(dur) || 12,
      notice: notice.trim(),
      goals: goals.map((g) => ({ icon: g.icon.trim(), title: g.title.trim(), desc: g.desc.trim() })).filter((g) => g.title || g.desc),
      quotes: quotes.map((q) => ({ bn: q.bn.trim(), en: q.en.trim() })).filter((q) => q.bn || q.en),
      splashEnabled,
      splashTitle: splashTitle.trim(),
      splashSubtitle: splashSubtitle.trim(),
      splashIcon: splashIcon.trim(),
      splashImage: splashImage,
      splashImageSize: splashImageSize,
      splashFooter: splashFooter.trim(),
      goalsSectionTitle: goalsSectionTitle.trim(),
      goalsSectionSubtitle: goalsSectionSubtitle.trim(),
      quotesSectionTitle: quotesSectionTitle.trim(),
      messages: messages.map((m) => ({ role: m.role.trim(), name: m.name.trim(), photo: m.photo || "", message: m.message.trim() })).filter((m) => m.name || m.message || m.role),
      messagesSectionTitle: messagesSectionTitle.trim(),
      committee: committee.map((c) => ({ role: c.role.trim(), name: c.name.trim(), phone: c.phone.trim(), photo: c.photo || "", signature: c.signature || "" })).filter((c) => c.role || c.name || c.phone),
      committeeSectionTitle: committeeSectionTitle.trim(),
      committeeSectionSubtitle: committeeSectionSubtitle.trim(),
    });
    toast.success("সেটিংস সংরক্ষিত হয়েছে");
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `samiti-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ব্যাকআপ ডাউনলোড হয়েছে");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        importData(parsed);
        toast.success("তথ্য পুনরুদ্ধার হয়েছে");
      } catch {
        toast.error("ফাইল পড়া যায়নি");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>সমিতির তথ্য</CardTitle>
          <CardDescription>লোগো, নাম, ঠিকানা ও স্থাপিত তারিখ — সকল রিপোর্টের হেডারে ব্যবহৃত হবে</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-lg border bg-muted overflow-hidden flex items-center justify-center shrink-0">
              {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">লোগো</span>}
            </div>
            <div className="space-y-2 flex-1">
              <Label>সমিতির লোগো</Label>
              <Input type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0])} />
              {logo && <Button type="button" variant="ghost" size="sm" onClick={() => setLogo("")}>লোগো সরান</Button>}
            </div>
          </div>
          <div><Label>সমিতির নাম</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>সমিতির ঠিকানা</Label><Textarea value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div><Label>স্থাপিত</Label><Input value={estDate} onChange={(e) => setEstDate(e.target.value)} placeholder="যেমন: ২০১৫ সাল" /></div>
          <div><Label>সিরিয়াল উপসর্গ (Prefix)</Label><Input value={serialPrefix} onChange={(e) => setSerialPrefix(e.target.value.toUpperCase())} maxLength={5} placeholder="যেমন: SK — সদস্য সিরিয়াল হবে SKA1, SKB26 …" /></div>
          <div><Label>ঋণের ডিফল্ট মুনাফার হার (% বার্ষিক)</Label><Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          <div><Label>ঋণের ডিফল্ট মেয়াদ (মাস)</Label><Input type="number" value={dur} onChange={(e) => setDur(e.target.value)} /></div>
          <div>
            <Label>ড্যাশবোর্ড নোটিশ (স্ক্রলিং)</Label>
            <Textarea value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="যেমন: আগামী শনিবার মাসিক সভা — সবাইকে উপস্থিত থাকার অনুরোধ।" rows={3} />
            <p className="text-[11px] text-muted-foreground mt-1">খালি রাখলে ডিফল্ট স্বাগত বার্তা দেখাবে।</p>
          </div>
          <Button onClick={saveGeneral} className="w-full">সংরক্ষণ</Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>ইন্ট্রো / পরিচিতি পেজ কন্ট্রোল</CardTitle>
          <CardDescription>লগইন এর আগে দেখানো পরিচিতি পেজের সব টেক্সট ও আইকন এডিট করুন</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">পরিচিতি পেজ চালু রাখুন</Label>
              <p className="text-[11px] text-muted-foreground mt-1">বন্ধ করলে লগইন পেজ সরাসরি দেখাবে</p>
            </div>
            <Switch checked={splashEnabled} onCheckedChange={setSplashEnabled} />
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <Label className="text-sm">হেডার লোগো / আইকন</Label>
            <div className="flex items-start gap-4">
              <div
                className="shrink-0 rounded-full bg-gradient-to-br from-emerald-500 to-sky-600 text-white shadow-md overflow-hidden flex items-center justify-center"
                style={{ height: splashImageSize, width: splashImageSize, fontSize: Math.round(splashImageSize * 0.42) }}
              >
                {splashImage ? (
                  <img src={splashImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>{splashIcon || "🌾"}</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 2 * 1024 * 1024) { toast.error("ছবি ২ MB এর কম হতে হবে"); return; }
                    const r = new FileReader();
                    r.onload = () => setSplashImage(String(r.result || ""));
                    r.readAsDataURL(f);
                  }}
                />
                {splashImage && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSplashImage("")}>লোগো সরান (ইমোজি ব্যবহার হবে)</Button>
                )}
                <div>
                  <Label className="text-xs">ইমোজি আইকন (লোগো না থাকলে)</Label>
                  <Input value={splashIcon} onChange={(e) => setSplashIcon(e.target.value)} placeholder="🌾" />
                </div>
                <div>
                  <Label className="text-xs">আকার (পিক্সেল): {splashImageSize}px</Label>
                  <input
                    type="range"
                    min={48}
                    max={240}
                    step={4}
                    value={splashImageSize}
                    onChange={(e) => setSplashImageSize(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs">সমিতির নাম (শিরোনাম)</Label>
            <Input value={splashTitle} onChange={(e) => setSplashTitle(e.target.value)} placeholder="স্বপ্ন কুড়ি বন্ধন সমিতি" />
          </div>

          <div>
            <Label className="text-xs">সাবটাইটেল (স্থাপিত · স্লোগান)</Label>
            <Input value={splashSubtitle} onChange={(e) => setSplashSubtitle(e.target.value)} placeholder="স্থাপিত: ডিসেম্বর ২০২৫ · একতাই শক্তি, একতাই বল" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">লক্ষ্য সেকশনের শিরোনাম</Label>
              <Input value={goalsSectionTitle} onChange={(e) => setGoalsSectionTitle(e.target.value)} placeholder="আমাদের লক্ষ্য ও উদ্দেশ্য" />
            </div>
            <div>
              <Label className="text-xs">বাণী সেকশনের শিরোনাম</Label>
              <Input value={quotesSectionTitle} onChange={(e) => setQuotesSectionTitle(e.target.value)} placeholder="অনুপ্রেরণামূলক বাণী" />
            </div>
          </div>
          <div>
            <Label className="text-xs">লক্ষ্য সেকশনের সাব-বর্ণনা</Label>
            <Input value={goalsSectionSubtitle} onChange={(e) => setGoalsSectionSubtitle(e.target.value)} placeholder="সদস্যদের কল্যাণ ও আর্থিক স্বনির্ভরতাই আমাদের মূল লক্ষ্য" />
          </div>
          <div>
            <Label className="text-xs">বাণী (প্রতিষ্ঠাতা/সভাপতি/সম্পাদক) সেকশনের শিরোনাম</Label>
            <Input value={messagesSectionTitle} onChange={(e) => setMessagesSectionTitle(e.target.value)} placeholder="প্রতিষ্ঠাতা, সভাপতি ও সাধারণ সম্পাদকের বাণী" />
          </div>
          <div>
            <Label className="text-xs">ফুটার লেখা</Label>
            <Input value={splashFooter} onChange={(e) => setSplashFooter(e.target.value)} placeholder={`© ${new Date().getFullYear()} স্বপ্ন কুড়ি বন্ধন সমিতি`} />
          </div>
          <Button onClick={saveGeneral} className="w-full">সংরক্ষণ</Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">

        <CardHeader>
          <CardTitle>লক্ষ্য ও উদ্দেশ্য (ইন্ট্রো পেজ)</CardTitle>
          <CardDescription>লগইন আগের পরিচিতি পেজে দেখানো লক্ষ্যসমূহ এডিট করুন</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {goals.map((g, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[80px_1fr_2fr_auto] items-start border rounded-md p-3">
              <div>
                <Label className="text-xs">আইকন</Label>
                <Input value={g.icon} onChange={(e) => setGoals(goals.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))} placeholder="🤝" />
              </div>
              <div>
                <Label className="text-xs">শিরোনাম</Label>
                <Input value={g.title} onChange={(e) => setGoals(goals.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
              </div>
              <div>
                <Label className="text-xs">বর্ণনা</Label>
                <Textarea rows={2} value={g.desc} onChange={(e) => setGoals(goals.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} />
              </div>
              <Button type="button" variant="ghost" size="icon" className="mt-5" onClick={() => setGoals(goals.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setGoals([...goals, { icon: "✨", title: "", desc: "" }])}>
              <Plus className="h-4 w-4 mr-1" />নতুন লক্ষ্য
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setGoals(DEFAULT_GOALS)}>ডিফল্টে ফিরিয়ে নিন</Button>
          </div>
          <Button onClick={saveGeneral} className="w-full">সংরক্ষণ</Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>অনুপ্রেরণামূলক বাণী (ইন্ট্রো পেজ)</CardTitle>
          <CardDescription>লগইন আগের পরিচিতি পেজে দেখানো বাণীসমূহ এডিট করুন</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {quotes.map((q, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-start border rounded-md p-3">
              <div>
                <Label className="text-xs">বাণী (বাংলা)</Label>
                <Textarea rows={2} value={q.bn} onChange={(e) => setQuotes(quotes.map((x, j) => j === i ? { ...x, bn: e.target.value } : x))} />
              </div>
              <div>
                <Label className="text-xs">অনুবাদ (English) — ঐচ্ছিক</Label>
                <Textarea rows={2} value={q.en} onChange={(e) => setQuotes(quotes.map((x, j) => j === i ? { ...x, en: e.target.value } : x))} />
              </div>
              <Button type="button" variant="ghost" size="icon" className="mt-5" onClick={() => setQuotes(quotes.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setQuotes([...quotes, { bn: "", en: "" }])}>
              <Plus className="h-4 w-4 mr-1" />নতুন বাণী
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setQuotes(DEFAULT_QUOTES)}>ডিফল্টে ফিরিয়ে নিন</Button>
          </div>
          <Button onClick={saveGeneral} className="w-full">সংরক্ষণ</Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>প্রতিষ্ঠাতা / সভাপতি / সাধারণ সম্পাদকের বাণী</CardTitle>
          <CardDescription>পরিচিতি পেজে দেখানো পদাধিকারীদের নাম, ছবি ও বাণী যোগ/এডিট করুন</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {messages.map((m, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[96px_1fr_auto] items-start border rounded-md p-3">
              <div className="space-y-2">
                <div className="h-24 w-24 rounded-full border bg-muted overflow-hidden flex items-center justify-center">
                  {m.photo ? (
                    <img src={m.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl text-muted-foreground">👤</span>
                  )}
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  className="text-xs"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 2 * 1024 * 1024) { toast.error("ছবি ২ MB এর কম হতে হবে"); return; }
                    const r = new FileReader();
                    r.onload = () => setMessages(messages.map((x, j) => j === i ? { ...x, photo: String(r.result || "") } : x));
                    r.readAsDataURL(f);
                  }}
                />
                {m.photo && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setMessages(messages.map((x, j) => j === i ? { ...x, photo: "" } : x))}>ছবি সরান</Button>
                )}
              </div>
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">পদবি</Label>
                    <Input value={m.role} onChange={(e) => setMessages(messages.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} placeholder="প্রতিষ্ঠাতা" />
                  </div>
                  <div>
                    <Label className="text-xs">নাম</Label>
                    <Input value={m.name} onChange={(e) => setMessages(messages.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="পুরো নাম" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">বাণী</Label>
                  <Textarea rows={3} value={m.message} onChange={(e) => setMessages(messages.map((x, j) => j === i ? { ...x, message: e.target.value } : x))} placeholder="অনুপ্রেরণামূলক বার্তা লিখুন..." />
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setMessages(messages.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setMessages([...messages, { role: "", name: "", photo: "", message: "" }])}>
              <Plus className="h-4 w-4 mr-1" />নতুন বাণী যোগ করুন
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMessages(DEFAULT_MESSAGES)}>ডিফল্টে ফিরিয়ে নিন</Button>
          </div>
          <Button onClick={saveGeneral} className="w-full">সংরক্ষণ</Button>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>কার্যকারী কমিটি</CardTitle>
          <CardDescription>সমিতির বর্তমান কমিটির সদস্যদের তথ্য যোগ/এডিট করুন (পরিচিতি পেজে দেখানো হবে)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs">সেকশন শিরোনাম</Label>
              <Input value={committeeSectionTitle} onChange={(e) => setCommitteeSectionTitle(e.target.value)} placeholder="কার্যকারী কমিটি" />
            </div>
            <div>
              <Label className="text-xs">সেকশন সাবটাইটেল</Label>
              <Input value={committeeSectionSubtitle} onChange={(e) => setCommitteeSectionSubtitle(e.target.value)} placeholder="বর্তমান কমিটির সদস্যবৃন্দ" />
            </div>
          </div>
          {committee.map((c, i) => (
            <div key={i} className="grid gap-3 sm:grid-cols-[96px_1fr_auto] items-start border rounded-md p-3">
              <div className="space-y-2">
                <div className="h-24 w-24 rounded-full border bg-muted overflow-hidden flex items-center justify-center">
                  {c.photo ? (
                    <img src={c.photo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl text-muted-foreground">👤</span>
                  )}
                </div>
                <Input
                  type="file"
                  accept="image/*"
                  className="text-xs"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 2 * 1024 * 1024) { toast.error("ছবি ২ MB এর কম হতে হবে"); return; }
                    const r = new FileReader();
                    r.onload = () => setCommittee(committee.map((x, j) => j === i ? { ...x, photo: String(r.result || "") } : x));
                    r.readAsDataURL(f);
                  }}
                />
                {c.photo && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCommittee(committee.map((x, j) => j === i ? { ...x, photo: "" } : x))}>ছবি সরান</Button>
                )}
              </div>
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">পদবি</Label>
                    <Input value={c.role} onChange={(e) => setCommittee(committee.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} placeholder="সভাপতি / সম্পাদক / কোষাধ্যক্ষ" />
                  </div>
                  <div>
                    <Label className="text-xs">নাম</Label>
                    <Input value={c.name} onChange={(e) => setCommittee(committee.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="পুরো নাম" />
                  </div>
                  <div>
                    <Label className="text-xs">মোবাইল</Label>
                    <Input value={c.phone} onChange={(e) => setCommittee(committee.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} placeholder="01XXXXXXXXX" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">স্বাক্ষর (ছবি)</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="h-12 w-32 rounded border bg-muted/40 overflow-hidden flex items-center justify-center">
                      {c.signature ? (
                        <img src={c.signature} alt="signature" className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">স্বাক্ষর নেই</span>
                      )}
                    </div>
                    <Input
                      type="file"
                      accept="image/*"
                      className="text-xs"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 1 * 1024 * 1024) { toast.error("স্বাক্ষর ১ MB এর কম হতে হবে"); return; }
                        const r = new FileReader();
                        r.onload = () => setCommittee(committee.map((x, j) => j === i ? { ...x, signature: String(r.result || "") } : x));
                        r.readAsDataURL(f);
                      }}
                    />
                    {c.signature && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setCommittee(committee.map((x, j) => j === i ? { ...x, signature: "" } : x))}>সরান</Button>
                    )}
                  </div>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setCommittee(committee.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setCommittee([...committee, { role: "", name: "", phone: "", photo: "", signature: "" }])}>
            <Plus className="h-4 w-4 mr-1" />নতুন কমিটি সদস্য
          </Button>
          <Button onClick={saveGeneral} className="w-full">সংরক্ষণ</Button>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>ব্যাকআপ ও পুনরুদ্ধার</CardTitle>
          <CardDescription>তথ্য রপ্তানি ও আমদানি করুন</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={exportData} variant="outline" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />ব্যাকআপ ডাউনলোড করুন
          </Button>
          <label className="block">
            <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
            <Button asChild variant="outline" className="w-full justify-start"><span><Upload className="h-4 w-4 mr-2" />ব্যাকআপ ফাইল থেকে পুনরুদ্ধার</span></Button>
          </label>
          <div className="pt-3 border-t">
            {!confirmReset ? (
              <Button variant="destructive" className="w-full" onClick={() => setConfirmReset(true)}>
                <AlertTriangle className="h-4 w-4 mr-2" />সমস্ত তথ্য মুছে ফেলুন
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-destructive font-medium">এই কাজটি ফেরানো যাবে না। আপনি কি নিশ্চিত?</p>
                <div className="flex gap-2">
                  <Button variant="destructive" className="flex-1" onClick={() => { resetAll(); setConfirmReset(false); toast.success("সমস্ত তথ্য মুছে ফেলা হয়েছে"); }}>হ্যাঁ, মুছুন</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setConfirmReset(false)}>বাতিল</Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Admin =====
function AdminTab() {
  return <RoleManager />;
}

// ===== Reconciliation =====
const ADJUST_CATEGORY = "সমন্নয়";

function ReconciliationTab() {
  const { data, addTransaction, deleteTransaction, addPayment } = useSamiti();
  const [form, setForm] = useState<{ type: "income" | "expense"; amount: string; date: string; note: string }>({
    type: "income", amount: "", date: today(), note: "",
  });
  const [loanForm, setLoanForm] = useState<{ loanId: string; amount: string; date: string; note: string }>({
    loanId: "", amount: "", date: today(), note: "সমন্নয়",
  });

  const submitAdjust = () => {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    addTransaction({ type: form.type, category: ADJUST_CATEGORY, amount: amt, date: form.date, note: form.note });
    setForm({ type: "income", amount: "", date: today(), note: "" });
    toast.success("সমন্নয় রেকর্ড সংরক্ষিত হয়েছে");
  };

  const activeLoansWithDue = useMemo(() => {
    return data.loans
      .filter((l) => l.status === "active")
      .map((l) => {
        const member = data.members.find((m) => m.id === l.memberId);
        const due = Math.max(0, loanTotalDue(l) - loanPaid(data.payments, l.id));
        return { loan: l, member, due };
      })
      .filter((x) => x.due > 0)
      .sort((a, b) => (a.member?.serial || 0) - (b.member?.serial || 0));
  }, [data.loans, data.payments, data.members]);

  const selectedLoan = activeLoansWithDue.find((x) => x.loan.id === loanForm.loanId);

  const submitLoanAdjust = () => {
    if (!loanForm.loanId) { toast.error("একটি ঋণ নির্বাচন করুন"); return; }
    const amt = Number(loanForm.amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    if (selectedLoan && amt > selectedLoan.due + 0.5) {
      toast.error(`বকেয়ার চেয়ে বেশি দেওয়া যাবে না (বকেয়াঃ ${formatTk(selectedLoan.due)})`);
      return;
    }
    addPayment({ loanId: loanForm.loanId, amount: amt, date: loanForm.date, note: loanForm.note || "সমন্নয়" });
    setLoanForm({ loanId: "", amount: "", date: today(), note: "সমন্নয়" });
    toast.success("বকেয়া ঋণ সমন্নয় হয়েছে");
  };

  const adjustments = useMemo(
    () => data.transactions
      .filter((t) => t.category === ADJUST_CATEGORY)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.transactions]
  );

  const totals = useMemo(() => {
    const totalDeposit = data.deposits.reduce((a, d) => a + d.amount, 0);
    const totalLoanGiven = data.loans.reduce((a, l) => a + l.amount, 0);
    const totalRepaid = data.payments.reduce((a, p) => a + p.amount, 0);
    const totalIncome = data.transactions.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
    const totalExpense = data.transactions.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
    const outstanding = data.loans
      .filter((l) => l.status === "active")
      .reduce((a, l) => a + (loanTotalDue(l) - loanPaid(data.payments, l.id)), 0);
    const totalLoanReceivable = data.loans.reduce((a, l) => a + loanTotalDue(l), 0);
    const netAssets = totalDeposit + totalRepaid + totalIncome - totalExpense - totalLoanGiven;
    const fundBalance = netAssets + outstanding;
    return {
      totalDeposit,
      totalLoanGiven,
      totalRepaid,
      totalIncome,
      totalExpense,
      outstanding,
      totalLoanReceivable,
      netAssets,
      fundBalance,
    };
  }, [data]);

  const rows = [
    { label: "মোট সঞ্চয়/চাদা জমা", value: totals.totalDeposit, type: "positive" as const },
    { label: "মোট ঋণ প্রদান", value: totals.totalLoanGiven, type: "negative" as const },
    { label: "মোট কিস্তি আদায়", value: totals.totalRepaid, type: "positive" as const },
    { label: "মোট আয়", value: totals.totalIncome, type: "positive" as const },
    { label: "মোট ব্যয়", value: totals.totalExpense, type: "negative" as const },
    { label: "চলমান ঋণ বকেয়া", value: totals.outstanding, type: "neutral" as const },
    { label: "সর্বমোট ঋণ প্রাপ্তি (আদায় + বকেয়া)", value: totals.totalLoanReceivable, type: "neutral" as const },
    { label: "নীট সম্পদ (জমা + আদায় + আয় - ব্যয় - ঋণ)", value: totals.netAssets, type: "neutral" as const },
    { label: "তহবিল ব্যালেন্স (নীট সম্পদ + বকেয়া)", value: totals.fundBalance, type: "neutral" as const },
  ];

  const memberReconciliation = useMemo(() => {
    return data.members.map((m) => {
      const deposit = data.deposits.filter((d) => d.memberId === m.id).reduce((a, d) => a + d.amount, 0);
      const memberLoans = data.loans.filter((l) => l.memberId === m.id);
      const loanTaken = memberLoans.reduce((a, l) => a + l.amount, 0);
      const repaid = memberLoans.reduce((a, l) => a + loanPaid(data.payments, l.id), 0);
      const due = memberLoans.reduce((a, l) => a + (loanTotalDue(l) - loanPaid(data.payments, l.id)), 0);
      return { member: m, deposit, loanTaken, repaid, due };
    }).sort((a, b) => (a.member.serial || 0) - (b.member.serial || 0));
  }, [data]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            এমাউন্ট সমন্নয় (Account Reconciliation)
          </CardTitle>
          <CardDescription>সমিতির সামগ্রিক অর্থনৈতিক অবস্থার সংক্ষিপ্ত বিবরণ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <span className="text-sm font-medium">{r.label}</span>
                <span className={cn(
                  "text-sm font-bold",
                  r.type === "positive" && "text-success",
                  r.type === "negative" && "text-destructive",
                  r.type === "neutral" && "text-foreground"
                )}>
                  {formatTk(r.value)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            বকেয়া ঋণ সমন্নয়
          </CardTitle>
          <CardDescription>সদস্যের চলমান ঋণের বকেয়া পরিমাণ সমন্নয় করুন (পরিশোধ / মওকুফ)</CardDescription>
        </CardHeader>
        <CardContent>
          {activeLoansWithDue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg">কোনও বকেয়া ঋণ নেই।</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-5">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>সদস্য / ঋণ নির্বাচন</Label>
                  <Select
                    value={loanForm.loanId}
                    onValueChange={(v) => setLoanForm({ ...loanForm, loanId: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="বাছাই করুন" /></SelectTrigger>
                    <SelectContent>
                      {activeLoansWithDue.map((x) => (
                        <SelectItem key={x.loan.id} value={x.loan.id}>
                          {x.member?.name || "?"} -{toBn(x.member?.serial ?? 0)} • বকেয়াঃ {formatTk(x.due)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>পরিমাণ (৳)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={loanForm.amount}
                    onChange={(e) => setLoanForm({ ...loanForm, amount: e.target.value })}
                    placeholder={selectedLoan ? String(Math.round(selectedLoan.due)) : "0"}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>তারিখ</Label>
                  <Input type="date" value={loanForm.date} onChange={(e) => setLoanForm({ ...loanForm, date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>মন্তব্য</Label>
                  <Input value={loanForm.note} onChange={(e) => setLoanForm({ ...loanForm, note: e.target.value })} placeholder="সমন্নয়" />
                </div>
              </div>
              {selectedLoan && (
                <div className="mt-3 text-xs text-muted-foreground">
                  বর্তমান বকেয়াঃ <span className="font-semibold text-foreground">{formatTk(selectedLoan.due)}</span>
                  {loanForm.amount && Number(loanForm.amount) > 0 && (
                    <> • সমন্নয়ের পরঃ <span className="font-semibold text-foreground">{formatTk(Math.max(0, selectedLoan.due - Number(loanForm.amount)))}</span></>
                  )}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                {selectedLoan && (
                  <Button variant="outline" onClick={() => setLoanForm({ ...loanForm, amount: String(Math.round(selectedLoan.due)) })}>
                    সম্পূর্ণ বকেয়া
                  </Button>
                )}
                <Button onClick={submitLoanAdjust}><Plus className="h-4 w-4" /> সমন্নয় করুন</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            নতুন সমন্নয় / পেমেন্ট রেকর্ড
          </CardTitle>
          <CardDescription>তহবিল সমন্নয়ের জন্য আয় বা ব্যয় যোগ করুন</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="space-y-1.5">
              <Label>ধরন</Label>
              <Select value={form.type} onValueChange={(v: "income" | "expense") => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">আয় / জমা</SelectItem>
                  <SelectItem value="expense">ব্যয় / উত্তোলন</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>পরিমাণ (৳)</Label>
              <Input type="number" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>তারিখ</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>মন্তব্য</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="যেমনঃ ব্যাংক সমন্নয়, পুরাতন বকেয়া, ইত্যাদি" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={submitAdjust}><Plus className="h-4 w-4" /> যোগ করুন</Button>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold mb-2">সাম্প্রতিক সমন্নয় রেকর্ড</h4>
            {adjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg">কোনও সমন্নয় রেকর্ড নেই।</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>তারিখ</TableHead>
                    <TableHead>ধরন</TableHead>
                    <TableHead>মন্তব্য</TableHead>
                    <TableHead className="text-right">পরিমাণ</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{fmtDate(t.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(t.type === "income" ? "text-success border-success/40" : "text-destructive border-destructive/40")}>
                          {t.type === "income" ? "আয়" : "ব্যয়"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.note || "-"}</TableCell>
                      <TableCell className={cn("text-right font-semibold", t.type === "income" ? "text-success" : "text-destructive")}>
                        {t.type === "income" ? "+" : "−"} {formatTk(t.amount)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => { deleteTransaction(t.id); toast.success("মুছে ফেলা হয়েছে"); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>সদস্যভিত্তিক সমন্নয়</CardTitle>
          <CardDescription>প্রত্যেক সদস্যের জমা, ঋণ ও বকেয়ার হিসাব</CardDescription>
        </CardHeader>
        <CardContent>
          {memberReconciliation.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">কোনও সদস্য নেই।</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>সদস্য</TableHead>
                  <TableHead className="text-right">মোট জমা</TableHead>
                  <TableHead className="text-right">ঋণ গ্রহণ</TableHead>
                  <TableHead className="text-right">ঋণ আদায়</TableHead>
                  <TableHead className="text-right">ঋণ বকেয়া</TableHead>
                  <TableHead className="text-right">নীট অবস্থান</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberReconciliation.map((r) => {
                  const net = r.deposit - r.loanTaken + r.repaid;
                  return (
                    <TableRow key={r.member.id}>
                      <TableCell className="font-medium">{r.member.name}{r.member.serial ? ` -${toBn(r.member.serial)}` : ""}</TableCell>
                      <TableCell className="text-right text-success">{formatTk(r.deposit)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatTk(r.loanTaken)}</TableCell>
                      <TableCell className="text-right text-success">{formatTk(r.repaid)}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">{formatTk(r.due)}</TableCell>
                      <TableCell className="text-right font-bold">{formatTk(net)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Reports =====
function ReportsTab() {
  const { data } = useSamiti();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reportType, setReportType] = useState("summary");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [groupBy, setGroupBy] = useState<"month" | "day">("month");

  const inRange = (date: string) => {
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  };

  const filtered = useMemo(() => {
    const deposits = data.deposits.filter((d) => inRange(d.date));
    const loans = data.loans.filter((l) => inRange(l.date));
    const payments = data.payments.filter((p) => inRange(p.date));
    const transactions = data.transactions.filter((t) => inRange(t.date));
    return { deposits, loans, payments, transactions };
  }, [data, from, to]);

  const totals = useMemo(() => {
    const totalDeposit = filtered.deposits.reduce((a, d) => a + d.amount, 0);
    const totalLoanGiven = filtered.loans.reduce((a, l) => a + l.amount, 0);
    const totalRepaid = filtered.payments.reduce((a, p) => a + p.amount, 0);
    const totalIncome = filtered.transactions.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
    const totalExpense = filtered.transactions.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
    const outstanding = data.loans
      .filter((l) => l.status === "active")
      .reduce((a, l) => a + (loanTotalDue(l) - loanPaid(data.payments, l.id)), 0);
    const cashInHand = totalDeposit - totalLoanGiven + totalRepaid + totalIncome - totalExpense;
    return { totalDeposit, totalLoanGiven, totalRepaid, totalIncome, totalExpense, outstanding, cashInHand };
  }, [filtered, data]);

  const memberWise = useMemo(() => {
    return data.members.map((m) => {
      const dep = filtered.deposits.filter((d) => d.memberId === m.id).reduce((a, d) => a + d.amount, 0);
      const loans = data.loans.filter((l) => l.memberId === m.id);
      const loanAmt = loans.reduce((a, l) => a + l.amount, 0);
      const due = loans.reduce((a, l) => a + (loanTotalDue(l) - loanPaid(data.payments, l.id)), 0);
      return { member: m, deposit: dep, loanAmt, due };
    }).sort((a, b) => (a.member.serial || 0) - (b.member.serial || 0));
  }, [data, filtered]);

  // ===== member-wise periodic deposits (pivot) =====
  const memberSavingsPivot = useMemo(() => {
    const deps = filtered.deposits.filter((d) => memberFilter === "all" || d.memberId === memberFilter);
    const keyOf = (date: string) => (groupBy === "month" ? date.slice(0, 7) : date);
    const labelOf = (k: string) => {
      if (groupBy === "month") {
        const [y, mo] = k.split("-");
        const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${names[+mo - 1] || mo} ${y}`;
      }
      return fmtDate(k);
    };
    const periodSet = new Set<string>();
    deps.forEach((d) => periodSet.add(keyOf(d.date)));
    const periods = Array.from(periodSet).sort();
    const members = (memberFilter === "all" ? data.members : data.members.filter((m) => m.id === memberFilter))
      .slice()
      .sort((a, b) => (a.serial || 0) - (b.serial || 0));
    const rows = members.map((m) => {
      const cells: Record<string, number> = {};
      periods.forEach((p) => (cells[p] = 0));
      deps.filter((d) => d.memberId === m.id).forEach((d) => {
        const k = keyOf(d.date);
        cells[k] = (cells[k] || 0) + d.amount;
      });
      const total = periods.reduce((s, p) => s + (cells[p] || 0), 0);
      return { member: m, cells, total };
    });
    const colTotals: Record<string, number> = {};
    periods.forEach((p) => (colTotals[p] = rows.reduce((s, r) => s + (r.cells[p] || 0), 0)));
    const grand = rows.reduce((s, r) => s + r.total, 0);
    return { periods, labels: periods.map(labelOf), rows, colTotals, grand };
  }, [data, filtered, memberFilter, groupBy]);

  const dateRangeText = () => {
    if (from && to) return `${fmtDate(from)} থেকে ${fmtDate(to)}`;
    if (from) return `${fmtDate(from)} থেকে`;
    if (to) return `${fmtDate(to)} পর্যন্ত`;
    return "সর্বমোট";
  };

  const handlePrint = () => {
    printReport({
      samitiName: data.samitiName,
      samitiLogo: data.samitiLogo,
      samitiAddress: data.samitiAddress,
      establishedDate: data.establishedDate,
      reportType,
      dateRange: dateRangeText(),
      totals,
      memberWise,
      filtered,
      members: data.members,
      memberSavingsPivot,
      groupBy,
    });
  };

  const reportParams = (): ReportParams => ({
    samitiName: data.samitiName,
    samitiLogo: data.samitiLogo,
    samitiAddress: data.samitiAddress,
    establishedDate: data.establishedDate,
    reportType,
    dateRange: dateRangeText(),
    totals,
    memberWise,
    filtered,
    members: data.members,
    memberSavingsPivot,
    groupBy,
  });

  const handlePdf = async () => {
    try { toast.loading("PDF তৈরি হচ্ছে...", { id: "pdf" }); await exportReportPdf(reportParams()); toast.success("PDF ডাউনলোড হয়েছে", { id: "pdf" }); }
    catch (e) { toast.error("PDF তৈরিতে সমস্যা হয়েছে", { id: "pdf" }); console.error(e); }
  };
  const handleJpeg = async () => {
    try { toast.loading("ছবি তৈরি হচ্ছে...", { id: "jpg" }); await exportReportJpeg(reportParams()); toast.success("JPEG ডাউনলোড হয়েছে", { id: "jpg" }); }
    catch (e) { toast.error("ছবি তৈরিতে সমস্যা হয়েছে", { id: "jpg" }); console.error(e); }
  };

  const exportCsv = () => {
    let csv = "";
    if (reportType === "summary" || reportType === "members") {
      csv = "সিরিয়াল,নাম,মোবাইল,সঞ্চয়/চাদা,ঋণ,বকেয়া\n";
      memberWise.forEach((r) => {
        csv += `${r.member.serial || 0},"${r.member.name}","${r.member.phone || ""}",${r.deposit},${r.loanAmt},${r.due}\n`;
      });
    } else if (reportType === "savings") {
      csv = "তারিখ,সদস্য,পরিমাণ,মন্তব্য\n";
      filtered.deposits.forEach((d) => {
        const m = data.members.find((x) => x.id === d.memberId);
        csv += `${d.date},"${m?.name || ""}",${d.amount},"${d.note || ""}"\n`;
      });
    } else if (reportType === "loans") {
      csv = "তারিখ,সদস্য,মূল,মুনাফা%,মেয়াদ,পরিশোধ,বকেয়া,অবস্থা\n";
      filtered.loans.forEach((l) => {
        const m = data.members.find((x) => x.id === l.memberId);
        const paid = loanPaid(data.payments, l.id);
        const due = loanTotalDue(l) - paid;
        csv += `${l.date},"${m?.name || ""}",${l.amount},${l.interestRate},${l.durationMonths},${paid},${due},${l.status}\n`;
      });
    } else if (reportType === "cashbook") {
      csv = "তারিখ,ধরন,খাত,পরিমাণ,মন্তব্য\n";
      filtered.transactions.forEach((t) => {
        csv += `${t.date},${t.type === "income" ? "আয়" : "ব্যয়"},"${t.category}",${t.amount},"${t.note || ""}"\n`;
      });
    } else if (reportType === "member-savings") {
      csv = `সিরিয়াল,নাম,${memberSavingsPivot.labels.join(",")},মোট\n`;
      memberSavingsPivot.rows.forEach((r) => {
        csv += `${r.member.serial || 0},"${r.member.name}",${memberSavingsPivot.periods.map((p) => r.cells[p] || 0).join(",")},${r.total}\n`;
      });
      csv += `,মোট,${memberSavingsPivot.periods.map((p) => memberSavingsPivot.colTotals[p] || 0).join(",")},${memberSavingsPivot.grand}\n`;
    }
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${reportType}-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("ফাইল ডাউনলোড হয়েছে");
  };

  const reportTypeLabel: Record<string, string> = {
    summary: "সারাংশ রিপোর্ট",
    members: "সদস্যভিত্তিক রিপোর্ট",
    "member-savings": "সদস্য তারিখ/মাস অনুযায়ী চাঁদা জমা",
    savings: "সঞ্চয়/চাদা বিস্তারিত",
    loans: "ঋণ বিস্তারিত",
    cashbook: "আয়-ব্যয় বিস্তারিত",
  };

  return (
    <div className="space-y-6">
      {/* Live Header Preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>হেডার প্রিভিউ</CardTitle>
            <CardDescription>প্রিন্ট/এক্সপোর্টে এই হেডারটি ব্যবহার হবে</CardDescription>
          </div>
          <Badge variant="outline">লাইভ</Badge>
        </CardHeader>
        <CardContent>
          <div className="bg-white text-black rounded-md border overflow-hidden">
            <div className="p-4">
              <div style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: "2px solid #333", paddingBottom: 10 }}>
                {data.samitiLogo ? (
                  <img src={data.samitiLogo} style={{ width: 100, height: 100, objectFit: "contain" }} alt="logo" />
                ) : (
                  <div style={{ width: 100, height: 100, border: "1px dashed #bbb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#888", textAlign: "center", padding: 4 }}>
                    লোগো নেই<br />(সেটিংস থেকে যোগ করুন)
                  </div>
                )}
                <div style={{ flex: 1, textAlign: "center" }}>
                  <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{data.samitiName || "সমিতির নাম"}</h1>
                  {data.samitiAddress && <div style={{ fontSize: 15, color: "#444", marginTop: 4 }}>{data.samitiAddress}</div>}
                  {data.establishedDate && <div style={{ fontSize: 14, color: "#666", marginTop: 4 }}>স্থাপিত: {data.establishedDate}</div>}
                </div>
                {data.samitiLogo && <div style={{ width: 100 }} />}
              </div>
              <h2 style={{ textAlign: "center", margin: "12px 0 4px", fontSize: 20 }}>{reportTypeLabel[reportType] || "রিপোর্ট"}</h2>
              <div style={{ textAlign: "center", fontSize: 13, color: "#555" }}>সময়সীমা: {dateRangeText()}</div>
            </div>
          </div>
          {(!data.samitiLogo || !data.samitiAddress || !data.establishedDate) && (
            <p className="text-xs text-muted-foreground mt-2">টিপ: সেটিংস মেনু থেকে লোগো, ঠিকানা ও স্থাপিত তারিখ যোগ/সম্পাদনা করুন।</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>রিপোর্ট</CardTitle>
          <CardDescription>তারিখ ও ধরন নির্বাচন করে রিপোর্ট দেখুন, প্রিন্ট বা ডাউনলোড করুন</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3 items-end">
            <div className="col-span-2 md:col-span-2">
              <Label>রিপোর্টের ধরন</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">সারাংশ</SelectItem>
                  <SelectItem value="members">সদস্যভিত্তিক</SelectItem>
                  <SelectItem value="member-savings">সদস্য তারিখ/মাস অনুযায়ী চাঁদা জমা</SelectItem>
                  <SelectItem value="savings">সঞ্চয়/চাদা বিস্তারিত</SelectItem>
                  <SelectItem value="loans">ঋণ বিস্তারিত</SelectItem>
                  <SelectItem value="cashbook">আয়-ব্যয় বিস্তারিত</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>শুরুর তারিখ</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>শেষ তারিখ</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <Button onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />প্রিন্ট</Button>
            <Button variant="outline" onClick={handlePdf}><FileText className="h-4 w-4 mr-1" />PDF</Button>
            <Button variant="outline" onClick={handleJpeg}><Download className="h-4 w-4 mr-1" />JPEG</Button>
          </div>
          <div className="flex justify-end mt-2">
            <Button variant="ghost" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV ডাউনলোড</Button>
          </div>
          {reportType === "member-savings" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mt-3">
              <div>
                <Label>সদস্য</Label>
                <Select value={memberFilter} onValueChange={setMemberFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সকল সদস্য</SelectItem>
                    {data.members.slice().sort((a, b) => (a.serial || 0) - (b.serial || 0)).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{toBn(m.serial || 0)}. {m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>গ্রুপিং</Label>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "month" | "day")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">মাস অনুযায়ী</SelectItem>
                    <SelectItem value="day">তারিখ অনুযায়ী</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">সময়কাল: {dateRangeText()}</p>
        </CardContent>
      </Card>

      {(reportType === "summary") && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="মোট সঞ্চয়/চাদা" value={formatTk(totals.totalDeposit)} accent="bg-success" />
          <StatCard label="ঋণ প্রদান" value={formatTk(totals.totalLoanGiven)} accent="bg-warning" />
          <StatCard label="ঋণ আদায়" value={formatTk(totals.totalRepaid)} accent="bg-chart-2" />
          <StatCard label="বকেয়া ঋণ" value={formatTk(totals.outstanding)} accent="bg-destructive" />
          <StatCard label="আয়" value={formatTk(totals.totalIncome)} accent="bg-success" />
          <StatCard label="ব্যয়" value={formatTk(totals.totalExpense)} accent="bg-destructive" />
          <StatCard label="হাতে নগদ" value={formatTk(totals.cashInHand)} accent="bg-primary" />
          <StatCard label="মোট সদস্য" value={toBn(data.members.length)} accent="bg-chart-4" />
        </div>
      )}

      {(reportType === "members" || reportType === "summary") && (
        <Card>
          <CardHeader><CardTitle>সদস্যভিত্তিক হিসাব</CardTitle></CardHeader>
          <CardContent>
            {memberWise.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">কোনও সদস্য নেই।</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">সি.নং</TableHead>
                    <TableHead>নাম</TableHead>
                    <TableHead>মোবাইল</TableHead>
                    <TableHead className="text-right">সঞ্চয়/চাদা</TableHead>
                    <TableHead className="text-right">ঋণ</TableHead>
                    <TableHead className="text-right">বকেয়া</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberWise.map((r) => (
                    <TableRow key={r.member.id}>
                      <TableCell>{toBn(r.member.serial || 0)}</TableCell>
                      <TableCell className="font-medium">{r.member.name}</TableCell>
                      <TableCell>{r.member.phone ? toBn(r.member.phone) : "—"}</TableCell>
                      <TableCell className="text-right text-success font-semibold">{formatTk(r.deposit)}</TableCell>
                      <TableCell className="text-right">{formatTk(r.loanAmt)}</TableCell>
                      <TableCell className="text-right text-destructive font-semibold">{formatTk(r.due)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {reportType === "member-savings" && (
        <Card>
          <CardHeader>
            <CardTitle>সদস্য {groupBy === "month" ? "মাস" : "তারিখ"} অনুযায়ী চাঁদা জমা</CardTitle>
            <CardDescription>সর্বমোট: {formatTk(memberSavingsPivot.grand)}</CardDescription>
          </CardHeader>
          <CardContent>
            {memberSavingsPivot.rows.length === 0 || memberSavingsPivot.periods.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">এই সময়কালে কোনও চাঁদা জমা নেই।</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">সি.নং</TableHead>
                    <TableHead>সদস্য</TableHead>
                    {memberSavingsPivot.labels.map((lbl, i) => (
                      <TableHead key={memberSavingsPivot.periods[i]} className="text-right">{lbl}</TableHead>
                    ))}
                    <TableHead className="text-right">মোট</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberSavingsPivot.rows.map((r) => (
                    <TableRow key={r.member.id}>
                      <TableCell>{toBn(r.member.serial || 0)}</TableCell>
                      <TableCell className="font-medium">{r.member.name}</TableCell>
                      {memberSavingsPivot.periods.map((p) => (
                        <TableCell key={p} className="text-right">{r.cells[p] ? formatTk(r.cells[p]) : "—"}</TableCell>
                      ))}
                      <TableCell className="text-right font-semibold text-success">{formatTk(r.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-semibold text-right">মোট</TableCell>
                    {memberSavingsPivot.periods.map((p) => (
                      <TableCell key={p} className="text-right font-semibold">{formatTk(memberSavingsPivot.colTotals[p] || 0)}</TableCell>
                    ))}
                    <TableCell className="text-right font-bold text-success">{formatTk(memberSavingsPivot.grand)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {reportType === "savings" && (
        <Card>
          <CardHeader><CardTitle>সঞ্চয়/চাদা বিস্তারিত</CardTitle><CardDescription>মোট: {formatTk(totals.totalDeposit)}</CardDescription></CardHeader>
          <CardContent>
            {filtered.deposits.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">কোনও তথ্য নেই।</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>তারিখ</TableHead><TableHead>সদস্য</TableHead><TableHead>মন্তব্য</TableHead><TableHead className="text-right">পরিমাণ</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...filtered.deposits].sort((a, b) => b.date.localeCompare(a.date)).map((d) => {
                    const m = data.members.find((x) => x.id === d.memberId);
                    return (
                      <TableRow key={d.id}>
                        <TableCell>{fmtDate(d.date)}</TableCell>
                        <TableCell className="font-medium">{m?.name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{d.note || "—"}</TableCell>
                        <TableCell className="text-right font-semibold text-success">{formatTk(d.amount)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {reportType === "loans" && (
        <Card>
          <CardHeader><CardTitle>ঋণ বিস্তারিত</CardTitle><CardDescription>মোট প্রদান: {formatTk(totals.totalLoanGiven)} | আদায়: {formatTk(totals.totalRepaid)}</CardDescription></CardHeader>
          <CardContent>
            {filtered.loans.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">কোনও তথ্য নেই।</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>তারিখ</TableHead><TableHead>সদস্য</TableHead><TableHead className="text-right">মূল</TableHead><TableHead className="text-right">মোট প্রদেয়</TableHead><TableHead className="text-right">পরিশোধ</TableHead><TableHead className="text-right">বকেয়া</TableHead><TableHead>অবস্থা</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.loans.map((l) => {
                    const m = data.members.find((x) => x.id === l.memberId);
                    const due = loanTotalDue(l);
                    const paid = loanPaid(data.payments, l.id);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>{fmtDate(l.date)}</TableCell>
                        <TableCell className="font-medium">{m?.name ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatTk(l.amount)}</TableCell>
                        <TableCell className="text-right">{formatTk(due)}</TableCell>
                        <TableCell className="text-right text-success">{formatTk(paid)}</TableCell>
                        <TableCell className="text-right text-destructive font-semibold">{formatTk(Math.max(0, due - paid))}</TableCell>
                        <TableCell>{l.status === "active" ? "চলমান" : "পরিশোধিত"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {reportType === "cashbook" && (
        <Card>
          <CardHeader><CardTitle>আয়-ব্যয় বিস্তারিত</CardTitle><CardDescription>আয়: {formatTk(totals.totalIncome)} | ব্যয়: {formatTk(totals.totalExpense)} | নীট: {formatTk(totals.totalIncome - totals.totalExpense)}</CardDescription></CardHeader>
          <CardContent>
            {filtered.transactions.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">কোনও তথ্য নেই।</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>তারিখ</TableHead><TableHead>ধরন</TableHead><TableHead>খাত</TableHead><TableHead>মন্তব্য</TableHead><TableHead className="text-right">পরিমাণ</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...filtered.transactions].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{fmtDate(t.date)}</TableCell>
                      <TableCell>
                        {t.type === "income"
                          ? <Badge className="bg-success text-success-foreground">আয়</Badge>
                          : <Badge variant="destructive">ব্যয়</Badge>}
                      </TableCell>
                      <TableCell className="font-medium">{t.category}</TableCell>
                      <TableCell className="text-muted-foreground">{t.note || "—"}</TableCell>
                      <TableCell className={cn("text-right font-semibold", t.type === "income" ? "text-success" : "text-destructive")}>{formatTk(t.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type ReportParams = {
  samitiName: string;
  samitiLogo?: string;
  samitiAddress?: string;
  establishedDate?: string;
  reportType: string;
  dateRange: string;
  totals: any;
  memberWise: any[];
  filtered: any;
  members: Member[];
  memberSavingsPivot?: any;
  groupBy?: "month" | "day";
};

function buildReportHtml(p: ReportParams) {
  const { samitiName, samitiLogo, samitiAddress, establishedDate, reportType, dateRange, totals, memberWise, filtered, members, memberSavingsPivot, groupBy } = p;
  const titleMap: Record<string, string> = {
    summary: "সারাংশ রিপোর্ট",
    members: "সদস্যভিত্তিক রিপোর্ট",
    savings: "সঞ্চয়/চাদা রিপোর্ট",
    loans: "ঋণ রিপোর্ট",
    cashbook: "আয়-ব্যয় রিপোর্ট",
    "member-savings": `সদস্য ${groupBy === "month" ? "মাস" : "তারিখ"} অনুযায়ী চাঁদা জমা`,
  };

  const summaryHtml = `
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:15px;">
      <tr><td style="padding:8px 12px;border:1px solid #ccc;background:#f5f5f5;">মোট সঞ্চয়/চাদা</td><td style="padding:8px 12px;border:1px solid #ccc;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">${formatTk(totals.totalDeposit)}</td>
          <td style="padding:8px 12px;border:1px solid #ccc;background:#f5f5f5;">ঋণ প্রদান</td><td style="padding:8px 12px;border:1px solid #ccc;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">${formatTk(totals.totalLoanGiven)}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #ccc;background:#f5f5f5;">ঋণ আদায়</td><td style="padding:8px 12px;border:1px solid #ccc;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">${formatTk(totals.totalRepaid)}</td>
          <td style="padding:8px 12px;border:1px solid #ccc;background:#f5f5f5;">বকেয়া ঋণ</td><td style="padding:8px 12px;border:1px solid #ccc;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">${formatTk(totals.outstanding)}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #ccc;background:#f5f5f5;">আয়</td><td style="padding:8px 12px;border:1px solid #ccc;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">${formatTk(totals.totalIncome)}</td>
          <td style="padding:8px 12px;border:1px solid #ccc;background:#f5f5f5;">ব্যয়</td><td style="padding:8px 12px;border:1px solid #ccc;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">${formatTk(totals.totalExpense)}</td></tr>
      <tr><td style="padding:8px 12px;border:1px solid #ccc;background:#f5f5f5;font-weight:bold;">হাতে নগদ</td><td colspan="3" style="padding:8px 12px;border:1px solid #ccc;text-align:right;font-weight:bold;white-space:nowrap;font-variant-numeric:tabular-nums;">${formatTk(totals.cashInHand)}</td></tr>
    </table>`;

  const th = (cols: string[]) => `<tr>${cols.map((c) => `<th style="padding:8px 10px;border:1px solid #999;background:#eee;text-align:left;font-size:14px;">${c}</th>`).join("")}</tr>`;
  const td = (cells: (string | number)[], aligns: string[] = []) =>
    `<tr>${cells.map((c, i) => {
      const a = aligns[i] || "left";
      const numeric = a === "right";
      return `<td style="padding:7px 10px;border:1px solid #ccc;text-align:${a};font-size:14px;${numeric ? "white-space:nowrap;font-variant-numeric:tabular-nums;" : ""}">${c}</td>`;
    }).join("")}</tr>`;

  let body = "";
  if (reportType === "summary") {
    body += summaryHtml;
    body += `<h3>সদস্যভিত্তিক সারসংক্ষেপ</h3>`;
    body += `<table style="width:100%;border-collapse:collapse;font-size:14px;">${th(["সি.নং", "নাম", "মোবাইল", "সঞ্চয়/চাদা", "ঋণ", "বকেয়া"])}${memberWise.map((r: any) => td([toBn(r.member.serial || 0), r.member.name, r.member.phone ? toBn(r.member.phone) : "—", formatTk(r.deposit), formatTk(r.loanAmt), formatTk(r.due)], ["left", "left", "left", "right", "right", "right"])).join("")}</table>`;
  } else if (reportType === "members") {
    body += `<table style="width:100%;border-collapse:collapse;font-size:14px;">${th(["সি.নং", "নাম", "মোবাইল", "সঞ্চয়/চাদা", "ঋণ", "বকেয়া"])}${memberWise.map((r: any) => td([toBn(r.member.serial || 0), r.member.name, r.member.phone ? toBn(r.member.phone) : "—", formatTk(r.deposit), formatTk(r.loanAmt), formatTk(r.due)], ["left", "left", "left", "right", "right", "right"])).join("")}</table>`;
  } else if (reportType === "savings") {
    body += `<p style="font-size:14px;"><b>মোট:</b> ${formatTk(totals.totalDeposit)}</p>`;
    body += `<table style="width:100%;border-collapse:collapse;font-size:14px;">${th(["তারিখ", "সদস্য", "মন্তব্য", "পরিমাণ"])}${[...filtered.deposits].sort((a: any, b: any) => b.date.localeCompare(a.date)).map((d: any) => { const m = members.find((x) => x.id === d.memberId); return td([fmtDate(d.date), m?.name || "—", d.note || "—", formatTk(d.amount)], ["left", "left", "left", "right"]); }).join("")}</table>`;
  } else if (reportType === "loans") {
    body += `<p style="font-size:14px;"><b>মোট প্রদান:</b> ${formatTk(totals.totalLoanGiven)} | <b>আদায়:</b> ${formatTk(totals.totalRepaid)}</p>`;
    body += `<table style="width:100%;border-collapse:collapse;font-size:14px;">${th(["তারিখ", "সদস্য", "মূল", "মোট প্রদেয়", "পরিশোধ", "বকেয়া", "অবস্থা"])}${filtered.loans.map((l: any) => { const m = members.find((x) => x.id === l.memberId); const due = loanTotalDue(l); const realPaid = (filtered.payments.filter((pp: any) => pp.loanId === l.id).reduce((a: number, pp: any) => a + pp.amount, 0)); return td([fmtDate(l.date), m?.name || "—", formatTk(l.amount), formatTk(due), formatTk(realPaid), formatTk(Math.max(0, due - realPaid)), l.status === "active" ? "চলমান" : "পরিশোধিত"], ["left", "left", "right", "right", "right", "right", "left"]); }).join("")}</table>`;
  } else if (reportType === "cashbook") {
    body += `<p style="font-size:14px;"><b>আয়:</b> ${formatTk(totals.totalIncome)} | <b>ব্যয়:</b> ${formatTk(totals.totalExpense)} | <b>নীট:</b> ${formatTk(totals.totalIncome - totals.totalExpense)}</p>`;
    body += `<table style="width:100%;border-collapse:collapse;font-size:14px;">${th(["তারিখ", "ধরন", "খাত", "মন্তব্য", "পরিমাণ"])}${[...filtered.transactions].sort((a: any, b: any) => b.date.localeCompare(a.date)).map((t: any) => td([fmtDate(t.date), t.type === "income" ? "আয়" : "ব্যয়", t.category, t.note || "—", formatTk(t.amount)], ["left", "left", "left", "left", "right"])).join("")}</table>`;
  } else if (reportType === "member-savings" && memberSavingsPivot) {
    const headerCells = ["সি.নং", "সদস্য", ...memberSavingsPivot.labels, "মোট"];
    const bodyRows = memberSavingsPivot.rows.map((r: any) =>
      td(
        [toBn(r.member.serial || 0), r.member.name, ...memberSavingsPivot.periods.map((pp: string) => (r.cells[pp] ? formatTk(r.cells[pp]) : "—")), formatTk(r.total)],
        ["left", "left", ...memberSavingsPivot.periods.map(() => "right"), "right"]
      )
    ).join("");
    const totalsRow = `<tr><td colspan="2" style="padding:7px 10px;border:1px solid #999;background:#eee;text-align:right;font-weight:bold;font-size:14px;">মোট</td>${memberSavingsPivot.periods.map((pp: string) => `<td style="padding:7px 10px;border:1px solid #999;background:#eee;text-align:right;font-weight:bold;font-size:14px;white-space:nowrap;font-variant-numeric:tabular-nums;">${formatTk(memberSavingsPivot.colTotals[pp] || 0)}</td>`).join("")}<td style="padding:7px 10px;border:1px solid #999;background:#eee;text-align:right;font-weight:bold;font-size:14px;white-space:nowrap;font-variant-numeric:tabular-nums;">${formatTk(memberSavingsPivot.grand)}</td></tr>`;
    body += `<p style="font-size:14px;"><b>সর্বমোট:</b> ${formatTk(memberSavingsPivot.grand)}</p>`;
    body += `<table style="width:100%;border-collapse:collapse;font-size:14px;">${th(headerCells)}${bodyRows}${totalsRow}</table>`;
  }

  const inner = `
    <div style="display:flex;align-items:center;gap:16px;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:10px;">
      ${samitiLogo ? `<img src="${samitiLogo}" style="width:100px;height:100px;object-fit:contain;" crossorigin="anonymous" />` : ""}
      <div style="flex:1;text-align:center;">
        <h1 style="margin:0;font-size:28px;">${samitiName}</h1>
        ${samitiAddress ? `<div style="font-size:15px;color:#444;margin-top:4px;">${samitiAddress}</div>` : ""}
        ${establishedDate ? `<div style="font-size:14px;color:#666;margin-top:4px;">স্থাপিত: ${establishedDate}</div>` : ""}
      </div>
      ${samitiLogo ? `<div style="width:100px;"></div>` : ""}
    </div>
    <h2 style="text-align:center;margin:0 0 4px;font-size:16px;color:#555;font-weight:normal;">${titleMap[reportType]}</h2>
    <div style="text-align:center;font-size:12px;color:#666;margin-bottom:12px;border-bottom:1px solid #ccc;padding-bottom:8px;">সময়কাল: ${dateRange} | প্রিন্ট তারিখ: ${fmtDate(today())}</div>
    ${body}
  `;
  return { inner, title: titleMap[reportType] };
}

function printReport(p: ReportParams) {
  const w = window.open("", "_blank", "width=1000,height=700");
  if (!w) return;
  const { inner, title } = buildReportHtml(p);
  w.document.write(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8" /><title>${title} - ${p.samitiName}</title>
    <style>
      body { font-family: "Segoe UI", "Noto Sans Bengali", sans-serif; margin: 0; padding: 24px; color: #111; background:#fff; position: relative; }
      h3 { margin: 16px 0 6px; font-size: 14px; }
      @media print { body { padding: 0 12px; } .no-print { display: none; } }
      ${printBrandCss}
    </style></head>
    <body>
      ${printWatermark(p.samitiLogo)}
      <div class="ps-content">
      <div class="no-print" style="margin-bottom:12px;"><button onclick="window.print()" style="padding:8px 16px;font-size:14px;cursor:pointer;">প্রিন্ট করুন</button></div>
      ${inner}
      </div>
      <script>setTimeout(()=>window.print(),300)</script>
    </body></html>
  `);
  w.document.close();
}

async function renderReportCanvas(p: ReportParams): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  const { inner } = buildReportHtml(p);
  // Render inside an isolated iframe so the page's Tailwind theme (which uses
  // oklch() and is not supported by html2canvas) does not leak in via inheritance.
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:840px;height:10px;border:0;";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;background:#ffffff;color:#111111;font-family:"Segoe UI","Noto Sans Bengali",Arial,sans-serif;}
      *{box-sizing:border-box;}
      h1,h2,h3,p,td,th,div{color:#111111;}
      h3{margin:16px 0 6px;font-size:14px;}
    </style></head><body><div id="r" style="width:800px;padding:20px;background:#fff;">${inner}</div></body></html>`);
    doc.close();
    const target = doc.getElementById("r")!;
    const imgs = Array.from(target.querySelectorAll("img"));
    await Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = () => res(null); })));
    // give layout a tick
    await new Promise((r) => setTimeout(r, 50));
    const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: 840, windowHeight: target.scrollHeight + 40 });
    return canvas;
  } finally {
    document.body.removeChild(iframe);
  }
}


async function exportReportJpeg(p: ReportParams) {
  const canvas = await renderReportCanvas(p);
  const url = canvas.toDataURL("image/jpeg", 0.95);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${p.reportType}-${today()}.jpg`;
  a.click();
}

async function exportReportPdf(p: ReportParams) {
  const canvas = await renderReportCanvas(p);
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const imgData = canvas.toDataURL("image/jpeg", 0.95);
  if (imgH <= pageH) {
    pdf.addImage(imgData, "JPEG", 0, 0, imgW, imgH);
  } else {
    let position = 0;
    let remaining = imgH;
    while (remaining > 0) {
      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      remaining -= pageH;
      if (remaining > 0) {
        position -= pageH;
        pdf.addPage();
      }
    }
  }
  pdf.save(`report-${p.reportType}-${today()}.pdf`);
}

const receiptCss = `
  body{margin:0;padding:20px;background:#fff;color:#111;font-family:"Segoe UI","Noto Sans Bengali",Arial,sans-serif;}
  .r{width:520px;border:1px solid #ddd;border-radius:8px;padding:20px;background:#fff;position:relative;overflow:hidden;}
  .watermark{position:absolute;inset:0;background-repeat:no-repeat;background-position:center;background-size:75% auto;opacity:0.18;pointer-events:none;z-index:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .r > *:not(.watermark){position:relative;z-index:1;}
  .center{text-align:center;}
  .header{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:6px;}
  .logo{width:54px;height:54px;object-fit:contain;border-radius:6px;}
  .head-text{text-align:center;}
  .note{margin-top:10px;padding-top:8px;border-top:1px solid #eee;font-size:13px;white-space:pre-wrap;}
  .title{font-size:20px;font-weight:700;margin:0;}
  .sub{font-size:12px;color:#666;margin-top:2px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;font-size:13px;}
  .grid .full{grid-column:1 / -1;}
  .muted{color:#666;}
  .row{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1px solid #eee;font-size:15px;}
  .amount{font-weight:700;color:#15803d;}
  .totals{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;font-size:13px;}
  .due{color:#b91c1c;font-weight:600;}
  .sign{display:flex;justify-content:space-between;margin-top:32px;font-size:12px;color:#666;}
  .qr{margin-top:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;display:flex;align-items:center;gap:14px;background:transparent;break-inside:avoid;}
  .qr-frame{padding:10px;background:transparent;border:1px solid #e5e7eb;border-radius:6px;}
  .qr-frame img{width:145px;height:145px;display:block;image-rendering:pixelated;background:transparent;mix-blend-mode:multiply;}
  .qr-info{flex:1;font-size:11px;color:#475569;line-height:1.55;}
  .qr-info .qr-title{display:inline-flex;align-items:center;gap:6px;color:#0f172a;font-size:12px;font-weight:700;margin-bottom:4px;}
  .qr-info .qr-badge{display:inline-block;background:#0f172a;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;letter-spacing:0.5px;margin-top:6px;}
  @media print{body{padding:0;} .no-print{display:none;}}
`;

function findTreasurer(committee?: CommitteeMember[]) {
  return committee?.find((c) => (c.role || "").includes("কোষাধ্যক্ষ")) || null;
}
function treasurerSignHtml(t?: CommitteeMember | null) {
  if (!t) return `<div style="text-align:right">—————————<br/>কোষাধ্যক্ষ</div>`;
  const img = t.signature
    ? `<img src="${t.signature}" alt="" style="height:40px;max-width:140px;object-fit:contain;display:block;margin-left:auto;margin-bottom:2px;"/>`
    : `<div style="border-bottom:1px solid #111;height:34px;width:140px;margin-left:auto;margin-bottom:2px;"></div>`;
  const name = t.name ? `<div style="font-weight:600;color:#111;">${t.name}</div>` : "";
  const role = `<div style="color:#666;font-size:11px;">${t.role || "কোষাধ্যক্ষ"}</div>`;
  const phone = t.phone ? `<div style="color:#666;font-size:11px;">${toBn(t.phone)}</div>` : "";
  return `<div style="text-align:right">${img}${name}${role}${phone}</div>`;
}

function TreasurerSignBlock({ committee }: { committee?: CommitteeMember[] }) {
  const t = findTreasurer(committee);
  if (!t) return <div className="text-right">—————————<br />কোষাধ্যক্ষ</div>;
  return (
    <div className="text-right">
      {t.signature ? (
        <img src={t.signature} alt="" className="h-9 max-w-[140px] object-contain ml-auto mb-0.5" />
      ) : (
        <div className="border-b border-foreground/70 h-7 w-32 ml-auto mb-0.5" />
      )}
      {t.name && <div className="font-semibold text-foreground">{t.name}</div>}
      <div>{t.role || "কোষাধ্যক্ষ"}</div>
      {t.phone && <div>{toBn(t.phone)}</div>}
    </div>
  );
}

const qrBlockHtml = (qrDataUrl?: string) =>
  qrDataUrl
    ? `<div class="qr">
        <div class="qr-frame">
          <img src="${qrDataUrl}" alt="QR" />
        </div>
        <div class="qr-info">
          <div class="qr-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h3M20 20h1"/></svg>
            যাচাইকৃত ডিজিটাল রিসিপ্ট
          </div>
          মোবাইল ক্যামেরা দিয়ে এই QR কোডটি স্ক্যান করে রিসিপ্টের তথ্য তাৎক্ষণিক যাচাই করুন।
          <div class="qr-badge">SECURE • VERIFY</div>
        </div>
      </div>`
    : "";


function buildReceiptHtml(r: { loan: Loan; memberName: string; amount: number; date: string; paidAfter: number; remainingAfter: number; receiptNo: string; note?: string; logo?: string; loanNo?: number }, samitiName: string, qrDataUrl?: string, treasurer?: CommitteeMember | null) {
  return `<div class="r" id="r">
    ${r.logo ? `<div class="watermark" style="background-image:url('${r.logo}')"></div>` : ""}
    <div class="header">
      ${r.logo ? `<img src="${r.logo}" alt="logo" class="logo"/>` : ""}
      <div class="head-text"><div class="title">${samitiName}</div><div class="sub">কিস্তি প্রাপ্তি রিসিপ্ট</div></div>
    </div>
    <div class="grid">
      <div><span class="muted">রিসিপ্ট নং:</span> <b>${r.receiptNo}</b></div>
      <div><span class="muted">তারিখ:</span> <b>${fmtDate(r.date)}</b></div>
      <div class="full"><span class="muted">সদস্য:</span> <b>${r.memberName}${r.loanNo ? ` (ঋণ নং ${toBn(r.loanNo)})` : ""}</b></div>
      <div><span class="muted">ঋণ মূল:</span> ${formatTk(r.loan.amount)}</div>
      <div><span class="muted">মেয়াদ:</span> ${toBn(r.loan.durationMonths)} মাস</div>
    </div>
    <div class="row"><span>প্রাপ্ত কিস্তি</span><span class="amount">${formatTk(r.amount)}</span></div>
    <div class="totals">
      <div><span class="muted">মোট পরিশোধিত:</span> <b>${formatTk(r.paidAfter)}</b></div>
      <div><span class="muted">অবশিষ্ট বকেয়া:</span> <span class="due">${formatTk(r.remainingAfter)}</span></div>
    </div>
    ${r.note ? `<div class="note"><span class="muted">নোট:</span> <b>${r.note.replace(/</g, "&lt;")}</b></div>` : ""}
    ${qrBlockHtml(qrDataUrl)}
    <div class="sign"><div>—————————<br/>গ্রহীতা</div>${treasurerSignHtml(treasurer)}</div>
  </div>`;
}

async function buildInstallmentQr(r: { memberName: string; memberSerial?: number; amount: number; date: string; paidAfter: number; remainingAfter: number; receiptNo: string; loanNo?: number }, samitiName: string): Promise<string> {
  const { makeQrDataUrl } = await import("@/lib/receipt-qr");
  const text = buildQrText({
    memberName: r.memberName, memberSerial: r.memberSerial,
    loanNo: r.loanNo, date: r.date, amount: r.amount,
  });
  return makeQrDataUrl(text);
}

async function renderReceiptCanvas(r: { loan: Loan; memberName: string; memberSerial?: number; amount: number; date: string; paidAfter: number; remainingAfter: number; receiptNo: string; note?: string; logo?: string; loanNo?: number }, samitiName: string, treasurer?: CommitteeMember | null): Promise<HTMLCanvasElement> {
  const qrDataUrl = await buildInstallmentQr(r, samitiName);
  const { default: html2canvas } = await import("html2canvas");
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:600px;height:10px;border:0;";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${receiptCss}</style></head><body>${buildReceiptHtml(r, samitiName, qrDataUrl, treasurer)}</body></html>`);
    doc.close();
    await new Promise((res) => setTimeout(res, 60));
    const target = doc.getElementById("r")!;
    const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: 600, windowHeight: target.scrollHeight + 40 });
    return canvas;
  } finally {
    document.body.removeChild(iframe);
  }
}

type DepositReceiptData = {
  memberName: string;
  memberSerial?: number;
  amount: number;
  date: string;
  totalAfter: number;
  receiptNo: string;
  note?: string;
  logo?: string;
};

function buildDepositReceiptHtml(r: DepositReceiptData, samitiName: string, qrDataUrl?: string, treasurer?: CommitteeMember | null) {
  return `<div class="r" id="r">
    ${r.logo ? `<div class="watermark" style="background-image:url('${r.logo}')"></div>` : ""}
    <div class="header">
      ${r.logo ? `<img src="${r.logo}" alt="logo" class="logo"/>` : ""}
      <div class="head-text"><div class="title">${samitiName}</div><div class="sub">সঞ্চয়/চাদা জমা রিসিপ্ট</div></div>
    </div>
    <div class="grid">
      <div><span class="muted">রিসিপ্ট নং:</span> <b>${r.receiptNo}</b></div>
      <div><span class="muted">তারিখ:</span> <b>${fmtDate(r.date)}</b></div>
      <div class="full"><span class="muted">সদস্য:</span> <b>${r.memberSerial ? `${toBn(r.memberSerial)}. ` : ""}${r.memberName}</b></div>
    </div>
    <div class="row"><span>জমার পরিমাণ</span><span class="amount">${formatTk(r.amount)}</span></div>
    <div class="totals">
      <div class="full"><span class="muted">মোট সঞ্চয় (এই জমা সহ):</span> <b>${formatTk(r.totalAfter)}</b></div>
    </div>
    ${r.note ? `<div class="note"><span class="muted">নোট:</span> <b>${r.note.replace(/</g, "&lt;")}</b></div>` : ""}
    ${qrBlockHtml(qrDataUrl)}
    <div class="sign"><div>—————————<br/>গ্রহীতা</div>${treasurerSignHtml(treasurer)}</div>
  </div>`;
}

async function buildDepositQr(r: DepositReceiptData, samitiName: string): Promise<string> {
  const { makeQrDataUrl } = await import("@/lib/receipt-qr");
  const text = buildQrText({
    memberName: r.memberName, memberSerial: r.memberSerial,
    date: r.date, amount: r.amount,
  });
  return makeQrDataUrl(text);
}

async function renderDepositReceiptCanvas(r: DepositReceiptData, samitiName: string, treasurer?: CommitteeMember | null): Promise<HTMLCanvasElement> {
  const qrDataUrl = await buildDepositQr(r, samitiName);
  const { default: html2canvas } = await import("html2canvas");
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:600px;height:10px;border:0;";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${receiptCss}</style></head><body>${buildDepositReceiptHtml(r, samitiName, qrDataUrl, treasurer)}</body></html>`);
    doc.close();
    await new Promise((res) => setTimeout(res, 60));
    const target = doc.getElementById("r")!;
    const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: 600, windowHeight: target.scrollHeight + 40 });
    return canvas;
  } finally {
    document.body.removeChild(iframe);
  }
}

