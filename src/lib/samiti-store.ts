import { useEffect, useState, useCallback } from "react";

export type Nominee = {
  name: string;
  relation: string;
  phone: string;
  nid: string;
};

export type Member = {
  id: string;
  serial: number;
  name: string;
  fatherName: string;
  motherName: string;
  phone: string;
  birthDate: string;
  nid: string;
  address: string;
  photo: string; // data URL
  nominee: Nominee;
  joinDate: string;
};

export type Deposit = {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  note?: string;
};

export type Loan = {
  id: string;
  memberId: string;
  amount: number;
  interestRate: number; // percent annual
  date: string;
  durationMonths: number;
  status: "active" | "closed";
  memberGuarantorId?: string;
  familyGuarantor?: { name: string; relation: string; phone: string };
};

export type LoanPayment = {
  id: string;
  loanId: string;
  amount: number;
  date: string;
  note?: string;
};

export type Transaction = {
  id: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  note?: string;
};

export type Goal = { icon: string; title: string; desc: string };
export type Quote = { bn: string; en: string };
export type Message = { role: string; name: string; photo: string; message: string };
export type CommitteeMember = { role: string; name: string; phone: string; photo: string };

export type Settings = {
  defaultInterestRate: number;
  defaultDurationMonths: number;
  notice?: string;
  goals?: Goal[];
  quotes?: Quote[];
  messages?: Message[];
  splashEnabled?: boolean;
  splashTitle?: string;
  splashSubtitle?: string;
  splashIcon?: string;
  splashImage?: string; // data URL or asset URL
  splashImageSize?: number; // pixels, height/width of circle
  splashFooter?: string;
  goalsSectionTitle?: string;
  goalsSectionSubtitle?: string;
  quotesSectionTitle?: string;
  messagesSectionTitle?: string;
  committee?: CommitteeMember[];
  committeeSectionTitle?: string;
  committeeSectionSubtitle?: string;
};


export const DEFAULT_GOALS: Goal[] = [
  { icon: "🤝", title: "পারস্পরিক সহযোগিতা", desc: "সদস্যদের মাঝে আর্থিক সহযোগিতা ও বন্ধন গড়ে তোলা।" },
  { icon: "💰", title: "সঞ্চয়ের অভ্যাস", desc: "নিয়মিত সঞ্চয়ের মাধ্যমে আর্থিক ভিত্তি মজবুত করা।" },
  { icon: "🏦", title: "সহজ ঋণ সুবিধা", desc: "প্রয়োজনের সময় সদস্যদের সহজ শর্তে ঋণ প্রদান।" },
  { icon: "📈", title: "আর্থিক উন্নয়ন", desc: "সদস্যদের ও সমাজের সার্বিক আর্থিক উন্নয়ন নিশ্চিত করা।" },
  { icon: "🎯", title: "স্বচ্ছ ব্যবস্থাপনা", desc: "প্রতিটি লেনদেনের স্বচ্ছ ও নির্ভুল হিসাব রাখা।" },
  { icon: "🌱", title: "সামাজিক কল্যাণ", desc: "সদস্যদের পরিবার ও সমাজের কল্যাণে কাজ করা।" },
];

export const DEFAULT_QUOTES: Quote[] = [
  { bn: "একতাই শক্তি, একতাই বল।", en: "Unity is strength." },
  { bn: "আজকের সঞ্চয়, আগামীর নিরাপত্তা।", en: "Today's savings, tomorrow's security." },
  { bn: "ছোট ছোট সঞ্চয় গড়ে তোলে বড় স্বপ্ন।", en: "Small savings build great dreams." },
  { bn: "সততা ও স্বচ্ছতাই আমাদের ভিত্তি।", en: "Honesty and transparency are our foundation." },
  { bn: "সকলের জন্য, সকলের পাশে।", en: "For all, with all." },
];

export const DEFAULT_MESSAGES: Message[] = [
  { role: "প্রতিষ্ঠাতা", name: "", photo: "", message: "" },
  { role: "সভাপতি", name: "", photo: "", message: "" },
  { role: "সাধারণ সম্পাদক", name: "", photo: "", message: "" },
];

export type SamitiData = {
  members: Member[];
  deposits: Deposit[];
  loans: Loan[];
  payments: LoanPayment[];
  transactions: Transaction[];
  samitiName: string;
  samitiLogo: string;
  samitiAddress: string;
  establishedDate: string;
  settings: Settings;
};

const KEY = "samiti-data-v1";

const empty: SamitiData = {
  samitiName: "আমাদের সমিতি",
  samitiLogo: "",
  samitiAddress: "",
  establishedDate: "",
  members: [],
  deposits: [],
  loans: [],
  payments: [],
  transactions: [],
  settings: { defaultInterestRate: 10, defaultDurationMonths: 12, notice: "" },
};

function loanShouldBeClosed(loan: Loan, paid: number) {
  const remaining = Math.max(0, loanTotalDue(loan) - paid);
  return Math.round(remaining) <= 0;
}

function load(): SamitiData {
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = { ...empty, ...JSON.parse(raw) } as SamitiData;
    // migrate: assign serials to legacy members
    let nextSerial = 1;
    parsed.members = parsed.members.map((m) => {
      if (typeof (m as any).serial === "number") return m;
      return { ...m, serial: nextSerial++ };
    });
    // reconcile loan statuses based on payments
    parsed.loans = parsed.loans.map((l) => {
      const paid = parsed.payments.filter((p) => p.loanId === l.id).reduce((s, p) => s + p.amount, 0);
      const shouldBeClosed = loanShouldBeClosed(l, paid);
      return { ...l, status: shouldBeClosed ? "closed" : "active" };
    });
    return parsed;
  } catch {
    return empty;
  }
}

let listeners: Array<() => void> = [];
let state: SamitiData | null = null;

// ---- Cloud sync ----
let cloudUserId: string | null = null;
let cloudOwnerId: string | null = null; // admin's user_id (where data is stored)
let cloudIsAdmin = false;
let cloudCanWrite = false;
let suppressCloudSave = false;
let readOnlyMode = false; // true for president/secretary/member viewers
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let cloudStatus: "idle" | "loading" | "saving" | "saved" | "error" = "idle";
const statusListeners: Array<() => void> = [];
let initialLoadPromise: Promise<void> | null = null;
let initialLoadResolve: (() => void) | null = null;

export function isReadOnlyMode() { return readOnlyMode; }

export function getCloudStatus() {
  return cloudStatus;
}
export function subscribeCloudStatus(fn: () => void) {
  statusListeners.push(fn);
  return () => {
    const i = statusListeners.indexOf(fn);
    if (i >= 0) statusListeners.splice(i, 1);
  };
}
function setCloudStatus(s: typeof cloudStatus) {
  cloudStatus = s;
  statusListeners.forEach((f) => f());
}

/** Resolves when the first cloud fetch after sign-in finishes (success or error). */
export function awaitInitialCloudLoad(): Promise<void> {
  return initialLoadPromise ?? Promise.resolve();
}

async function pushToCloud() {
  if (!cloudUserId || readOnlyMode || !cloudCanWrite) return;
  setCloudStatus("saving");
  try {
    if (cloudIsAdmin) {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from("samiti_cloud_data")
        .upsert({ user_id: cloudUserId, data: getState() as any, updated_at: new Date().toISOString() });
      if (error) throw error;
    } else {
      // treasurer writes to admin-owned row via server fn
      const { writeSharedSamitiData } = await import("@/lib/samiti-shared.functions");
      await writeSharedSamitiData({ data: { data: getState() } });
    }
    setCloudStatus("saved");
  } catch {
    setCloudStatus("error");
  }
}

function scheduleCloudSave() {
  if (!cloudUserId || suppressCloudSave || readOnlyMode || !cloudCanWrite) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    pushToCloud().catch(() => setCloudStatus("error"));
  }, 800);
}

export async function startCloudSync(userId: string) {
  if (cloudUserId === userId) return;
  cloudUserId = userId;
  readOnlyMode = false;
  cloudIsAdmin = false;
  cloudCanWrite = false;
  cloudOwnerId = null;
  setCloudStatus("loading");
  initialLoadPromise = new Promise<void>((resolve) => {
    initialLoadResolve = resolve;
  });
  const finishInitial = () => {
    if (initialLoadResolve) {
      initialLoadResolve();
      initialLoadResolve = null;
    }
  };
  try {
    const { getSharedSamitiData } = await import("@/lib/samiti-shared.functions");
    const res = await getSharedSamitiData();
    cloudIsAdmin = res.isAdmin;
    cloudCanWrite = res.canWrite;
    cloudOwnerId = res.ownerUserId;
    // president/secretary/member = read-only; treasurer & admin can write
    readOnlyMode = !res.canWrite;
    if (res.data && typeof res.data === "object" && Object.keys(res.data as object).length > 0) {
      suppressCloudSave = true;
      const incoming = { ...empty, ...(res.data as SamitiData) };
      incoming.loans = incoming.loans.map((l) => {
        const paid = incoming.payments.filter((p) => p.loanId === l.id).reduce((s, p) => s + p.amount, 0);
        const shouldBeClosed = loanShouldBeClosed(l, paid);
        return { ...l, status: shouldBeClosed ? "closed" : "active" };
      });
      setState(incoming);
      suppressCloudSave = false;
      setCloudStatus("saved");
    } else if (cloudCanWrite) {
      // Admin/treasurer with no data yet — push current local state
      await pushToCloud();
    } else {
      setCloudStatus("idle");
    }
  } catch {
    setCloudStatus("error");
  } finally {
    finishInitial();
  }
}

export function stopCloudSync() {
  cloudUserId = null;
  cloudOwnerId = null;
  cloudIsAdmin = false;
  cloudCanWrite = false;
  readOnlyMode = false;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (initialLoadResolve) { initialLoadResolve(); initialLoadResolve = null; }
  initialLoadPromise = null;
  setCloudStatus("idle");
}

function getState() {
  if (state === null) state = load();
  return state;
}

function setState(next: SamitiData) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
  scheduleCloudSave();
}

export function useSamiti() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.push(l);
    // hydrate
    if (state === null) { state = load(); force((n) => n + 1); }
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);

  const data = getState();

  const setSamitiName = useCallback((name: string) => setState({ ...getState(), samitiName: name }), []);
  const updateSamitiInfo = useCallback((info: Partial<Pick<SamitiData, "samitiName" | "samitiLogo" | "samitiAddress" | "establishedDate">>) => {
    setState({ ...getState(), ...info });
  }, []);

  const addMember = useCallback((m: Omit<Member, "id">) => {
    const members = getState().members;
    const maxSerial = members.length > 0 ? Math.max(...members.map((x) => x.serial || 0)) : 0;
    const serial = m.serial && m.serial > 0 ? m.serial : maxSerial + 1;
    const member: Member = { ...m, id: crypto.randomUUID(), serial };
    setState({ ...getState(), members: [...members, member] });
  }, []);
  const addMembers = useCallback((list: Array<Omit<Member, "id">>) => {
    const s = getState();
    let maxSerial = s.members.length > 0 ? Math.max(...s.members.map((x) => x.serial || 0)) : 0;
    const newOnes: Member[] = list.map((m) => {
      let serial: number;
      if (m.serial && m.serial > 0) { serial = m.serial; if (serial > maxSerial) maxSerial = serial; }
      else { serial = ++maxSerial; }
      return { ...m, id: crypto.randomUUID(), serial };
    });
    setState({ ...s, members: [...s.members, ...newOnes] });
    return newOnes.length;
  }, []);
  const updateMember = useCallback((id: string, updates: Partial<Omit<Member, "id">>) => {
    setState({
      ...getState(),
      members: getState().members.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    });
  }, []);
  const deleteMember = useCallback((id: string) => {
    const s = getState();
    setState({
      ...s,
      members: s.members.filter((x) => x.id !== id),
      deposits: s.deposits.filter((d) => d.memberId !== id),
      loans: s.loans.filter((l) => l.memberId !== id),
    });
  }, []);

  const addDeposit = useCallback((d: Omit<Deposit, "id">) => {
    setState({ ...getState(), deposits: [...getState().deposits, { ...d, id: crypto.randomUUID() }] });
  }, []);
  const addDeposits = useCallback((list: Array<Omit<Deposit, "id">>) => {
    const s = getState();
    const newOnes: Deposit[] = list.map((d) => ({ ...d, id: crypto.randomUUID() }));
    setState({ ...s, deposits: [...s.deposits, ...newOnes] });
    return newOnes.length;
  }, []);
  const updateDeposit = useCallback((id: string, updates: Partial<Omit<Deposit, "id">>) => {
    setState({
      ...getState(),
      deposits: getState().deposits.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    });
  }, []);
  const deleteDeposit = useCallback((id: string) => {
    setState({ ...getState(), deposits: getState().deposits.filter((x) => x.id !== id) });
  }, []);

  const addLoan = useCallback((l: Omit<Loan, "id" | "status">) => {
    setState({ ...getState(), loans: [...getState().loans, { ...l, id: crypto.randomUUID(), status: "active" }] });
  }, []);
  const updateLoan = useCallback((id: string, updates: Partial<Omit<Loan, "id">>) => {
    const s = getState();
    const loansUpdated = s.loans.map((l) => (l.id === id ? { ...l, ...updates } : l));
    const loans = reconcileLoanStatus(id, loansUpdated, s.payments);
    setState({ ...s, loans });
  }, []);
  const reconcileLoanStatus = (loanId: string, loans: Loan[], payments: LoanPayment[]): Loan[] => {
    const loan = loans.find((l) => l.id === loanId);
    if (!loan) return loans;
    const paid = payments.filter((p) => p.loanId === loanId).reduce((s, p) => s + p.amount, 0);
    const shouldBeClosed = loanShouldBeClosed(loan, paid);
    const nextStatus: Loan["status"] = shouldBeClosed ? "closed" : "active";
    if (loan.status === nextStatus) return loans;
    return loans.map((l) => (l.id === loanId ? { ...l, status: nextStatus } : l));
  };
  const addPayment = useCallback((p: Omit<LoanPayment, "id">) => {
    const s = getState();
    const payments = [...s.payments, { ...p, id: crypto.randomUUID() }];
    const loans = reconcileLoanStatus(p.loanId, s.loans, payments);
    setState({ ...s, payments, loans });
  }, []);
  const updatePayment = useCallback((id: string, updates: Partial<Omit<LoanPayment, "id">>) => {
    const s = getState();
    const payments = s.payments.map((p) => (p.id === id ? { ...p, ...updates } : p));
    const target = payments.find((p) => p.id === id);
    const loans = target ? reconcileLoanStatus(target.loanId, s.loans, payments) : s.loans;
    setState({ ...s, payments, loans });
  }, []);
  const deletePayment = useCallback((id: string) => {
    const s = getState();
    const target = s.payments.find((p) => p.id === id);
    const payments = s.payments.filter((p) => p.id !== id);
    const loans = target ? reconcileLoanStatus(target.loanId, s.loans, payments) : s.loans;
    setState({ ...s, payments, loans });
  }, []);


  const closeLoan = useCallback((id: string) => {
    setState({
      ...getState(),
      loans: getState().loans.map((l) => (l.id === id ? { ...l, status: "closed" } : l)),
    });
  }, []);
  const refreshLoanStatus = useCallback((id: string) => {
    const s = getState();
    const loans = reconcileLoanStatus(id, s.loans, s.payments);
    setState({ ...s, loans });
    const loan = loans.find((l) => l.id === id);
    return loan?.status ?? null;
  }, []);
  const deleteLoan = useCallback((id: string) => {
    const s = getState();
    setState({
      ...s,
      loans: s.loans.filter((l) => l.id !== id),
      payments: s.payments.filter((p) => p.loanId !== id),
    });
  }, []);

  const addTransaction = useCallback((t: Omit<Transaction, "id">) => {
    setState({ ...getState(), transactions: [...getState().transactions, { ...t, id: crypto.randomUUID() }] });
  }, []);
  const deleteTransaction = useCallback((id: string) => {
    setState({ ...getState(), transactions: getState().transactions.filter((x) => x.id !== id) });
  }, []);

  const updateSettings = useCallback((s: Partial<Settings>) => {
    setState({ ...getState(), settings: { ...getState().settings, ...s } });
  }, []);

  const resetAll = useCallback(() => setState(empty), []);

  const importData = useCallback((d: SamitiData) => setState({ ...empty, ...d }), []);

  return {
    data,
    setSamitiName,
    updateSamitiInfo,
    addMember, addMembers, updateMember, deleteMember,
    addDeposit, addDeposits, updateDeposit, deleteDeposit,
    addLoan, updateLoan, addPayment, updatePayment, deletePayment, closeLoan, refreshLoanStatus, deleteLoan,
    addTransaction, deleteTransaction,
    updateSettings, resetAll, importData,
  };
}

// Helpers
export function toBn(n: number | string): string {
  const map = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
  return String(n).replace(/\d/g, (d) => map[+d]);
}

export function formatTk(n: number): string {
  return "৳ " + toBn(Math.round(n).toLocaleString("en-IN"));
}

export function memberTotalDeposit(deposits: Deposit[], memberId: string) {
  return deposits.filter((d) => d.memberId === memberId).reduce((s, d) => s + d.amount, 0);
}

export function loanPaid(payments: LoanPayment[], loanId: string) {
  return payments.filter((p) => p.loanId === loanId).reduce((s, p) => s + p.amount, 0);
}

export function loanTotalDue(loan: Loan) {
  const interest = (loan.amount * loan.interestRate * loan.durationMonths) / (100 * 12);
  return loan.amount + interest;
}
