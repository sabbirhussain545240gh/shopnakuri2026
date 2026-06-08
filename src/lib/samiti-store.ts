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
};

export type Transaction = {
  id: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  note?: string;
};

export type Settings = {
  defaultInterestRate: number;
  defaultDurationMonths: number;
};

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
  settings: { defaultInterestRate: 10, defaultDurationMonths: 12 },
};

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
    return parsed;
  } catch {
    return empty;
  }
}

let listeners: Array<() => void> = [];
let state: SamitiData | null = null;

function getState() {
  if (state === null) state = load();
  return state;
}

function setState(next: SamitiData) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
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
  const deleteDeposit = useCallback((id: string) => {
    setState({ ...getState(), deposits: getState().deposits.filter((x) => x.id !== id) });
  }, []);

  const addLoan = useCallback((l: Omit<Loan, "id" | "status">) => {
    setState({ ...getState(), loans: [...getState().loans, { ...l, id: crypto.randomUUID(), status: "active" }] });
  }, []);
  const addPayment = useCallback((p: Omit<LoanPayment, "id">) => {
    setState({ ...getState(), payments: [...getState().payments, { ...p, id: crypto.randomUUID() }] });
  }, []);
  const deletePayment = useCallback((id: string) => {
    setState({ ...getState(), payments: getState().payments.filter((p) => p.id !== id) });
  }, []);
  const closeLoan = useCallback((id: string) => {
    setState({
      ...getState(),
      loans: getState().loans.map((l) => (l.id === id ? { ...l, status: "closed" } : l)),
    });
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
    addMember, updateMember, deleteMember,
    addDeposit, deleteDeposit,
    addLoan, addPayment, closeLoan, deleteLoan,
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
