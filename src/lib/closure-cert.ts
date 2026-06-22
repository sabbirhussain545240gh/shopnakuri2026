import { toBn, formatTk, type CommitteeMember } from "@/lib/samiti-store";
import { buildReceiptQr } from "@/lib/receipt-qr";

function findCommittee(committee: CommitteeMember[] | undefined, keywords: string[]) {
  if (!committee) return null;
  return committee.find((c) => keywords.some((k) => (c.role || "").includes(k))) || null;
}

function signBlock(label: string, c: CommitteeMember | null) {
  if (!c) return `<div><div style="height:48px;border-bottom:1px solid #111;margin-bottom:4px;"></div>${label}</div>`;
  const img = c.signature
    ? `<img src="${c.signature}" alt="" style="height:46px;max-width:160px;object-fit:contain;display:block;margin:0 auto 2px;" />`
    : `<div style="height:48px;border-bottom:1px solid #111;margin-bottom:4px;"></div>`;
  const name = c.name ? `<div style="font-weight:600;">${c.name}</div>` : "";
  const role = c.role ? `<div style="color:#475569;font-size:12px;">${c.role}</div>` : `<div style="color:#475569;font-size:12px;">${label}</div>`;
  const phone = c.phone ? `<div style="color:#475569;font-size:11px;">${toBn(c.phone)}</div>` : "";
  return `<div>${img}${name}${role}${phone}</div>`;
}

function fmtDate(d: string) {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  if (!y || !m || !dd) return d;
  return `${toBn(dd)}/${toBn(m)}/${toBn(y)}`;
}

export const closureCss = `
  body{margin:0;padding:20px;background:#fff;color:#111;font-family:"Segoe UI","Noto Sans Bengali",Arial,sans-serif;}
  .r{background:#fff;margin:0 auto;}
  .header{display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:6px;}
  .head-text{text-align:center;}
  .title{font-weight:700;margin:0;}
  .sub{margin-top:2px;}
  .muted{color:#666;}
  .grid{display:grid;}
  .totals{display:grid;}
  .full{grid-column:1 / -1;}
  .qr{margin-top:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;display:flex;align-items:center;gap:14px;background:#fff;break-inside:avoid;}
  .qr-frame{padding:10px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;}
  .qr-frame img{width:145px;height:145px;display:block;image-rendering:pixelated;}
  .qr-info{flex:1;font-size:11px;color:#475569;line-height:1.55;}
  .qr-info .qr-title{display:inline-flex;align-items:center;gap:6px;color:#0f172a;font-size:12px;font-weight:700;margin-bottom:4px;}
  .qr-info .qr-badge{display:inline-block;background:#0f172a;color:#fff;font-size:9px;padding:2px 6px;border-radius:3px;letter-spacing:0.5px;margin-top:6px;}
  @media print{body{padding:0;} .no-print{display:none;}}
`;

const qrBlock = (qrDataUrl?: string) =>
  qrDataUrl
    ? `<div class="qr">
        <div class="qr-frame"><img src="${qrDataUrl}" alt="QR" /></div>
        <div class="qr-info">
          <div class="qr-title">যাচাইকৃত ডিজিটাল সনদ</div>
          মোবাইল ক্যামেরা দিয়ে এই QR কোডটি স্ক্যান করে ঋণ পরিশোধ সনদের সত্যতা ও সদস্যের পরিশোধ তথ্য যাচাই করুন।
          <div class="qr-badge">SECURE • VERIFY</div>
        </div>
      </div>`
    : "";

export type ClosureInput = {
  samitiName: string;
  logo?: string;
  memberName: string;
  memberSerial?: number;
  loanNo?: number;
  loanAmount: number;
  interestRate: number;
  durationMonths: number;
  totalDue: number;
  totalPaid: number;
  loanDate: string;
  closeDate: string;
  certNo: string;
  committee?: CommitteeMember[];
};

export function buildClosureHtml(p: ClosureInput, qr?: string) {
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
    ${qrBlock(qr)}
    <div class="signs">
      <div>—————————————<br/>সদস্যের স্বাক্ষর</div>
      <div>—————————————<br/>কোষাধ্যক্ষের স্বাক্ষর</div>
      <div>—————————————<br/>সভাপতির স্বাক্ষর</div>
    </div>
  </div>`;
}

export async function buildClosureWithQr(p: ClosureInput) {
  const { dataUrl } = await buildReceiptQr({
    t: "installment", s: p.samitiName, n: p.certNo, m: p.memberName,
    a: p.totalPaid, d: p.closeDate, pa: p.totalPaid, ra: 0, ln: p.loanNo ?? 0,
  });
  return buildClosureHtml(p, dataUrl);
}

export function printClosureHtml(html: string, title = "ঋণ পরিশোধ সনদ") {
  const w = window.open("", "_blank", "width=900,height=800");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${closureCss}</style></head><body>${html}<script>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
}

export function closureSrcDoc(html: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${closureCss}</style></head><body>${html}</body></html>`;
}
