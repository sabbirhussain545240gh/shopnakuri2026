import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, HandCoins, PiggyBank, Receipt as ReceiptIcon, Printer, ImageDown, AlertTriangle, User, Phone, MapPin, Calendar, Hash } from "lucide-react";
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
  .header{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:6px;}
  .logo{width:54px;height:54px;object-fit:contain;border-radius:6px;}
  .head-text{text-align:center;}
  .title{font-size:20px;font-weight:700;margin:0;}
  .sub{font-size:12px;color:#666;margin-top:2px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;font-size:13px;}
  .grid .full{grid-column:1 / -1;}
  .muted{color:#666;}
  .row{display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1px solid #eee;font-size:15px;}
  .amount{font-weight:700;color:#15803d;}
  .totals{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;font-size:13px;}
  .due{color:#b91c1c;font-weight:600;}
  .note{margin-top:10px;padding-top:8px;border-top:1px solid #eee;font-size:13px;white-space:pre-wrap;}
  .sign{display:flex;justify-content:space-between;margin-top:32px;font-size:12px;color:#666;}
  .qr{margin-top:14px;padding-top:10px;border-top:1px dashed #ccc;display:flex;align-items:center;gap:12px;}
  .qr img{width:110px;height:110px;}
  .qr .qr-text{font-size:11px;color:#555;line-height:1.5;}
  .qr .qr-text b{color:#111;font-size:12px;}
  @media print{body{padding:0;} .no-print{display:none;}}
`;

const qrBlock = (qr?: string) =>
  qr
    ? `<div class="qr"><img src="${qr}" alt="QR"/><div class="qr-text"><b>যাচাই করুন</b><br/>এই QR কোডটি স্ক্যান করে রিসিপ্টের তথ্য যাচাই করতে পারবেন।</div></div>`
    : "";

function buildDepositHtml(p: { samitiName: string; logo?: string; memberName: string; memberSerial?: number; amount: number; date: string; totalAfter: number; receiptNo: string; note?: string }, qr?: string) {
  return `<div class="r" id="r">
    <div class="header">${p.logo ? `<img src="${p.logo}" class="logo"/>` : ""}<div class="head-text"><div class="title">${p.samitiName}</div><div class="sub">সঞ্চয়/চাদা জমা রিসিপ্ট</div></div></div>
    <div class="grid">
      <div><span class="muted">রিসিপ্ট নং:</span> <b>${p.receiptNo}</b></div>
      <div><span class="muted">তারিখ:</span> <b>${fmtDate(p.date)}</b></div>
      <div class="full"><span class="muted">সদস্য:</span> <b>${p.memberSerial ? `${toBn(p.memberSerial)}. ` : ""}${p.memberName}</b></div>
    </div>
    <div class="row"><span>জমার পরিমাণ</span><span class="amount">${formatTk(p.amount)}</span></div>
    <div class="totals"><div class="full"><span class="muted">মোট সঞ্চয় (এই জমা সহ):</span> <b>${formatTk(p.totalAfter)}</b></div></div>
    ${p.note ? `<div class="note"><span class="muted">নোট:</span> <b>${p.note.replace(/</g, "&lt;")}</b></div>` : ""}
    ${qrBlock(qr)}
    <div class="sign"><div>—————————<br/>গ্রহীতা</div><div style="text-align:right">—————————<br/>কোষাধ্যক্ষ</div></div>
  </div>`;
}

function buildInstallmentHtml(p: { samitiName: string; logo?: string; memberName: string; loanAmount: number; durationMonths: number; amount: number; date: string; paidAfter: number; remainingAfter: number; receiptNo: string; note?: string; loanNo?: number }, qr?: string) {
  return `<div class="r" id="r">
    <div class="header">${p.logo ? `<img src="${p.logo}" class="logo"/>` : ""}<div class="head-text"><div class="title">${p.samitiName}</div><div class="sub">কিস্তি প্রাপ্তি রিসিপ্ট</div></div></div>
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
            <LoansSection data={data} />
            <InstallmentReceiptsSection data={data} />
            <DepositReceiptsSection data={data} />
          </>
        )}
      </main>
    </div>
  );
}

function LoansSection({ data }: { data: MemberViewResponse }) {
  const loans = data.loans;
  if (loans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HandCoins className="h-5 w-5 text-primary" /> আপনার ঋণ</CardTitle>
          <CardDescription>আপনার নামে কোনো ঋণ নেই।</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><HandCoins className="h-5 w-5 text-primary" /> আপনার ঋণ</CardTitle>
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
                <div className="font-semibold">ঋণ নং {toBn(idx + 1)}</div>
                <Badge variant={l.status === "active" ? "default" : "secondary"}>
                  {l.status === "active" ? "চলমান" : "পরিশোধিত"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm">
                <div><div className="text-muted-foreground text-xs">ঋণ মূল</div><div className="font-medium">{formatTk(l.amount)}</div></div>
                <div><div className="text-muted-foreground text-xs">সুদ (বার্ষিক)</div><div className="font-medium">{toBn(l.interestRate)}%</div></div>
                <div><div className="text-muted-foreground text-xs">মেয়াদ</div><div className="font-medium">{toBn(l.durationMonths)} মাস</div></div>
                <div><div className="text-muted-foreground text-xs">তারিখ</div><div className="font-medium">{fmtDate(l.date)}</div></div>
                <div><div className="text-muted-foreground text-xs">মাসিক কিস্তি</div><div className="font-medium">{formatTk(inst)}</div></div>
                <div><div className="text-muted-foreground text-xs">মোট প্রাপ্য</div><div className="font-medium">{formatTk(totalDue)}</div></div>
                <div><div className="text-muted-foreground text-xs">পরিশোধিত</div><div className="font-medium text-success">{formatTk(paid)}</div></div>
                <div><div className="text-muted-foreground text-xs">বকেয়া</div><div className={`font-semibold ${remaining > 0 ? "text-destructive" : "text-success"}`}>{formatTk(remaining)}</div></div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function InstallmentReceiptsSection({ data }: { data: MemberViewResponse }) {
  const rows = useMemo(() => {
    const loanIndex = new Map(data.loans.map((l, i) => [l.id, i + 1]));
    const sorted = [...data.payments].sort((a, b) => b.date.localeCompare(a.date));
    // compute paid-after per loan in chronological order
    const chrono = [...data.payments].sort((a, b) => a.date.localeCompare(b.date));
    const cumByLoan: Record<string, number> = {};
    const paidAfter = new Map<string, number>();
    for (const p of chrono) {
      cumByLoan[p.loanId] = (cumByLoan[p.loanId] ?? 0) + p.amount;
      paidAfter.set(p.id, cumByLoan[p.loanId]);
    }
    return sorted.map((p) => {
      const loan = data.loans.find((l) => l.id === p.loanId);
      const totalDue = loan ? loanTotalDue(loan) : 0;
      const paid = paidAfter.get(p.id) ?? p.amount;
      return {
        p,
        loan,
        loanNo: loanIndex.get(p.loanId),
        paidAfter: paid,
        remainingAfter: Math.max(0, totalDue - paid),
        receiptNo: `R-${p.id.slice(0, 6).toUpperCase()}`,
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
                            receiptNo: r.receiptNo, note: r.p.note, loanNo: r.loanNo,
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
                            receiptNo: r.receiptNo, note: r.p.note, loanNo: r.loanNo,
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

function DepositReceiptsSection({ data }: { data: MemberViewResponse }) {
  const rows = useMemo(() => {
    const chrono = [...data.deposits].sort((a, b) => a.date.localeCompare(b.date));
    const totalAfter = new Map<string, number>();
    let cum = 0;
    for (const d of chrono) { cum += d.amount; totalAfter.set(d.id, cum); }
    return [...data.deposits]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((d) => ({
        d,
        totalAfter: totalAfter.get(d.id) ?? d.amount,
        receiptNo: `D-${d.id.slice(0, 6).toUpperCase()}`,
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
                            receiptNo: r.receiptNo, note: r.d.note,
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
                            receiptNo: r.receiptNo, note: r.d.note,
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
