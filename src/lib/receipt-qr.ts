import QRCode from "qrcode";

export type VerifyPayload = {
  t: "deposit" | "installment";
  s: string; // samiti name
  n: string; // receipt no
  m: string; // member name
  a: number; // amount
  d: string; // date (YYYY-MM-DD)
  // optional extras
  ms?: number; // member serial
  ta?: number; // total after (deposit)
  pa?: number; // paid after (installment)
  ra?: number; // remaining after (installment)
  ln?: number; // loan no (installment)
};

function b64urlEncode(s: string): string {
  const b = typeof btoa !== "undefined"
    ? btoa(unescape(encodeURIComponent(s)))
    : Buffer.from(s, "utf-8").toString("base64");
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof atob !== "undefined") {
    return decodeURIComponent(escape(atob(b)));
  }
  return Buffer.from(b, "base64").toString("utf-8");
}

export function buildVerifyUrl(payload: VerifyPayload): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const encoded = b64urlEncode(JSON.stringify(payload));
  return `${origin}/verify?d=${encoded}`;
}

export async function makeQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: { dark: "#111111", light: "#ffffff" },
  });
}

export async function buildReceiptQr(payload: VerifyPayload): Promise<{ url: string; dataUrl: string }> {
  const url = buildVerifyUrl(payload);
  const dataUrl = await makeQrDataUrl(url);
  return { url, dataUrl };
}
