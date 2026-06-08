import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  useSamiti, toBn, formatTk, memberTotalDeposit, loanPaid, loanTotalDue,
  type Member, type Loan,
} from "@/lib/samiti-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Users, PiggyBank, HandCoins, LayoutDashboard, Trash2, Plus, CheckCircle2, Pencil, Settings as SettingsIcon, Wallet, Download, Upload, AlertTriangle, TrendingUp, TrendingDown, Menu, Printer, FileText } from "lucide-react";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "সমিতি ম্যানেজমেন্ট সিস্টেম" },
      { name: "description", content: "সদস্য, সঞ্চয় ও ঋণ ব্যবস্থাপনার জন্য সম্পূর্ণ বাংলা সফটওয়্যার।" },
      { property: "og:title", content: "সমিতি ম্যানেজমেন্ট সিস্টেম" },
      { property: "og:description", content: "সদস্য, সঞ্চয় ও ঋণ ব্যবস্থাপনার জন্য সম্পূর্ণ বাংলা সফটওয়্যার।" },
    ],
  }),
  component: SamitiApp,
});

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s: string) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${toBn(d)}/${toBn(m)}/${toBn(y)}`;
};

const navItems = [
  { value: "dashboard", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
  { value: "members", label: "সদস্য", icon: Users },
  { value: "savings", label: "সঞ্চয়", icon: PiggyBank },
  { value: "loans", label: "ঋণ", icon: HandCoins },
  { value: "cashbook", label: "আয়-ব্যয়", icon: Wallet },
  { value: "reports", label: "রিপোর্ট", icon: FileText },
  { value: "settings", label: "সেটিংস", icon: SettingsIcon },
];

function SamitiApp() {
  const s = useSamiti();
  const { data } = s;
  const [tab, setTab] = useState("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

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
    return { totalDeposit, totalLoanGiven, totalRepaid, activeLoans, outstanding, totalIncome, totalExpense, cashInHand };
  }, [data]);

  return (
    <div className="min-h-screen flex">
      <Toaster position="top-center" richColors />

      {/* Desktop Sidebar */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col sticky top-0 h-screen">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-xl shadow-sm shrink-0">স</div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-foreground leading-tight truncate">{data.samitiName}</h1>
            <p className="text-xs text-muted-foreground">সমিতি ম্যানেজমেন্ট</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
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
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t text-xs text-muted-foreground text-center">
          তথ্য আপনার ব্রাউজারে সংরক্ষিত
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden border-b bg-card/70 backdrop-blur sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-lg shrink-0">স</div>
            <h1 className="font-bold text-foreground truncate">{data.samitiName}</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen((o) => !o)}>
            <Menu className="h-5 w-5" />
          </Button>
        </header>
        {mobileOpen && (
          <div className="md:hidden border-b bg-card p-3 space-y-1">
            {navItems.map((item) => {
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
                  {item.label}
                </button>
              );
            })}
          </div>
        )}

        <main className="flex-1 container mx-auto px-4 py-6">
          {tab === "dashboard" && <Dashboard totals={totals} memberCount={data.members.length} data={data} />}
          {tab === "members" && <MembersTab />}
          {tab === "savings" && <SavingsTab />}
          {tab === "loans" && <LoansTab />}
          {tab === "cashbook" && <CashbookTab />}
          {tab === "reports" && <ReportsTab />}
          {tab === "settings" && <SettingsTab />}
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

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${accent ?? "bg-primary"}`} />
      <CardContent className="pt-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl md:text-3xl font-bold mt-1 text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function Dashboard({ totals, memberCount, data }: any) {
  const recent = [...data.deposits].sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 5);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="মোট সদস্য" value={toBn(memberCount)} accent="bg-chart-4" />
        <StatCard label="মোট সঞ্চয়" value={formatTk(totals.totalDeposit)} accent="bg-success" />
        <StatCard label="হাতে নগদ" value={formatTk(totals.cashInHand)} accent="bg-primary" />
        <StatCard label="বকেয়া ঋণ" value={formatTk(totals.outstanding)} accent="bg-destructive" />
        <StatCard label="মোট ঋণ প্রদান" value={formatTk(totals.totalLoanGiven)} accent="bg-warning" />
        <StatCard label="ঋণ আদায়" value={formatTk(totals.totalRepaid)} accent="bg-chart-2" />
        <StatCard label="অন্যান্য আয়" value={formatTk(totals.totalIncome)} accent="bg-success" />
        <StatCard label="অন্যান্য ব্যয়" value={formatTk(totals.totalExpense)} accent="bg-destructive" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>সাম্প্রতিক জমা</CardTitle>
          <CardDescription>সর্বশেষ ৫টি জমার তথ্য</CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">এখনও কোনও জমা যোগ করা হয়নি।</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>তারিখ</TableHead><TableHead>সদস্য</TableHead><TableHead className="text-right">পরিমাণ</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((d: any) => {
                  const m = data.members.find((x: Member) => x.id === d.memberId);
                  return (
                    <TableRow key={d.id}>
                      <TableCell>{fmtDate(d.date)}</TableCell>
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
    </div>
  );
}

// ===== Members =====
function MembersTab() {
  const { data, addMember, deleteMember } = useSamiti();
  const [open, setOpen] = useState(false);
  const emptyForm = {
    serial: "",
    name: "", fatherName: "", motherName: "", phone: "",
    birthDate: "", nid: "", address: "", photo: "",
    nominee: { name: "", relation: "", phone: "", nid: "" },
    joinDate: today(),
  };
  const [form, setForm] = useState(emptyForm);
  const [viewMember, setViewMember] = useState<Member | null>(null);

  const nextSerial = data.members.length > 0 ? Math.max(...data.members.map((m) => m.serial || 0)) + 1 : 1;
  useEffect(() => {
    if (open) setForm((f) => ({ ...f, serial: String(nextSerial) }));
  }, [open, nextSerial]);

  const onPhoto = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("ছবি ২ MB এর কম হতে হবে"); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photo: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!form.name.trim()) { toast.error("নাম দিন"); return; }
    const serialNum = form.serial ? parseInt(form.serial, 10) : 0;
    addMember({ ...form, serial: serialNum });
    setForm(emptyForm);
    setOpen(false);
    toast.success("সদস্য যোগ হয়েছে");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>সদস্য তালিকা</CardTitle>
          <CardDescription>মোট {toBn(data.members.length)} জন সদস্য</CardDescription>
        </div>
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
                  <div><Label>সম্পর্ক</Label><Input value={form.nominee.relation} onChange={(e) => setForm({ ...form, nominee: { ...form.nominee, relation: e.target.value } })} /></div>
                  <div><Label>মোবাইল</Label><Input value={form.nominee.phone} onChange={(e) => setForm({ ...form, nominee: { ...form.nominee, phone: e.target.value } })} /></div>
                  <div><Label>NID / জন্ম সনদ</Label><Input value={form.nominee.nid} onChange={(e) => setForm({ ...form, nominee: { ...form.nominee, nid: e.target.value } })} /></div>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={submit}>সংরক্ষণ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
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
                <TableHead className="text-right">মোট সঞ্চয়</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.map((m) => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => setViewMember(m)}>
                  <TableCell className="text-center font-semibold">{toBn(m.serial || 0)}</TableCell>
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
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle>সদস্যের তথ্য</DialogTitle>
            {viewMember && (
              <Button variant="outline" size="sm" onClick={() => printMemberCard(viewMember)}>
                <Printer className="h-4 w-4 mr-1" />প্রিন্ট
              </Button>
            )}
          </DialogHeader>
          {viewMember && (
            <div className="space-y-4">
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
                <Info label="সিরিয়াল নম্বর" value={toBn(viewMember.serial || 0)} />
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
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

function printMemberCard(member: Member) {
  const w = window.open("", "_blank", "width=800,height=600");
  if (!w) return;
  const photoHtml = member.photo
    ? `<img src="${member.photo}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #ddd;" />`
    : `<div style="width:120px;height:120px;border-radius:8px;border:1px solid #ddd;background:#f5f5f5;display:flex;align-items:center;justify-content:center;color:#888;font-size:12px;">ছবি নেই</div>`;
  const rows: [string, string][] = [
    ["সিরিয়াল নম্বর", toBn(member.serial || 0)],
    ["নাম", member.name],
    ["পিতার নাম", member.fatherName],
    ["মাতার নাম", member.motherName],
    ["মোবাইল নং", member.phone ? toBn(member.phone) : ""],
    ["জন্ম তারিখ", member.birthDate ? fmtDate(member.birthDate) : ""],
    ["NID / জন্ম সনদ নং", member.nid ? toBn(member.nid) : ""],
    ["ঠিকানা", member.address],
    ["যোগদানের তারিখ", fmtDate(member.joinDate)],
  ];
  const nomineeRows: [string, string][] = member.nominee
    ? [
        ["নমিনির নাম", member.nominee.name],
        ["সম্পর্ক", member.nominee.relation],
        ["মোবাইল", member.nominee.phone ? toBn(member.nominee.phone) : ""],
        ["NID / জন্ম সনদ", member.nominee.nid ? toBn(member.nominee.nid) : ""],
      ]
    : [];
  const tableRows = (items: [string, string][]) =>
    items.map(([k, v]) => `<tr><td style="padding:8px 12px;border:1px solid #ddd;background:#fafafa;font-weight:600;width:40%;">${k}</td><td style="padding:8px 12px;border:1px solid #ddd;">${v || "—"}</td></tr>`).join("");

  w.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>সদস্য কার্ড - ${member.name}</title>
      <style>
        body { font-family: "Segoe UI", "Noto Sans Bengali", sans-serif; margin: 0; padding: 24px; background: #fff; color: #111; }
        @media print { body { padding: 0; } .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:16px;">
        <button onclick="window.print()" style="padding:8px 16px;font-size:14px;cursor:pointer;">প্রিন্ট করুন</button>
      </div>
      <div style="border:2px solid #333;padding:20px;border-radius:8px;max-width:600px;margin:auto;">
        <h2 style="text-align:center;margin:0 0 16px 0;font-size:22px;border-bottom:2px solid #333;padding-bottom:8px;">সদস্য তথ্য</h2>
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
      <script>setTimeout(()=>window.print(),300)</script>
    </body>
    </html>
  `);
  w.document.close();
}

// ===== Savings =====
function SavingsTab() {
  const { data, addDeposit, deleteDeposit } = useSamiti();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ memberId: "", amount: "", date: today(), note: "" });

  const submit = () => {
    if (!form.memberId) { toast.error("সদস্য নির্বাচন করুন"); return; }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    addDeposit({ memberId: form.memberId, amount: amt, date: form.date, note: form.note });
    setForm({ memberId: "", amount: "", date: today(), note: "" });
    setOpen(false);
    toast.success("জমা যোগ হয়েছে");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>সঞ্চয় / জমা</CardTitle>
          <CardDescription>মোট {toBn(data.deposits.length)}টি লেনদেন</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={data.members.length === 0}><Plus className="h-4 w-4 mr-1" />নতুন জমা</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>নতুন জমা</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>সদস্য *</Label>
                <Select value={form.memberId} onValueChange={(v) => setForm({ ...form, memberId: v })}>
                  <SelectTrigger><SelectValue placeholder="সদস্য নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>{data.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>পরিমাণ (টাকা) *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>তারিখ</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>মন্তব্য</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>সংরক্ষণ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {data.members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">প্রথমে সদস্য যোগ করুন।</p>
        ) : data.deposits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">কোনও জমা নেই।</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>তারিখ</TableHead><TableHead>সদস্য</TableHead><TableHead>মন্তব্য</TableHead><TableHead className="text-right">পরিমাণ</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {[...data.deposits].sort((a, b) => b.date.localeCompare(a.date)).map((d) => {
                const m = data.members.find((x) => x.id === d.memberId);
                return (
                  <TableRow key={d.id}>
                    <TableCell>{fmtDate(d.date)}</TableCell>
                    <TableCell className="font-medium">{m?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{d.note || "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-success">{formatTk(d.amount)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { deleteDeposit(d.id); toast.success("মুছে ফেলা হয়েছে"); }}>
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
  );
}

// ===== Loans =====
function LoansTab() {
  const { data, addLoan, addPayment, closeLoan, deleteLoan } = useSamiti();
  const [open, setOpen] = useState(false);
  const [payFor, setPayFor] = useState<Loan | null>(null);
  const [form, setForm] = useState({ memberId: "", amount: "", interestRate: String(data.settings.defaultInterestRate), durationMonths: String(data.settings.defaultDurationMonths), date: today() });
  const [payForm, setPayForm] = useState({ amount: "", date: today() });

  const submit = () => {
    if (!form.memberId) { toast.error("সদস্য নির্বাচন করুন"); return; }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    addLoan({
      memberId: form.memberId, amount: amt,
      interestRate: Number(form.interestRate) || 0,
      durationMonths: Number(form.durationMonths) || 12,
      date: form.date,
    });
    setForm({ memberId: "", amount: "", interestRate: String(data.settings.defaultInterestRate), durationMonths: String(data.settings.defaultDurationMonths), date: today() });
    setOpen(false);
    toast.success("ঋণ প্রদান হয়েছে");
  };

  const submitPay = () => {
    const amt = Number(payForm.amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    if (!payFor) return;
    addPayment({ loanId: payFor.id, amount: amt, date: payForm.date });
    setPayForm({ amount: "", date: today() });
    setPayFor(null);
    toast.success("কিস্তি যোগ হয়েছে");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>ঋণ ব্যবস্থাপনা</CardTitle>
          <CardDescription>মোট {toBn(data.loans.length)}টি ঋণ</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={data.members.length === 0}><Plus className="h-4 w-4 mr-1" />নতুন ঋণ</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>নতুন ঋণ প্রদান</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>সদস্য *</Label>
                <Select value={form.memberId} onValueChange={(v) => setForm({ ...form, memberId: v })}>
                  <SelectTrigger><SelectValue placeholder="সদস্য নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>{data.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>পরিমাণ *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div><Label>সুদের হার (%)</Label><Input type="number" value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} /></div>
                <div><Label>মেয়াদ (মাস)</Label><Input type="number" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} /></div>
                <div><Label>তারিখ</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={submit}>ঋণ প্রদান</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {data.loans.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">কোনও ঋণ নেই।</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>সদস্য</TableHead><TableHead>তারিখ</TableHead>
                <TableHead className="text-right">মূল</TableHead><TableHead className="text-right">মোট প্রদেয়</TableHead>
                <TableHead className="text-right">পরিশোধ</TableHead><TableHead className="text-right">বকেয়া</TableHead>
                <TableHead>অবস্থা</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.loans.map((l) => {
                const m = data.members.find((x) => x.id === l.memberId);
                const due = loanTotalDue(l);
                const paid = loanPaid(data.payments, l.id);
                const remaining = Math.max(0, due - paid);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{m?.name ?? "—"}</TableCell>
                    <TableCell>{fmtDate(l.date)}</TableCell>
                    <TableCell className="text-right">{formatTk(l.amount)}</TableCell>
                    <TableCell className="text-right">{formatTk(due)}</TableCell>
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
                          <Button size="sm" variant="outline" onClick={() => { setPayFor(l); setPayForm({ amount: "", date: today() }); }}>কিস্তি</Button>
                          {remaining <= 0 && (
                            <Button size="icon" variant="ghost" onClick={() => { closeLoan(l.id); toast.success("ঋণ পরিশোধিত"); }}>
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                          )}
                        </>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("ঋণ ও কিস্তি মুছবেন?")) { deleteLoan(l.id); toast.success("মুছে ফেলা হয়েছে"); } }}>
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

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>কিস্তি গ্রহণ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>পরিমাণ *</Label><Input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
            <div><Label>তারিখ</Label><Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={submitPay}>সংরক্ষণ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ===== Cashbook (Income/Expense) =====
const INCOME_CATS = ["সদস্য ফি", "ভর্তি ফি", "অনুদান", "সুদ আয়", "অন্যান্য"];
const EXPENSE_CATS = ["স্টেশনারি", "মিটিং খরচ", "যাতায়াত", "ভাড়া", "বিল", "অন্যান্য"];

function CashbookTab() {
  const { data, addTransaction, deleteTransaction } = useSamiti();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ type: "income" | "expense"; category: string; amount: string; date: string; note: string }>({
    type: "income", category: "", amount: "", date: today(), note: "",
  });

  const submit = () => {
    if (!form.category) { toast.error("ধরন নির্বাচন করুন"); return; }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    addTransaction({ type: form.type, category: form.category, amount: amt, date: form.date, note: form.note });
    setForm({ type: "income", category: "", amount: "", date: today(), note: "" });
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
                  <Button type="button" variant={form.type === "income" ? "default" : "outline"} onClick={() => setForm({ ...form, type: "income", category: "" })}>
                    <TrendingUp className="h-4 w-4 mr-1" />আয়
                  </Button>
                  <Button type="button" variant={form.type === "expense" ? "default" : "outline"} onClick={() => setForm({ ...form, type: "expense", category: "" })}>
                    <TrendingDown className="h-4 w-4 mr-1" />ব্যয়
                  </Button>
                </div>
                <div>
                  <Label>ধরন *</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="ধরন নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
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
  const { data, setSamitiName, updateSettings, resetAll, importData } = useSamiti();
  const [name, setName] = useState(data.samitiName);
  const [rate, setRate] = useState(String(data.settings.defaultInterestRate));
  const [dur, setDur] = useState(String(data.settings.defaultDurationMonths));
  const [confirmReset, setConfirmReset] = useState(false);

  const saveGeneral = () => {
    setSamitiName(name.trim() || "আমাদের সমিতি");
    updateSettings({
      defaultInterestRate: Number(rate) || 0,
      defaultDurationMonths: Number(dur) || 12,
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
          <CardTitle>সাধারণ সেটিংস</CardTitle>
          <CardDescription>সমিতির নাম ও ঋণের ডিফল্ট মান</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>সমিতির নাম</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>ঋণের ডিফল্ট সুদের হার (% বার্ষিক)</Label><Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
          <div><Label>ঋণের ডিফল্ট মেয়াদ (মাস)</Label><Input type="number" value={dur} onChange={(e) => setDur(e.target.value)} /></div>
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
