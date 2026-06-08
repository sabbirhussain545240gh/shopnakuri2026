import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useSamiti, toBn, formatTk, memberTotalDeposit, loanPaid, loanTotalDue,
  type Member, type Loan,
} from "@/lib/samiti-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Users, PiggyBank, HandCoins, LayoutDashboard, Trash2, Plus, CheckCircle2, Pencil, Settings as SettingsIcon, Wallet, Download, Upload, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
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

function SamitiApp() {
  const s = useSamiti();
  const { data } = s;

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
    <div className="min-h-screen">
      <Toaster position="top-center" richColors />
      <header className="border-b bg-card/70 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-xl shadow-sm">স</div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight">{data.samitiName}</h1>
              <p className="text-xs text-muted-foreground">সমিতি ম্যানেজমেন্ট সিস্টেম</p>
            </div>
          </div>
          <EditSamitiName name={data.samitiName} onSave={s.setSamitiName} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full mb-6 h-auto">
            <TabsTrigger value="dashboard" className="py-2.5"><LayoutDashboard className="h-4 w-4 mr-1.5" />ড্যাশবোর্ড</TabsTrigger>
            <TabsTrigger value="members" className="py-2.5"><Users className="h-4 w-4 mr-1.5" />সদস্য</TabsTrigger>
            <TabsTrigger value="savings" className="py-2.5"><PiggyBank className="h-4 w-4 mr-1.5" />সঞ্চয়</TabsTrigger>
            <TabsTrigger value="loans" className="py-2.5"><HandCoins className="h-4 w-4 mr-1.5" />ঋণ</TabsTrigger>
            <TabsTrigger value="cashbook" className="py-2.5"><Wallet className="h-4 w-4 mr-1.5" />আয়-ব্যয়</TabsTrigger>
            <TabsTrigger value="settings" className="py-2.5"><SettingsIcon className="h-4 w-4 mr-1.5" />সেটিংস</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard"><Dashboard totals={totals} memberCount={data.members.length} data={data} /></TabsContent>
          <TabsContent value="members"><MembersTab /></TabsContent>
          <TabsContent value="savings"><SavingsTab /></TabsContent>
          <TabsContent value="loans"><LoansTab /></TabsContent>
          <TabsContent value="cashbook"><CashbookTab /></TabsContent>
          <TabsContent value="settings"><SettingsTab /></TabsContent>
        </Tabs>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center text-xs text-muted-foreground">
        তথ্য আপনার ব্রাউজারে সুরক্ষিতভাবে সংরক্ষিত থাকে।
      </footer>
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
  const [form, setForm] = useState({ name: "", phone: "", address: "", joinDate: today() });

  const submit = () => {
    if (!form.name.trim()) { toast.error("নাম দিন"); return; }
    addMember(form);
    setForm({ name: "", phone: "", address: "", joinDate: today() });
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />নতুন সদস্য</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>নতুন সদস্য যোগ করুন</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>নাম *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>মোবাইল</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>ঠিকানা</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>যোগদানের তারিখ</Label><Input type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} /></div>
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
                <TableHead>নাম</TableHead><TableHead>মোবাইল</TableHead>
                <TableHead>ঠিকানা</TableHead><TableHead>যোগদান</TableHead>
                <TableHead className="text-right">মোট সঞ্চয়</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.phone ? toBn(m.phone) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.address || "—"}</TableCell>
                  <TableCell>{fmtDate(m.joinDate)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatTk(memberTotalDeposit(data.deposits, m.id))}</TableCell>
                  <TableCell>
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
    </Card>
  );
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
