import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import {
  useSamiti, toBn, formatTk, memberTotalDeposit, loanPaid, loanTotalDue,
  type Member, type Loan, type Deposit,
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
import { Users, PiggyBank, HandCoins, LayoutDashboard, Trash2, Plus, CheckCircle2, Pencil, Settings as SettingsIcon, Wallet, Download, Upload, AlertTriangle, TrendingUp, TrendingDown, Menu, Printer, FileText, Receipt, Search, Eye, Share, ImageDown } from "lucide-react";
import { toast, Toaster } from "sonner";
import { AuthGate, SignOutButton, CloudStatusBadge } from "@/components/AuthGate";

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
      {() => <SamitiApp />}
    </AuthGate>
  );
}



const today = () => new Date().toISOString().slice(0, 10);
const enMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (s: string) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  const dd = String(d).padStart(2, "0");
  return `${dd} ${enMonths[+m - 1] || m} ${y}`;
};
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

const navItems = [
  { value: "dashboard", label: "ড্যাশবোর্ড", icon: LayoutDashboard },
  { value: "members", label: "সদস্য", icon: Users },
  { value: "savings", label: "সঞ্চয়/চাদা", icon: PiggyBank },
  { value: "loans", label: "ঋণ", icon: HandCoins },
  { value: "installments", label: "কিস্তি আদায়", icon: Receipt },
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
        <div className="p-3 border-t space-y-2">
          <div className="flex items-center justify-center"><CloudStatusBadge /></div>
          <SignOutButton />
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
          <div className="flex items-center gap-2">
            <CloudStatusBadge />
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen((o) => !o)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>

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
          {tab === "installments" && <InstallmentsTab />}
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
        <StatCard label="মোট সঞ্চয়/চাদা" value={formatTk(totals.totalDeposit)} accent="bg-success" />
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
  const { data, addMember, addMembers, updateMember, deleteMember } = useSamiti();
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
  const [editMember, setEditMember] = useState<Member | null>(null);

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle>সদস্য তালিকা</CardTitle>
          <CardDescription>মোট {toBn(data.members.length)} জন সদস্য</CardDescription>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
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

function EditMemberForm({ member, onSave, onCancel }: { member: Member; onSave: (u: Partial<Omit<Member, "id">>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    serial: String(member.serial || ""),
    name: member.name,
    fatherName: member.fatherName,
    motherName: member.motherName,
    phone: member.phone,
    birthDate: member.birthDate,
    nid: member.nid,
    address: member.address,
    photo: member.photo,
    nominee: { ...member.nominee },
    joinDate: member.joinDate,
  });

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
    onSave({ ...form, serial: serialNum });
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

type SamitiInfo = { samitiName: string; samitiLogo?: string; samitiAddress?: string; establishedDate?: string };

function buildMemberCardHtml(member: Member, samiti: SamitiInfo) {
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
    ? `<img src="${member.photo}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #ddd;" crossorigin="anonymous" />`
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

  const inner = `
    <div style="max-width:640px;margin:auto;">
      ${headerHtml}
      <div style="border:2px solid #333;padding:20px;border-radius:8px;">
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
    </div>`;
  return inner;
}

function printMemberCard(member: Member, samiti: SamitiInfo) {
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

async function renderMemberCardCanvas(member: Member, samiti: SamitiInfo): Promise<HTMLCanvasElement> {
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

async function exportMemberCardJpeg(member: Member, samiti: SamitiInfo) {
  const canvas = await renderMemberCardCanvas(member, samiti);
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/jpeg", 0.95);
  a.download = `member-${member.serial || ""}-${member.name}.jpg`;
  a.click();
}

async function exportMemberCardPdf(member: Member, samiti: SamitiInfo) {
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


// ===== Savings =====
function SavingsTab() {
  const { data, addDeposit, addDeposits, updateDeposit, deleteDeposit } = useSamiti();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ memberId: "", amount: "", date: today(), note: "" });
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ memberId: "", amount: "", date: today(), note: "" });

  const submit = () => {
    if (!form.memberId) { toast.error("সদস্য নির্বাচন করুন"); return; }
    const amt = Number(form.amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    addDeposit({ memberId: form.memberId, amount: amt, date: form.date, note: form.note });
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
    if (!q) return [...data.deposits].sort((a, b) => b.date.localeCompare(a.date));
    return [...data.deposits].sort((a, b) => b.date.localeCompare(a.date)).filter((d) => {
      const m = data.members.find((x) => x.id === d.memberId);
      const text = `${m?.serial || ""} ${m?.name || ""} ${d.note || ""} ${d.date}`.toLowerCase();
      return text.includes(q);
    });
  }, [data.deposits, data.members, search]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle>সঞ্চয়/চাদা / জমা</CardTitle>
          <CardDescription>মোট {toBn(data.deposits.length)}টি লেনদেন</CardDescription>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
                  <Select value={form.memberId} onValueChange={(v) => setForm({ ...form, memberId: v })}>
                    <SelectTrigger><SelectValue placeholder="সদস্য নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>{data.members.map((m) => <SelectItem key={m.id} value={m.id}>{toBn(m.serial || 0)}. {m.name}</SelectItem>)}</SelectContent>
                  </Select>
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
                  <Select value={editForm.memberId} onValueChange={(v) => setEditForm({ ...editForm, memberId: v })}>
                    <SelectTrigger><SelectValue placeholder="সদস্য নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>{data.members.map((m) => <SelectItem key={m.id} value={m.id}>{toBn(m.serial || 0)}. {m.name}</SelectItem>)}</SelectContent>
                  </Select>
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
          <Table>
            <TableHeader>
              <TableRow>
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
        )}
      </CardContent>
    </Card>
  );
}

// ===== Loans =====
function LoansTab() {
  const { data, addLoan, updateLoan, addPayment, closeLoan, deleteLoan } = useSamiti();
  const [open, setOpen] = useState(false);
  const [payFor, setPayFor] = useState<Loan | null>(null);
  const [editFor, setEditFor] = useState<Loan | null>(null);
  const [detailFor, setDetailFor] = useState<Loan | null>(null);
  const [editForm, setEditForm] = useState({ memberId: "", amount: "", interestRate: "", durationMonths: "", date: "" });
  const [form, setForm] = useState({ memberId: "", amount: "", interestRate: String(data.settings.defaultInterestRate), durationMonths: String(data.settings.defaultDurationMonths), date: today(), memberGuarantorId: "", familyGuarantorName: "", familyGuarantorRelation: "", familyGuarantorCustomRelation: "", familyGuarantorPhone: "" });
  const [payForm, setPayForm] = useState({ amount: "", date: today(), note: "" });
  const [receipt, setReceipt] = useState<null | { loan: Loan; memberName: string; amount: number; date: string; paidAfter: number; remainingAfter: number; receiptNo: string; note?: string; logo?: string; loanNo?: number }>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (!form.interestRate.trim() || isNaN(rate) || rate <= 0) nextErrors.interestRate = "সঠিক সুদের হার দিন";
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
      amount: amt,
      date: payForm.date,
      paidAfter,
      remainingAfter,
      receiptNo: `R-${Date.now().toString().slice(-6)}`,
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
                  <Label>সুদের হার (%) *</Label>
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

      </CardHeader>
      <CardContent>
        {data.loans.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">কোনও ঋণ নেই।</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              <strong>গণনা পদ্ধতি:</strong> মাসিক কিস্তি = (মূল + সুদ) ÷ মেয়াদ (মাস)। সুদ = মূল × সুদের হার × মেয়াদ ÷ (১০০ × ১২)। ১ম কিস্তির তারিখ = ঋণ প্রদানের তারিখ থেকে ১ মাস পর। ঋণ শেষ = ঋণ প্রদানের তারিখ + মেয়াদ (মাস)।
            </p>
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ঋণ নং</TableHead>
                <TableHead>সদস্য</TableHead><TableHead>তারিখ</TableHead>
                <TableHead className="text-right">মূল</TableHead><TableHead className="text-right">মোট প্রদেয়</TableHead>
                <TableHead className="text-right">মাসিক কিস্তি</TableHead>
                <TableHead className="text-right">১ম কিস্তির তারিখ</TableHead>
                <TableHead className="text-right">ঋণ শেষ</TableHead>
                <TableHead className="text-right">পরিশোধ</TableHead><TableHead className="text-right">বকেয়া</TableHead>
                <TableHead>অবস্থা</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.loans.map((l, idx) => {
                const m = data.members.find((x) => x.id === l.memberId);
                const due = loanTotalDue(l);
                const paid = loanPaid(data.payments, l.id);
                const remaining = Math.max(0, due - paid);
                const inst = monthlyInstallment(l.amount, l.interestRate, l.durationMonths);
                const firstPay = addMonths(l.date, 1);
                const endDate = addMonths(l.date, l.durationMonths);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{toBn(idx + 1)}</TableCell>
                    <TableCell className="font-medium">{m?.name ?? "—"}</TableCell>
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
              <div className="mt-6 flex justify-between text-xs text-muted-foreground">
                <div>—————————<br />গ্রহীতা</div>
                <div className="text-right">—————————<br />কোষাধ্যক্ষ</div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setReceipt(null)}>বন্ধ</Button>
            <Button variant="secondary" onClick={async () => {
              if (!receipt) return;
              try {
                toast.loading("ছবি তৈরি হচ্ছে...", { id: "rjpg" });
                const canvas = await renderReceiptCanvas(receipt, data.samitiName || "সমিতি");
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
              const text = `কিস্তি রিসিপ্ট\nসমিতি: ${data.samitiName || "সমিতি"}\nরিসিপ্ট নং: ${receipt.receiptNo}\nতারিখ: ${fmtDate(receipt.date)}\nসদস্য: ${receipt.memberName}\nপ্রাপ্ত কিস্তি: ${formatTk(receipt.amount)}\nমোট পরিশোধিত: ${formatTk(receipt.paidAfter)}\nঅবশিষ্ট বকেয়া: ${formatTk(receipt.remainingAfter)}`;
              try {
                toast.loading("শেয়ার প্রস্তুত হচ্ছে...", { id: "rshare" });
                const canvas = await renderReceiptCanvas(receipt, data.samitiName || "সমিতি");
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
            <Button onClick={() => {
              if (!receipt) return;
              const html = buildReceiptHtml(receipt, data.samitiName || "সমিতি");
              const w = window.open("", "_blank", "width=600,height=750");
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
              <div><Label>সুদের হার (%)</Label><Input type="number" value={editForm.interestRate} onChange={(e) => setEditForm({ ...editForm, interestRate: e.target.value })} /></div>
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
            const m = data.members.find((x) => x.id === detailFor.memberId);
            const gm = data.members.find((x) => x.id === detailFor.memberGuarantorId);
            const due = loanTotalDue(detailFor);
            const pays = data.payments.filter((p) => p.loanId === detailFor.id);
            const paid = pays.reduce((s, p) => s + p.amount, 0);
            const idx = data.loans.findIndex((x) => x.id === detailFor.id);
            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">ঋণ নং:</span> {toBn(idx + 1)}</div>
                  <div><span className="text-muted-foreground">তারিখ:</span> {fmtDate(detailFor.date)}</div>
                  <div><span className="text-muted-foreground">সদস্য:</span> {m?.name ?? "—"}</div>
                  <div><span className="text-muted-foreground">মোবাইল:</span> {m?.phone ?? "—"}</div>
                  <div><span className="text-muted-foreground">মূল:</span> {formatTk(detailFor.amount)}</div>
                  <div><span className="text-muted-foreground">সুদের হার:</span> {toBn(detailFor.interestRate)}%</div>
                  <div><span className="text-muted-foreground">মেয়াদ:</span> {toBn(detailFor.durationMonths)} মাস</div>
                  <div><span className="text-muted-foreground">মাসিক কিস্তি:</span> {formatTk(monthlyInstallment(detailFor.amount, detailFor.interestRate, detailFor.durationMonths))}</div>
                  <div><span className="text-muted-foreground">১ম কিস্তির তারিখ:</span> {fmtDate(addMonths(detailFor.date, 1))}</div>
                  <div><span className="text-muted-foreground">ঋণ শেষ:</span> {fmtDate(addMonths(detailFor.date, detailFor.durationMonths))}</div>
                  <div><span className="text-muted-foreground">মোট প্রদেয়:</span> {formatTk(due)}</div>
                  <div><span className="text-success">পরিশোধ:</span> {formatTk(paid)}</div>
                  <div><span className="text-destructive">বকেয়া:</span> {formatTk(Math.max(0, due - paid))}</div>
                  <div><span className="text-muted-foreground">অবস্থা:</span> {detailFor.status === "active" ? "চলমান" : "পরিশোধিত"}</div>
                </div>
                <div className="border-t pt-2">
                  <div className="font-medium mb-1">জামিনদার</div>
                  <div>সদস্য জামিনদার: {gm?.name ?? "—"}</div>
                  {detailFor.familyGuarantor && (
                    <div>পারিবারিক: {detailFor.familyGuarantor.name} ({detailFor.familyGuarantor.relation}) — {detailFor.familyGuarantor.phone}</div>
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
              </div>
            );
          })()}
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
      if (filterMember === "all") return true;
      const loan = data.loans.find((l) => l.id === p.loanId);
      return loan?.memberId === filterMember;
    });

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
            <Select value={filterMember} onValueChange={setFilterMember}>
              <SelectTrigger className="w-44"><SelectValue placeholder="সদস্য ফিল্টার" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সকল সদস্য</SelectItem>
                {data.members.map((m) => <SelectItem key={m.id} value={m.id}>{toBn(m.serial)} — {m.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{fmtDate(p.date)}</TableCell>
                      <TableCell className="font-medium">{loan ? toBn(loanIdx) : "—"}</TableCell>
                      <TableCell className="font-medium">{m?.name ?? "—"}</TableCell>
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
    </div>
  );
}

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
  const { data, updateSamitiInfo, updateSettings, resetAll, importData } = useSamiti();
  const [name, setName] = useState(data.samitiName);
  const [address, setAddress] = useState(data.samitiAddress || "");
  const [estDate, setEstDate] = useState(data.establishedDate || "");
  const [logo, setLogo] = useState(data.samitiLogo || "");
  const [rate, setRate] = useState(String(data.settings.defaultInterestRate));
  const [dur, setDur] = useState(String(data.settings.defaultDurationMonths));
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
      samitiLogo: logo,
    });
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
      csv = "তারিখ,সদস্য,মূল,সুদ%,মেয়াদ,পরিশোধ,বকেয়া,অবস্থা\n";
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
    <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">
      <tr><td style="padding:6px 10px;border:1px solid #ccc;background:#f5f5f5;">মোট সঞ্চয়/চাদা</td><td style="padding:6px 10px;border:1px solid #ccc;text-align:right;">${formatTk(totals.totalDeposit)}</td>
          <td style="padding:6px 10px;border:1px solid #ccc;background:#f5f5f5;">ঋণ প্রদান</td><td style="padding:6px 10px;border:1px solid #ccc;text-align:right;">${formatTk(totals.totalLoanGiven)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ccc;background:#f5f5f5;">ঋণ আদায়</td><td style="padding:6px 10px;border:1px solid #ccc;text-align:right;">${formatTk(totals.totalRepaid)}</td>
          <td style="padding:6px 10px;border:1px solid #ccc;background:#f5f5f5;">বকেয়া ঋণ</td><td style="padding:6px 10px;border:1px solid #ccc;text-align:right;">${formatTk(totals.outstanding)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ccc;background:#f5f5f5;">আয়</td><td style="padding:6px 10px;border:1px solid #ccc;text-align:right;">${formatTk(totals.totalIncome)}</td>
          <td style="padding:6px 10px;border:1px solid #ccc;background:#f5f5f5;">ব্যয়</td><td style="padding:6px 10px;border:1px solid #ccc;text-align:right;">${formatTk(totals.totalExpense)}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ccc;background:#f5f5f5;font-weight:bold;">হাতে নগদ</td><td colspan="3" style="padding:6px 10px;border:1px solid #ccc;text-align:right;font-weight:bold;">${formatTk(totals.cashInHand)}</td></tr>
    </table>`;

  const th = (cols: string[]) => `<tr>${cols.map((c) => `<th style="padding:6px 8px;border:1px solid #999;background:#eee;text-align:left;">${c}</th>`).join("")}</tr>`;
  const td = (cells: (string | number)[], aligns: string[] = []) =>
    `<tr>${cells.map((c, i) => `<td style="padding:6px 8px;border:1px solid #ccc;text-align:${aligns[i] || "left"};">${c}</td>`).join("")}</tr>`;

  let body = "";
  if (reportType === "summary") {
    body += summaryHtml;
    body += `<h3>সদস্যভিত্তিক সারসংক্ষেপ</h3>`;
    body += `<table style="width:100%;border-collapse:collapse;font-size:12px;">${th(["সি.নং", "নাম", "মোবাইল", "সঞ্চয়/চাদা", "ঋণ", "বকেয়া"])}${memberWise.map((r: any) => td([toBn(r.member.serial || 0), r.member.name, r.member.phone ? toBn(r.member.phone) : "—", formatTk(r.deposit), formatTk(r.loanAmt), formatTk(r.due)], ["left", "left", "left", "right", "right", "right"])).join("")}</table>`;
  } else if (reportType === "members") {
    body += `<table style="width:100%;border-collapse:collapse;font-size:12px;">${th(["সি.নং", "নাম", "মোবাইল", "সঞ্চয়/চাদা", "ঋণ", "বকেয়া"])}${memberWise.map((r: any) => td([toBn(r.member.serial || 0), r.member.name, r.member.phone ? toBn(r.member.phone) : "—", formatTk(r.deposit), formatTk(r.loanAmt), formatTk(r.due)], ["left", "left", "left", "right", "right", "right"])).join("")}</table>`;
  } else if (reportType === "savings") {
    body += `<p><b>মোট:</b> ${formatTk(totals.totalDeposit)}</p>`;
    body += `<table style="width:100%;border-collapse:collapse;font-size:12px;">${th(["তারিখ", "সদস্য", "মন্তব্য", "পরিমাণ"])}${[...filtered.deposits].sort((a: any, b: any) => b.date.localeCompare(a.date)).map((d: any) => { const m = members.find((x) => x.id === d.memberId); return td([fmtDate(d.date), m?.name || "—", d.note || "—", formatTk(d.amount)], ["left", "left", "left", "right"]); }).join("")}</table>`;
  } else if (reportType === "loans") {
    body += `<p><b>মোট প্রদান:</b> ${formatTk(totals.totalLoanGiven)} | <b>আদায়:</b> ${formatTk(totals.totalRepaid)}</p>`;
    body += `<table style="width:100%;border-collapse:collapse;font-size:12px;">${th(["তারিখ", "সদস্য", "মূল", "মোট প্রদেয়", "পরিশোধ", "বকেয়া", "অবস্থা"])}${filtered.loans.map((l: any) => { const m = members.find((x) => x.id === l.memberId); const due = loanTotalDue(l); const realPaid = (filtered.payments.filter((pp: any) => pp.loanId === l.id).reduce((a: number, pp: any) => a + pp.amount, 0)); return td([fmtDate(l.date), m?.name || "—", formatTk(l.amount), formatTk(due), formatTk(realPaid), formatTk(Math.max(0, due - realPaid)), l.status === "active" ? "চলমান" : "পরিশোধিত"], ["left", "left", "right", "right", "right", "right", "left"]); }).join("")}</table>`;
  } else if (reportType === "cashbook") {
    body += `<p><b>আয়:</b> ${formatTk(totals.totalIncome)} | <b>ব্যয়:</b> ${formatTk(totals.totalExpense)} | <b>নীট:</b> ${formatTk(totals.totalIncome - totals.totalExpense)}</p>`;
    body += `<table style="width:100%;border-collapse:collapse;font-size:12px;">${th(["তারিখ", "ধরন", "খাত", "মন্তব্য", "পরিমাণ"])}${[...filtered.transactions].sort((a: any, b: any) => b.date.localeCompare(a.date)).map((t: any) => td([fmtDate(t.date), t.type === "income" ? "আয়" : "ব্যয়", t.category, t.note || "—", formatTk(t.amount)], ["left", "left", "left", "left", "right"])).join("")}</table>`;
  } else if (reportType === "member-savings" && memberSavingsPivot) {
    const headerCells = ["সি.নং", "সদস্য", ...memberSavingsPivot.labels, "মোট"];
    const bodyRows = memberSavingsPivot.rows.map((r: any) =>
      td(
        [toBn(r.member.serial || 0), r.member.name, ...memberSavingsPivot.periods.map((pp: string) => (r.cells[pp] ? formatTk(r.cells[pp]) : "—")), formatTk(r.total)],
        ["left", "left", ...memberSavingsPivot.periods.map(() => "right"), "right"]
      )
    ).join("");
    const totalsRow = `<tr><td colspan="2" style="padding:6px 8px;border:1px solid #999;background:#eee;text-align:right;font-weight:bold;">মোট</td>${memberSavingsPivot.periods.map((pp: string) => `<td style="padding:6px 8px;border:1px solid #999;background:#eee;text-align:right;font-weight:bold;">${formatTk(memberSavingsPivot.colTotals[pp] || 0)}</td>`).join("")}<td style="padding:6px 8px;border:1px solid #999;background:#eee;text-align:right;font-weight:bold;">${formatTk(memberSavingsPivot.grand)}</td></tr>`;
    body += `<p><b>সর্বমোট:</b> ${formatTk(memberSavingsPivot.grand)}</p>`;
    body += `<table style="width:100%;border-collapse:collapse;font-size:12px;">${th(headerCells)}${bodyRows}${totalsRow}</table>`;
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
      body { font-family: "Segoe UI", "Noto Sans Bengali", sans-serif; margin: 0; padding: 24px; color: #111; background:#fff; }
      h3 { margin: 16px 0 6px; font-size: 14px; }
      @media print { body { padding: 0; } .no-print { display: none; } }
    </style></head>
    <body>
      <div class="no-print" style="margin-bottom:12px;"><button onclick="window.print()" style="padding:8px 16px;font-size:14px;cursor:pointer;">প্রিন্ট করুন</button></div>
      ${inner}
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
  .r{width:520px;border:1px solid #ddd;border-radius:8px;padding:20px;background:#fff;}
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
  @media print{body{padding:0;} .no-print{display:none;}}
`;

function buildReceiptHtml(r: { loan: Loan; memberName: string; amount: number; date: string; paidAfter: number; remainingAfter: number; receiptNo: string; note?: string; logo?: string; loanNo?: number }, samitiName: string) {
  return `<div class="r" id="r">
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
    <div class="sign"><div>—————————<br/>গ্রহীতা</div><div style="text-align:right">—————————<br/>কোষাধ্যক্ষ</div></div>
  </div>`;
}

async function renderReceiptCanvas(r: { loan: Loan; memberName: string; amount: number; date: string; paidAfter: number; remainingAfter: number; receiptNo: string; note?: string; logo?: string }, samitiName: string): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:600px;height:10px;border:0;";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${receiptCss}</style></head><body>${buildReceiptHtml(r, samitiName)}</body></html>`);
    doc.close();
    await new Promise((res) => setTimeout(res, 60));
    const target = doc.getElementById("r")!;
    const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: 600, windowHeight: target.scrollHeight + 40 });
    return canvas;
  } finally {
    document.body.removeChild(iframe);
  }
}
