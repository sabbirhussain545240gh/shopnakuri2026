import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, HandCoins, PiggyBank, Receipt as ReceiptIcon, Printer, ImageDown, AlertTriangle, User, Phone, MapPin, Calendar, Hash, Eye, Users, TrendingUp, Wallet } from "lucide-react";
import { SignOutButton, CloudStatusBadge } from "@/components/AuthGate";
import { NotificationBell } from "@/components/NotificationBell";
import { toBn, formatTk } from "@/lib/samiti-store";
import { buildReceiptQr } from "@/lib/receipt-qr";
import { getMyMemberView, type MemberViewResponse, type MemberViewLoan, type MemberViewPayment, type MemberViewDeposit } from "@/lib/member-view.functions";

function fmtDate(d: string) {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  if (!y || !m || !dd) return d;
  return `${toBn(dd)}/${toBn(m)}/${toBn(y)}`;
}

function monthlyInstallment(amount: number, rate: number, months: number) {
  if (!months || months <= 0) return 0;
  const interest = (amount * rate * months) / (100 * 12);
  return (amount + interest) / months;
}

function loanTotalDue(l: MemberViewLoan) {
  const interest = (l.amount * l.interestRate * l.durationMonths) / (100 * 12);
  return l.amount + interest;
}

const receiptCss = `
  body{margin:0;padding:20px;background:#fff;color:#111;font-family:"Segoe UI","Noto Sans Bengali",Arial,sans-serif;}
  .r{width:520px;border:1px solid #ddd;border-radius:8px;padding:20px;background:#fff;margin:0 auto;}
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
  .qr{margin-top:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;display:flex;align-items:center;gap:14px;background:#fff;break-inside:avoid;}
  .qr-frame{padding:10px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;}
  .qr-frame img{width:145px;height:145px;display:block;image-rendering:pixelated;}
  .qr-info{flex:1;font-size:11px;color:#475569;line-height:1.55;}
  .qr-info .qr-title{display:inline-flex;align-items:center;gap:6px;color:#0f172a;font-size:12px;font-weight:700;margin-bottom:4px;}
  .qr-info .qr-badge{display:inline-block;background:#0f172a;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;letter-spacing:0.5px;margin-top:6px;}
  @media print{body{padding:0;} .no-print{display:none;}}
`;

const qrBlock = (qrDataUrl?: string, kind: "receipt" | "certificate" = "receipt") =>
  qrDataUrl
    ? `<div class="qr">
        <div class="qr-frame">
          <img src="${qrDataUrl}" alt="QR" />
        </div>
        <div class="qr-info">
          <div class="qr-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h3M20 20h1"/></svg>
            ${kind === "certificate" ? "যাচাইকৃত ডিজিটাল সনদ" : "যাচাইকৃত ডিজিটাল রিসিপ্ট"}
          </div>
          ${kind === "certificate"
            ? "মোবাইল ক্যামেরা দিয়ে এই QR কোডটি স্ক্যান করে ঋণ পরিশোধ সনদের সত্যতা ও সদস্যের পরিশোধ তথ্য যাচাই করুন।"
            : "মোবাইল ক্যামেরা দিয়ে এই QR কোডটি স্ক্যান করে রিসিপ্টের তথ্য তাৎক্ষণিক যাচাই করুন।"}
          <div class="qr-badge">SECURE • VERIFY</div>
        </div>
      </div>`
    : "";

function buildDepositHtml(p: { samitiName: string; logo?: string; memberName: string; memberSerial?: number; amount: number; date: string; totalAfter: number; receiptNo: string; note?: string; cashierName?: string; cashierId?: string }, qr?: string) {
  return `<div class="r" id="r">
    <div class="header">
      ${p.logo ? `<img src="${p.logo}" alt="logo" class="logo"/>` : ""}
      <div class="head-text"><div class="title">${p.samitiName}</div><div class="sub">সঞ্চয়/চাদা জমা রিসিপ্ট</div></div>
    </div>
    <div class="grid">
      <div><span class="muted">রিসিপ্ট নং:</span> <b>${p.receiptNo}</b></div>
      <div><span class="muted">তারিখ:</span> <b>${fmtDate(p.date)}</b></div>
      <div class="full"><span class="muted">সদস্য:</span> <b>${p.memberSerial ? `${toBn(p.memberSerial)}. ` : ""}${p.memberName}</b></div>
    </div>
    <div class="row"><span>জমার পরিমাণ</span><span class="amount">${formatTk(p.amount)}</span></div>
    <div class="totals">
      <div class="full"><span class="muted">মোট সঞ্চয় (এই জমা সহ):</span> <b>${formatTk(p.totalAfter)}</b></div>
    </div>
    ${p.note ? `<div class="note"><span class="muted">নোট:</span> <b>${p.note.replace(/</g, "&lt;")}</b></div>` : ""}
    ${qrBlock(qr)}
    <div class="sign"><div>—————————<br/>গ্রহীতা</div><div style="text-align:right">—————————<br/>কোষাধ্যক্ষ</div></div>
  </div>`;
}

function buildInstallmentHtml(p: { samitiName: string; logo?: string; memberName: string; loanAmount: number; durationMonths: number; amount: number; date: string; paidAfter: number; remainingAfter: number; receiptNo: string; note?: string; loanNo?: number; cashierName?: string; cashierId?: string }, qr?: string) {
  return `<div class="r" id="r">
    <div class="header">
      ${p.logo ? `<img src="${p.logo}" alt="logo" class="logo"/>` : ""}
      <div class="head-text"><div class="title">${p.samitiName}</div><div class="sub">কিস্তি প্রাপ্তি রিসিপ্ট</div></div>
    </div>
    <div class="grid">
      <div><span class="muted">রিসিপ্ট নং:</span> <b>${p.receiptNo}</b></div>
      <div><span class="muted">তারিখ:</span> <b>${fmtDate(p.date)}</b></div>
      <div class="full"><span class="muted">সদস্য:</span> <b>${p.memberName}${p.loanNo ? ` (ঋণ নং ${toBn(p.loanNo)})` : ""}</b></div>
      <div><span class="muted">ঋণ মূল:</span> ${formatTk(p.loanAmount)}</div>
      <div><span class="muted">মেয়াদ:</span> ${toBn(p.durationMonths)} মাস</div>
    </div>
    <div class="row"><span>প্রাপ্ত কিস্তি</span><span class="amount">${formatTk(p.amount)}</span></div>
    <div class="totals">
      <div><span class="muted">মোট পরিশোধিত:</span> <b>${formatTk(p.paidAfter)}</b></div>
      <div><span class="muted">অবশিষ্ট বকেয়া:</span> <span class="due">${formatTk(p.remainingAfter)}</span></div>
    </div>
    ${p.note ? `<div class="note"><span class="muted">নোট:</span> <b>${p.note.replace(/</g, "&lt;")}</b></div>` : ""}
    ${qrBlock(qr)}
    <div class="sign"><div>—————————<br/>গ্রহীতা</div><div style="text-align:right">—————————<br/>কোষাধ্যক্ষ</div></div>
  </div>`;
}

type MPCommittee = { role: string; name: string; phone: string; photo?: string; signature?: string };
function mpFindCommittee(committee: MPCommittee[] | undefined, keywords: string[]) {
  if (!committee) return null;
  return committee.find((c) => keywords.some((k) => (c.role || "").includes(k))) || null;
}
function mpSignBlock(label: string, c: MPCommittee | null) {
  if (!c) return `<div><div style="height:48px;border-bottom:1px solid #111;margin-bottom:4px;"></div>${label}</div>`;
  const img = c.signature
    ? `<img src="${c.signature}" alt="" style="height:46px;max-width:160px;object-fit:contain;display:block;margin:0 auto 2px;" />`
    : `<div style="height:48px;border-bottom:1px solid #111;margin-bottom:4px;"></div>`;
  const name = c.name ? `<div style="font-weight:600;">${c.name}</div>` : "";
  const role = c.role ? `<div style="color:#475569;font-size:12px;">${c.role}</div>` : `<div style="color:#475569;font-size:12px;">${label}</div>`;
  const phone = c.phone ? `<div style="color:#475569;font-size:11px;">${toBn(c.phone)}</div>` : "";
  return `<div>${img}${name}${role}${phone}</div>`;
}

function buildClosureHtml(p: { samitiName: string; logo?: string; memberName: string; memberSerial?: number; loanNo?: number; loanAmount: number; interestRate: number; durationMonths: number; totalDue: number; totalPaid: number; loanDate: string; closeDate: string; certNo: string; committee?: MPCommittee[] }, qr?: string) {
  return `<style>
    @page{size:A4 landscape;margin:10mm}
    @media print{html,body{width:297mm;margin:0;padding:0}body{padding:0 !important}#r{width:277mm !important;max-width:none !important;margin:0 auto !important;box-sizing:border-box}}
    #r.closure{width:277mm;max-width:100%;margin:0 auto;padding:18px 28px;box-sizing:border-box;border:3px solid #15803d;border-radius:10px;}
    #r.closure .header{gap:20px;margin-bottom:10px;padding-bottom:10px;border-bottom:2px solid #bbf7d0;}
    #r.closure .logo{width:110px;height:110px;border-radius:10px;}
    #r.closure .title{font-size:36px;line-height:1.15;color:#14532d;}
    #r.closure .sub{font-size:18px;margin-top:6px;}
    #r.closure .grid{grid-template-columns:1fr 1fr 1fr;gap:10px 24px;font-size:15px;margin-top:18px;}
    #r.closure .certify{margin-top:18px;padding:18px 22px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:17px;line-height:2;text-align:center;}
    #r.closure .totals{grid-template-columns:1fr 1fr;gap:10px 24px;font-size:16px;margin-top:14px;}
    #r.closure .signs{display:flex;justify-content:space-between;gap:24px;margin-top:64px;font-size:14px;}
    #r.closure .signs > div{flex:1;text-align:center;}
  </style>
  <div class="r closure" id="r">
    <div class="header">
      ${p.logo ? `<img src="${p.logo}" alt="logo" class="logo"/>` : ""}
      <div class="head-text"><div class="title">${p.samitiName}</div><div class="sub" style="color:#15803d;font-weight:700;letter-spacing:1px;">ঋণ পরিশোধ সনদ</div></div>
    </div>
    <div class="grid">
      <div><span class="muted">সনদ নং:</span> <b>${p.certNo}</b></div>
      <div><span class="muted">ইস্যু তারিখ:</span> <b>${fmtDate(p.closeDate)}</b></div>
      ${p.loanNo ? `<div><span class="muted">ঋণ নং:</span> <b>${toBn(p.loanNo)}</b></div>` : "<div></div>"}
      <div class="full"><span class="muted">সদস্য:</span> <b>${p.memberSerial ? `${toBn(p.memberSerial)}. ` : ""}${p.memberName}</b></div>
      <div><span class="muted">ঋণ গ্রহণ তারিখ:</span> <b>${fmtDate(p.loanDate)}</b></div>
      <div><span class="muted">মেয়াদ:</span> <b>${toBn(p.durationMonths)} মাস</b></div>
    </div>
    <div class="certify">
      এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, উপরোক্ত সদস্য তাঁর গৃহীত (মোট প্রদেয় <b>${formatTk(p.totalDue)}</b> টাকা, মেয়াদ <b>${toBn(p.durationMonths)}</b> মাস) সম্পূর্ণরূপে পরিশোধ করেছেন। তাঁহার <b>${toBn(p.loanNo ?? 0)}</b> নং ঋণের কোনো বকেয়া নেই।
    </div>
    <div class="totals">
      <div><span class="muted">মোট প্রদেয়:</span> <b>${formatTk(p.totalDue)}</b></div>
      <div><span class="muted">মোট পরিশোধিত:</span> <b style="color:#15803d;">${formatTk(p.totalPaid)}</b></div>
    </div>
    ${qrBlock(qr, "certificate")}
    <div class="signs">
      <div>—————————————<br/>সদস্যের স্বাক্ষর</div>
      <div>—————————————<br/>কোষাধ্যক্ষের স্বাক্ষর</div>
      <div>—————————————<br/>সভাপতির স্বাক্ষর</div>
    </div>
  </div>`;
}

async function renderHtmlToCanvas(html: string): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:600px;height:10px;border:0;";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${receiptCss}</style></head><body>${html}</body></html>`);
    doc.close();
    await new Promise((r) => setTimeout(r, 60));
    const target = doc.getElementById("r")!;
    return await html2canvas(target, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: 600, windowHeight: target.scrollHeight + 40 });
  } finally {
    document.body.removeChild(iframe);
  }
}

function printHtml(title: string, html: string) {
  const w = window.open("", "_blank", "width=700,height=800");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${receiptCss}</style></head><body>${html}<script>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}

export function MemberPortal() {
  const fetchView = useServerFn(getMyMemberView);
  const [data, setData] = useState<MemberViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ title: string; html: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchView();
        if (alive) setData(r);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "ত্রুটি");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [fetchView]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const srcDoc = viewing
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${receiptCss}</style></head><body>${viewing.html}</body></html>`
    : "";

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {data?.samitiLogo ? (
            <img src={data.samitiLogo} alt="logo" className="h-9 w-9 rounded-lg object-cover ring-1 ring-border bg-white shrink-0" />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shrink-0">স</div>
          )}
          <div className="min-w-0">
            <h1 className="font-bold text-foreground truncate">{data?.samitiName || "সমিতি"}</h1>
            {data?.member && (
              <p className="text-xs text-muted-foreground truncate">
                সদস্য: {data.member.serial ? `${toBn(data.member.serial)}. ` : ""}{data.member.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CloudStatusBadge />
          <NotificationBell />
          <SignOutButton />
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-6 space-y-6">
        {(err || (data && !data.ok)) && (
          <Card>
            <CardContent className="flex items-start gap-3 pt-6">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">তথ্য পাওয়া যায়নি</div>
                <div className="text-sm text-muted-foreground mt-1">{err || data?.error}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {data?.ok && (
          <>
            {data.summary && <SamitiSummaryCard summary={data.summary} member={data.member} />}
            {data.member && <MemberProfileCard member={data.member} data={data} />}
            <LoansSection data={data} onView={(title, html) => setViewing({ title, html })} />
            <InstallmentReceiptsSection data={data} onView={(title, html) => setViewing({ title, html })} />
            <DepositReceiptsSection data={data} onView={(title, html) => setViewing({ title, html })} />
          </>
        )}
      </main>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>{viewing?.title || "রিসিপ্ট"}</DialogTitle>
          </DialogHeader>
          <iframe title="receipt" srcDoc={srcDoc} className="w-full h-[70vh] bg-white border-0" />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SamitiSummaryCard({ summary, member }: { summary: NonNullable<MemberViewResponse["summary"]>; member: MemberViewResponse["member"] }) {
  const items = [
    { icon: Users, label: "মোট সদস্য", value: toBn(summary.totalMembers), color: "text-blue-600" },
    { icon: PiggyBank, label: "মোট সঞ্চয়", value: formatTk(summary.totalDeposits), color: "text-green-600" },
    { icon: HandCoins, label: "মোট ঋণ বিতরণ", value: formatTk(summary.totalLoanAmount), color: "text-amber-600" },
    { icon: TrendingUp, label: "চলমান/পরিশোধিত ঋণ", value: `${toBn(summary.activeLoans)} / ${toBn(summary.closedLoans)}`, color: "text-purple-600" },
    { icon: Wallet, label: "মোট আদায়", value: formatTk(summary.totalPayments), color: "text-emerald-600" },
    { icon: AlertTriangle, label: "মোট বকেয়া", value: formatTk(summary.totalRemaining), color: "text-destructive" },
  ];
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5 text-primary" /> সমিতির সারাংশ
        </CardTitle>
        <CardDescription>সদস্য {member?.name || ""} হিসেবে সমিতির সামগ্রিক চিত্র</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div key={it.label} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={`h-4 w-4 ${it.color}`} /> {it.label}</div>
                <div className="font-semibold text-base mt-1">{it.value}</div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function MemberProfileCard({ member, data }: { member: NonNullable<MemberViewResponse["member"]>; data: MemberViewResponse }) {
  const myDeposits = data.deposits.reduce((s, d) => s + d.amount, 0);
  const myPaid = data.payments.reduce((s, p) => s + p.amount, 0);
  const myLoanDue = data.loans.reduce((s, l) => s + l.amount + (l.amount * l.interestRate * l.durationMonths) / 1200, 0);
  const myRemaining = Math.max(0, myLoanDue - myPaid);
  const fields: { icon: any; label: string; value?: string }[] = [
    { icon: Hash, label: "সদস্য নং", value: member.serial ? toBn(member.serial) : undefined },
    { icon: Calendar, label: "যোগদান তারিখ", value: fmtDate(member.joinDate ?? "") },
    { icon: Calendar, label: "জন্ম তারিখ", value: fmtDate(member.birthDate ?? "") },
    { icon: Phone, label: "মোবাইল", value: member.phone },
    { icon: MapPin, label: "ঠিকানা", value: member.address },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-5 w-5 text-primary" /> সদস্য প্রোফাইল
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          {member.photo ? (
            <img src={member.photo} alt={member.name} className="h-20 w-20 rounded-xl object-cover ring-1 ring-border bg-white shrink-0" />
          ) : (
            <div className="h-20 w-20 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl shrink-0">
              {member.name.charAt(0) || "স"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-lg truncate">{member.name}</div>
            <div className="text-sm text-muted-foreground mt-0.5 grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4">
              {member.fatherName && <div>পিতা: {member.fatherName}</div>}
              {member.motherName && <div>মাতা: {member.motherName}</div>}
              {member.nid && <div>জাতীয় পরিচয়পত্র: {toBn(member.nid)}</div>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-4 pt-4 border-t">
          {fields.filter((f) => f.value && f.value !== "—").map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.label} className="flex items-start gap-2">
                <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <div className="text-[11px] text-muted-foreground">{f.label}</div>
                  <div className="text-sm font-medium">{f.value}</div>
                </div>
              </div>
            );
          })}
        </div>
        {member.nominee && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm font-medium mb-2">নমিনি তথ্য</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div><span className="text-muted-foreground text-xs">নাম:</span> {member.nominee.name}</div>
              <div><span className="text-muted-foreground text-xs">সম্পর্ক:</span> {member.nominee.relation}</div>
              <div><span className="text-muted-foreground text-xs">মোবাইল:</span> {member.nominee.phone}</div>
              <div><span className="text-muted-foreground text-xs">জাতীয় পরিচয়পত্র:</span> {member.nominee.nid}</div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t">
          <div className="rounded-md bg-green-500/10 p-2">
            <div className="text-[11px] text-muted-foreground">আমার সঞ্চয়</div>
            <div className="font-semibold text-green-700">{formatTk(myDeposits)}</div>
          </div>
          <div className="rounded-md bg-amber-500/10 p-2">
            <div className="text-[11px] text-muted-foreground">আমার ঋণ ({toBn(data.loans.length)})</div>
            <div className="font-semibold text-amber-700">{formatTk(myLoanDue)}</div>
          </div>
          <div className="rounded-md bg-emerald-500/10 p-2">
            <div className="text-[11px] text-muted-foreground">পরিশোধিত</div>
            <div className="font-semibold text-emerald-700">{formatTk(myPaid)}</div>
          </div>
          <div className="rounded-md bg-destructive/10 p-2">
            <div className="text-[11px] text-muted-foreground">বকেয়া</div>
            <div className="font-semibold text-destructive">{formatTk(myRemaining)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoansSection({ data, onView }: { data: MemberViewResponse; onView: (title: string, html: string) => void }) {
  const loans = data.loans;
  if (loans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HandCoins className="h-5 w-5 text-primary" /> আমার ঋণ</CardTitle>
          <CardDescription>আপনার নামে কোনো ঋণ নেই।</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><HandCoins className="h-5 w-5 text-primary" /> আমার ঋণ</CardTitle>
        <CardDescription>মোট {toBn(loans.length)}টি ঋণ</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loans.map((l, idx) => {
          const paid = data.payments.filter((p) => p.loanId === l.id).reduce((s, p) => s + p.amount, 0);
          const totalDue = loanTotalDue(l);
          const remaining = Math.max(0, totalDue - paid);
          const inst = monthlyInstallment(l.amount, l.interestRate, l.durationMonths);
          return (
            <div key={l.id} className="rounded-lg border p-4 bg-card">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-semibold">
                  সমিতির ঋণ নং {toBn(l.samitiLoanNo ?? idx + 1)}
                  <span className="text-muted-foreground font-normal"> · সদস্য ঋণ নং {toBn(idx + 1)}</span>
                </div>
                <Badge variant={l.status === "active" ? "default" : "secondary"}>
                  {l.status === "active" ? "চলমান" : "পরিশোধিত"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm">
                <div><div className="text-muted-foreground text-xs">মূল ঋণ</div><div className="font-medium">{formatTk(totalDue)}</div></div>
                <div><div className="text-muted-foreground text-xs">মেয়াদ</div><div className="font-medium">{toBn(l.durationMonths)} মাস</div></div>
                <div><div className="text-muted-foreground text-xs">তারিখ</div><div className="font-medium">{fmtDate(l.date)}</div></div>
                <div><div className="text-muted-foreground text-xs">মাসিক কিস্তি</div><div className="font-medium">{formatTk(inst)}</div></div>
                <div><div className="text-muted-foreground text-xs">পরিশোধিত</div><div className="font-medium text-success">{formatTk(paid)}</div></div>
                <div><div className="text-muted-foreground text-xs">বকেয়া</div><div className={`font-semibold ${remaining > 0 ? "text-destructive" : "text-success"}`}>{formatTk(remaining)}</div></div>
              </div>
              {l.status === "closed" && data.member && (
                <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t">
                  <Button size="sm" variant="outline" onClick={async () => {
                    const lastPay = [...data.payments].filter((p) => p.loanId === l.id).sort((a, b) => b.date.localeCompare(a.date))[0];
                    const closeDate = lastPay?.date || new Date().toISOString().slice(0, 10);
                    const certNo = `C-${toBn(l.samitiLoanNo ?? idx + 1)}`;
                    const { dataUrl } = await buildReceiptQr({
                      t: "installment", s: data.samitiName, n: certNo, m: data.member!.name,
                      a: paid, d: closeDate, pa: paid, ra: 0, ln: l.samitiLoanNo ?? idx + 1,
                    });
                    const html = buildClosureHtml({
                      samitiName: data.samitiName, logo: data.samitiLogo, memberName: data.member!.name, memberSerial: data.member!.serial,
                      loanNo: l.samitiLoanNo ?? idx + 1, loanAmount: l.amount, interestRate: l.interestRate, durationMonths: l.durationMonths,
                      totalDue, totalPaid: paid, loanDate: l.date, closeDate, certNo,
                    }, dataUrl);
                    onView("ঋণ পরিশোধ সনদ", html);
                  }}><Eye className="h-4 w-4 mr-1" /> সনদ দেখুন</Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    const lastPay = [...data.payments].filter((p) => p.loanId === l.id).sort((a, b) => b.date.localeCompare(a.date))[0];
                    const closeDate = lastPay?.date || new Date().toISOString().slice(0, 10);
                    const certNo = `C-${toBn(l.samitiLoanNo ?? idx + 1)}`;
                    const { dataUrl } = await buildReceiptQr({
                      t: "installment", s: data.samitiName, n: certNo, m: data.member!.name,
                      a: paid, d: closeDate, pa: paid, ra: 0, ln: l.samitiLoanNo ?? idx + 1,
                    });
                    const html = buildClosureHtml({
                      samitiName: data.samitiName, logo: data.samitiLogo, memberName: data.member!.name, memberSerial: data.member!.serial,
                      loanNo: l.samitiLoanNo ?? idx + 1, loanAmount: l.amount, interestRate: l.interestRate, durationMonths: l.durationMonths,
                      totalDue, totalPaid: paid, loanDate: l.date, closeDate, certNo,
                    }, dataUrl);
                    printHtml("ঋণ পরিশোধ সনদ", html);
                  }}><Printer className="h-4 w-4 mr-1" /> প্রিন্ট</Button>
                  <Button size="sm" variant="outline" onClick={async () => {
                    const lastPay = [...data.payments].filter((p) => p.loanId === l.id).sort((a, b) => b.date.localeCompare(a.date))[0];
                    const closeDate = lastPay?.date || new Date().toISOString().slice(0, 10);
                    const certNo = `C-${toBn(l.samitiLoanNo ?? idx + 1)}`;
                    const { dataUrl } = await buildReceiptQr({
                      t: "installment", s: data.samitiName, n: certNo, m: data.member!.name,
                      a: paid, d: closeDate, pa: paid, ra: 0, ln: l.samitiLoanNo ?? idx + 1,
                    });
                    const html = buildClosureHtml({
                      samitiName: data.samitiName, logo: data.samitiLogo, memberName: data.member!.name, memberSerial: data.member!.serial,
                      loanNo: l.samitiLoanNo ?? idx + 1, loanAmount: l.amount, interestRate: l.interestRate, durationMonths: l.durationMonths,
                      totalDue, totalPaid: paid, loanDate: l.date, closeDate, certNo,
                    }, dataUrl);
                    const canvas = await renderHtmlToCanvas(html);
                    const link = document.createElement("a");
                    link.href = canvas.toDataURL("image/jpeg", 0.92);
                    link.download = `ঋণ-সনদ-${certNo}.jpg`;
                    link.click();
                  }}><ImageDown className="h-4 w-4 mr-1" /> ছবি</Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function InstallmentReceiptsSection({ data, onView }: { data: MemberViewResponse; onView: (title: string, html: string) => void }) {
  const rows = useMemo(() => {
    const loanIndex = new Map(data.loans.map((l, i) => [l.id, l.samitiLoanNo ?? i + 1]));
    const sorted = [...data.payments].sort((a, b) => b.date.localeCompare(a.date));
    // compute paid-after & per-loan payment index in chronological order
    const chrono = [...data.payments].sort((a, b) => a.date.localeCompare(b.date));
    const cumByLoan: Record<string, number> = {};
    const idxByLoan: Record<string, number> = {};
    const paidAfter = new Map<string, number>();
    const payIdx = new Map<string, number>();
    for (const p of chrono) {
      cumByLoan[p.loanId] = (cumByLoan[p.loanId] ?? 0) + p.amount;
      idxByLoan[p.loanId] = (idxByLoan[p.loanId] ?? 0) + 1;
      paidAfter.set(p.id, cumByLoan[p.loanId]);
      payIdx.set(p.id, idxByLoan[p.loanId]);
    }
    return sorted.map((p) => {
      const loan = data.loans.find((l) => l.id === p.loanId);
      const totalDue = loan ? loanTotalDue(loan) : 0;
      const paid = paidAfter.get(p.id) ?? p.amount;
      const loanNo = loanIndex.get(p.loanId);
      const pi = payIdx.get(p.id) ?? 1;
      return {
        p,
        loan,
        loanNo,
        paidAfter: paid,
        remainingAfter: Math.max(0, totalDue - paid),
        receiptNo: `R-${toBn(loanNo ?? 0)}-${toBn(pi)}`,
      };
    });
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ReceiptIcon className="h-5 w-5 text-primary" /> কিস্তি জমার রিসিপ্ট</CardTitle>
        <CardDescription>মোট {toBn(rows.length)}টি কিস্তি</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">কোনো কিস্তি পাওয়া যায়নি।</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>তারিখ</TableHead>
                  <TableHead>ঋণ নং</TableHead>
                  <TableHead className="text-right">কিস্তি</TableHead>
                  <TableHead className="text-right">বকেয়া</TableHead>
                  <TableHead className="text-right">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.p.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.p.date)}</TableCell>
                    <TableCell>{r.loanNo ? toBn(r.loanNo) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatTk(r.p.amount)}</TableCell>
                    <TableCell className="text-right text-destructive">{formatTk(r.remainingAfter)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={async () => {
                          if (!r.loan || !data.member) return;
                          const { dataUrl } = await buildReceiptQr({
                            t: "installment", s: data.samitiName, n: r.receiptNo, m: data.member.name,
                            a: r.p.amount, d: r.p.date, pa: r.paidAfter, ra: r.remainingAfter, ln: r.loanNo,
                          });
                          const html = buildInstallmentHtml({
                            samitiName: data.samitiName, logo: data.samitiLogo, memberName: data.member.name,
                            loanAmount: r.loan.amount, durationMonths: r.loan.durationMonths,
                            amount: r.p.amount, date: r.p.date, paidAfter: r.paidAfter, remainingAfter: r.remainingAfter,
                            receiptNo: r.receiptNo, note: r.p.note, loanNo: r.loanNo, cashierName: data.cashier?.name, cashierId: data.cashier?.identifier,
                          }, dataUrl);
                          onView("কিস্তি রিসিপ্ট", html);
                        }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={async () => {
                          if (!r.loan || !data.member) return;
                          const { dataUrl } = await buildReceiptQr({
                            t: "installment", s: data.samitiName, n: r.receiptNo, m: data.member.name,
                            a: r.p.amount, d: r.p.date, pa: r.paidAfter, ra: r.remainingAfter, ln: r.loanNo,
                          });
                          const html = buildInstallmentHtml({
                            samitiName: data.samitiName, logo: data.samitiLogo, memberName: data.member.name,
                            loanAmount: r.loan.amount, durationMonths: r.loan.durationMonths,
                            amount: r.p.amount, date: r.p.date, paidAfter: r.paidAfter, remainingAfter: r.remainingAfter,
                            receiptNo: r.receiptNo, note: r.p.note, loanNo: r.loanNo, cashierName: data.cashier?.name, cashierId: data.cashier?.identifier,
                          }, dataUrl);
                          printHtml("কিস্তি রিসিপ্ট", html);
                        }}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={async () => {
                          if (!r.loan || !data.member) return;
                          const { dataUrl } = await buildReceiptQr({
                            t: "installment", s: data.samitiName, n: r.receiptNo, m: data.member.name,
                            a: r.p.amount, d: r.p.date, pa: r.paidAfter, ra: r.remainingAfter, ln: r.loanNo,
                          });
                          const html = buildInstallmentHtml({
                            samitiName: data.samitiName, logo: data.samitiLogo, memberName: data.member.name,
                            loanAmount: r.loan.amount, durationMonths: r.loan.durationMonths,
                            amount: r.p.amount, date: r.p.date, paidAfter: r.paidAfter, remainingAfter: r.remainingAfter,
                            receiptNo: r.receiptNo, note: r.p.note, loanNo: r.loanNo, cashierName: data.cashier?.name, cashierId: data.cashier?.identifier,
                          }, dataUrl);
                          const canvas = await renderHtmlToCanvas(html);
                          const link = document.createElement("a");
                          link.href = canvas.toDataURL("image/jpeg", 0.92);
                          link.download = `কিস্তি-${r.receiptNo}.jpg`;
                          link.click();
                        }}>
                          <ImageDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DepositReceiptsSection({ data, onView }: { data: MemberViewResponse; onView: (title: string, html: string) => void }) {
  const rows = useMemo(() => {
    const chrono = [...data.deposits].sort((a, b) => a.date.localeCompare(b.date));
    const totalAfter = new Map<string, number>();
    const depNo = new Map<string, number>();
    let cum = 0;
    chrono.forEach((d, i) => { cum += d.amount; totalAfter.set(d.id, cum); depNo.set(d.id, i + 1); });
    return [...data.deposits]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((d) => ({
        d,
        totalAfter: totalAfter.get(d.id) ?? d.amount,
        receiptNo: `D-${toBn(depNo.get(d.id) ?? 1)}`,
      }));
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><PiggyBank className="h-5 w-5 text-primary" /> সঞ্চয়/চাদা জমার রিসিপ্ট</CardTitle>
        <CardDescription>মোট {toBn(rows.length)}টি জমা</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">কোনো জমা পাওয়া যায়নি।</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>তারিখ</TableHead>
                  <TableHead className="text-right">জমা</TableHead>
                  <TableHead className="text-right">মোট সঞ্চয়</TableHead>
                  <TableHead className="text-right">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.d.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.d.date)}</TableCell>
                    <TableCell className="text-right font-medium text-success">{formatTk(r.d.amount)}</TableCell>
                    <TableCell className="text-right">{formatTk(r.totalAfter)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={async () => {
                          if (!data.member) return;
                          const { dataUrl } = await buildReceiptQr({
                            t: "deposit", s: data.samitiName, n: r.receiptNo, m: data.member.name,
                            a: r.d.amount, d: r.d.date, ms: data.member.serial, ta: r.totalAfter,
                          });
                          const html = buildDepositHtml({
                            samitiName: data.samitiName, logo: data.samitiLogo,
                            memberName: data.member.name, memberSerial: data.member.serial,
                            amount: r.d.amount, date: r.d.date, totalAfter: r.totalAfter,
                            receiptNo: r.receiptNo, note: r.d.note, cashierName: data.cashier?.name, cashierId: data.cashier?.identifier,
                          }, dataUrl);
                          onView("জমা রিসিপ্ট", html);
                        }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={async () => {
                          if (!data.member) return;
                          const { dataUrl } = await buildReceiptQr({
                            t: "deposit", s: data.samitiName, n: r.receiptNo, m: data.member.name,
                            a: r.d.amount, d: r.d.date, ms: data.member.serial, ta: r.totalAfter,
                          });
                          const html = buildDepositHtml({
                            samitiName: data.samitiName, logo: data.samitiLogo,
                            memberName: data.member.name, memberSerial: data.member.serial,
                            amount: r.d.amount, date: r.d.date, totalAfter: r.totalAfter,
                            receiptNo: r.receiptNo, note: r.d.note, cashierName: data.cashier?.name, cashierId: data.cashier?.identifier,
                          }, dataUrl);
                          printHtml("জমা রিসিপ্ট", html);
                        }}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={async () => {
                          if (!data.member) return;
                          const { dataUrl } = await buildReceiptQr({
                            t: "deposit", s: data.samitiName, n: r.receiptNo, m: data.member.name,
                            a: r.d.amount, d: r.d.date, ms: data.member.serial, ta: r.totalAfter,
                          });
                          const html = buildDepositHtml({
                            samitiName: data.samitiName, logo: data.samitiLogo,
                            memberName: data.member.name, memberSerial: data.member.serial,
                            amount: r.d.amount, date: r.d.date, totalAfter: r.totalAfter,
                            receiptNo: r.receiptNo, note: r.d.note, cashierName: data.cashier?.name, cashierId: data.cashier?.identifier,
                          }, dataUrl);
                          const canvas = await renderHtmlToCanvas(html);
                          const link = document.createElement("a");
                          link.href = canvas.toDataURL("image/jpeg", 0.92);
                          link.download = `জমা-${r.receiptNo}.jpg`;
                          link.click();
                        }}>
                          <ImageDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
