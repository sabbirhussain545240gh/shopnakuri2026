import { toBn } from "@/lib/samiti-store";

export type MemberCardInput = {
  serial?: number;
  name: string;
  fatherName?: string;
  motherName?: string;
  phone?: string;
  birthDate?: string;
  nid?: string;
  address?: string;
  photo?: string;
  joinDate?: string;
  nominee?: { name?: string; relation?: string; phone?: string; nid?: string } | null;
};

export type SamitiInfo = {
  samitiName: string;
  samitiLogo?: string;
  samitiAddress?: string;
  establishedDate?: string;
};

const fmtDate = (s?: string) => formatDateStr(s);

export function buildMemberCardHtml(member: MemberCardInput, samiti: SamitiInfo) {
  const headerHtml = `
    <div style="display:flex;align-items:center;gap:16px;border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:16px;">
      ${samiti.samitiLogo ? `<img src="${samiti.samitiLogo}" style="width:100px;height:100px;object-fit:contain;" crossorigin="anonymous" />` : ""}
      <div style="flex:1;text-align:center;">
        <h1 style="margin:0;font-size:28px;">${samiti.samitiName}</h1>
        ${samiti.samitiAddress ? `<div style="font-size:15px;color:#444;margin-top:4px;">${samiti.samitiAddress}</div>` : ""}
        ${samiti.establishedDate ? `<div style="font-size:14px;color:#666;margin-top:4px;">স্থাপিত: ${samiti.establishedDate}</div>` : ""}
      </div>
      ${samiti.samitiLogo ? `<div style="width:100px;"></div>` : ""}
    </div>`;
  const photoHtml = member.photo
    ? `<img src="${member.photo}" style="width:120px;height:120px;object-fit:contain;background:#fff;border-radius:8px;border:1px solid #ddd;" crossorigin="anonymous" />`
    : `<div style="width:120px;height:120px;border-radius:8px;border:1px solid #ddd;background:#f5f5f5;display:flex;align-items:center;justify-content:center;color:#888;font-size:12px;">ছবি নেই</div>`;
  const rows: [string, string][] = [
    ["সিরিয়াল নম্বর", toBn(member.serial || 0)],
    ["নাম", member.name || ""],
    ["পিতার নাম", member.fatherName || ""],
    ["মাতার নাম", member.motherName || ""],
    ["মোবাইল নং", member.phone ? toBn(member.phone) : ""],
    ["জন্ম তারিখ", member.birthDate ? fmtDate(member.birthDate) : ""],
    ["NID / জন্ম সনদ নং", member.nid ? toBn(member.nid) : ""],
    ["ঠিকানা", member.address || ""],
    ["যোগদানের তারিখ", fmtDate(member.joinDate)],
  ];
  const nomineeRows: [string, string][] = member.nominee
    ? [
        ["নমিনির নাম", member.nominee.name || ""],
        ["সম্পর্ক", member.nominee.relation || ""],
        ["মোবাইল", member.nominee.phone ? toBn(member.nominee.phone) : ""],
        ["NID / জন্ম সনদ", member.nominee.nid ? toBn(member.nominee.nid) : ""],
      ]
    : [];
  const tableRows = (items: [string, string][]) =>
    items.map(([k, v]) => `<tr><td style="padding:8px 12px;border:1px solid #ddd;background:rgba(250,250,250,0.35);font-weight:600;width:40%;">${k}</td><td style="padding:8px 12px;border:1px solid #ddd;background:transparent;">${v || "—"}</td></tr>`).join("");

  const watermarkHtml = samiti.samitiLogo
    ? `<div style="position:absolute;inset:0;background-image:url('${samiti.samitiLogo}');background-repeat:no-repeat;background-position:center;background-size:70% auto;opacity:0.15;pointer-events:none;z-index:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>`
    : "";
  return `
    <div style="max-width:640px;margin:auto;position:relative;">
      ${watermarkHtml}
      <div style="position:relative;z-index:1;">
        ${headerHtml}
        <div style="border:2px solid #333;padding:20px;border-radius:8px;position:relative;overflow:hidden;">
          ${watermarkHtml}
          <div style="position:relative;z-index:1;">
            <h2 style="text-align:center;margin:0 0 16px 0;font-size:20px;border-bottom:2px solid #333;padding-bottom:8px;">সদস্য তথ্য</h2>
            <div style="display:flex;gap:20px;align-items:flex-start;margin-bottom:16px;">
              ${photoHtml}
              <div style="flex:1;">
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                  ${tableRows(rows)}
                </table>
              </div>
            </div>
            ${nomineeRows.length ? `<h3 style="font-size:16px;border-bottom:1px solid #ccc;padding-bottom:6px;margin:16px 0 8px;">নমিনি তথ্য</h3><table style="width:100%;border-collapse:collapse;font-size:14px;">${tableRows(nomineeRows)}</table>` : ""}
          </div>
        </div>
      </div>
    </div>`;
}

export function printMemberCard(member: MemberCardInput, samiti: SamitiInfo) {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  const inner = buildMemberCardHtml(member, samiti);
  w.document.write(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8" /><title>সদস্য কার্ড - ${member.name}</title>
    <style>
      body { font-family: "Segoe UI", "Noto Sans Bengali", sans-serif; margin: 0; padding: 24px; background: #fff; color: #111; }
      @media print { body { padding: 0; } .no-print { display: none; } }
    </style></head>
    <body>
      <div class="no-print" style="margin-bottom:16px;">
        <button onclick="window.print()" style="padding:8px 16px;font-size:14px;cursor:pointer;">প্রিন্ট করুন</button>
      </div>
      ${inner}
      <script>setTimeout(()=>window.print(),300)</script>
    </body></html>
  `);
  w.document.close();
}

async function renderMemberCardCanvas(member: MemberCardInput, samiti: SamitiInfo): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  const inner = buildMemberCardHtml(member, samiti);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:720px;height:10px;border:0;";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;background:#ffffff;color:#111111;font-family:"Segoe UI","Noto Sans Bengali",Arial,sans-serif;}
      *{box-sizing:border-box;}
      h1,h2,h3,p,td,th,div{color:#111111;}
    </style></head><body><div id="r" style="width:680px;padding:20px;background:#fff;">${inner}</div></body></html>`);
    doc.close();
    const target = doc.getElementById("r")!;
    const imgs = Array.from(target.querySelectorAll("img"));
    await Promise.all(imgs.map((img) => img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = () => res(null); })));
    await new Promise((r) => setTimeout(r, 50));
    const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: 720, windowHeight: target.scrollHeight + 40 });
    return canvas;
  } finally {
    document.body.removeChild(iframe);
  }
}

export async function exportMemberCardJpeg(member: MemberCardInput, samiti: SamitiInfo) {
  const canvas = await renderMemberCardCanvas(member, samiti);
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/jpeg", 0.95);
  a.download = `member-${member.serial || ""}-${member.name}.jpg`;
  a.click();
}

export async function exportMemberCardPdf(member: MemberCardInput, samiti: SamitiInfo) {
  const canvas = await renderMemberCardCanvas(member, samiti);
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
  pdf.save(`member-${member.serial || ""}-${member.name}.pdf`);
}
