import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { b64urlDecode, type VerifyPayload } from "@/lib/receipt-qr";
import { toBn, formatTk } from "@/lib/samiti-store";

export const Route = createFileRoute("/verify")({
  component: VerifyPage,
  head: () => ({
    meta: [
      { title: "রিসিপ্ট ভেরিফাই" },
      { name: "description", content: "QR কোড স্ক্যান করে সমিতির রিসিপ্ট যাচাই করুন।" },
    ],
  }),
});

function fmtDateBn(s: string) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${toBn(d)}/${toBn(m)}/${toBn(y)}`;
}

function VerifyPage() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const payload = useMemo<VerifyPayload | null>(() => {
    try {
      const sp = new URLSearchParams(search);
      const d = sp.get("d");
      if (!d) return null;
      const json = b64urlDecode(d);
      return JSON.parse(json) as VerifyPayload;
    } catch {
      return null;
    }
  }, [search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 py-8 px-4">
      <div className="max-w-md mx-auto space-y-4">
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" />হোম</Button>
        </Link>

        {!payload ? (
          <Card className="border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-7 w-7 text-destructive" />
                </div>
                <div>
                  <CardTitle>অবৈধ QR</CardTitle>
                  <CardDescription>এই QR কোডের তথ্য পড়া যায়নি।</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ) : (
          <Card className="border-success/40">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-success" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">যাচাইকৃত রিসিপ্ট</CardTitle>
                  <CardDescription>
                    {payload.t === "deposit" ? "সঞ্চয়/চাদা জমা" : "কিস্তি প্রাপ্তি"} রিসিপ্ট
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md bg-muted/40 p-3 text-center">
                <div className="text-xs text-muted-foreground">সমিতি</div>
                <div className="text-base font-bold">{payload.s}</div>
              </div>
              <Row label="রিসিপ্ট নং" value={payload.n} />
              <Row label="তারিখ" value={fmtDateBn(payload.d)} />
              <Row label="সদস্য" value={`${payload.ms ? `${toBn(payload.ms)}. ` : ""}${payload.m}`} />
              {payload.ln ? <Row label="ঋণ নং" value={toBn(payload.ln)} /> : null}
              <div className="flex justify-between items-center border-t pt-3 mt-2">
                <span className="font-medium">
                  {payload.t === "deposit" ? "জমার পরিমাণ" : "প্রাপ্ত কিস্তি"}
                </span>
                <span className="font-bold text-success text-base">{formatTk(payload.a)}</span>
              </div>
              {payload.t === "deposit" && payload.ta !== undefined && (
                <Row label="মোট সঞ্চয় (এই জমা সহ)" value={formatTk(payload.ta)} bold />
              )}
              {payload.t === "installment" && (
                <>
                  {payload.pa !== undefined && <Row label="মোট পরিশোধিত" value={formatTk(payload.pa)} bold />}
                  {payload.ra !== undefined && <Row label="অবশিষ্ট বকেয়া" value={formatTk(payload.ra)} bold danger />}
                </>
              )}
              <p className="text-xs text-muted-foreground border-t pt-3 mt-2">
                এই তথ্য রিসিপ্টের QR কোড থেকে পড়া হয়েছে। মূল রিসিপ্টের সাথে মিলিয়ে দেখুন।
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, danger }: { label: string; value: string; bold?: boolean; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}:</span>
      <span className={`${bold ? "font-semibold" : "font-medium"} ${danger ? "text-destructive" : ""} text-right`}>{value}</span>
    </div>
  );
}
