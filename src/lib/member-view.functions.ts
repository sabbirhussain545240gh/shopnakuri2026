import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemberViewLoan = {
  id: string;
  amount: number;
  interestRate: number;
  date: string;
  durationMonths: number;
  status: "active" | "closed";
  samitiLoanNo?: number;
};

export type MemberViewPayment = {
  id: string;
  loanId: string;
  amount: number;
  date: string;
  note?: string;
};
export type MemberViewDeposit = {
  id: string;
  amount: number;
  date: string;
  note?: string;
};
export type MemberViewCommittee = { role: string; name: string; phone: string; photo?: string; signature?: string };
export type MemberViewResponse = {
  ok: boolean;
  error?: string;
  samitiName: string;
  samitiLogo: string;
  samitiAddress?: string;
  establishedDate?: string;
  cashier?: { name: string; identifier?: string; role?: string } | null;
  committee?: MemberViewCommittee[];
  member: {
    id: string;
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
    nominee?: { name: string; relation: string; phone: string; nid: string } | null;
  } | null;
  loans: MemberViewLoan[];
  payments: MemberViewPayment[];
  deposits: MemberViewDeposit[];
  summary?: {
    totalMembers: number;
    totalDeposits: number;
    totalLoans: number;
    activeLoans: number;
    closedLoans: number;
    totalLoanAmount: number;
    totalPayments: number;
    totalRemaining: number;
  };
};

export const getMyMemberView = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberViewResponse> => {
    const empty: MemberViewResponse = {
      ok: false,
      samitiName: "",
      samitiLogo: "",
      member: null,
      loans: [],
      payments: [],
      deposits: [],
    };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("member_ref")
      .eq("user_id", context.userId)
      .maybeSingle();
    const memberRef = (prof?.member_ref ?? "").trim();
    if (!memberRef) return { ...empty, error: "সদস্য তথ্য সংযুক্ত নয়। অনুগ্রহ করে এডমিনের সাথে যোগাযোগ করুন।" };

    // Find an admin user (samiti data is stored under super admin's user_id)
    const { data: adminRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true });
    const adminIds = (adminRows ?? []).map((r: any) => r.user_id as string);
    if (adminIds.length === 0) return { ...empty, error: "সমিতির ডেটা পাওয়া যায়নি।" };

    // Try each admin's data, pick the first one that contains this member
    for (const adminId of adminIds) {
      const { data: row } = await supabaseAdmin
        .from("samiti_cloud_data")
        .select("data")
        .eq("user_id", adminId)
        .maybeSingle();
      const d: any = row?.data;
      if (!d || typeof d !== "object") continue;
      const members: any[] = Array.isArray(d.members) ? d.members : [];
      const m = members.find((x) => x?.id === memberRef);
      if (!m) continue;
      const allLoansList: any[] = Array.isArray(d.loans) ? d.loans : [];
      const samitiLoanNoById = new Map<string, number>();
      allLoansList.forEach((l: any, i: number) => { if (l?.id) samitiLoanNoById.set(String(l.id), i + 1); });
      const loans = allLoansList
        .filter((l: any) => l?.memberId === memberRef)
        .map((l: any) => ({
          id: String(l.id),
          amount: Number(l.amount) || 0,
          interestRate: Number(l.interestRate) || 0,
          date: String(l.date ?? ""),
          durationMonths: Number(l.durationMonths) || 0,
          status: l.status === "closed" ? "closed" : "active",
          samitiLoanNo: samitiLoanNoById.get(String(l.id)),
        })) as MemberViewLoan[];

      const loanIds = new Set(loans.map((l) => l.id));
      const payments = (Array.isArray(d.payments) ? d.payments : [])
        .filter((p: any) => loanIds.has(p?.loanId))
        .map((p: any) => ({
          id: String(p.id),
          loanId: String(p.loanId),
          amount: Number(p.amount) || 0,
          date: String(p.date ?? ""),
          note: p.note ? String(p.note) : undefined,
        })) as MemberViewPayment[];
      const deposits = (Array.isArray(d.deposits) ? d.deposits : [])
        .filter((x: any) => x?.memberId === memberRef)
        .map((x: any) => ({
          id: String(x.id),
          amount: Number(x.amount) || 0,
          date: String(x.date ?? ""),
          note: x.note ? String(x.note) : undefined,
        })) as MemberViewDeposit[];
      const nominee = m.nominee && typeof m.nominee === "object"
        ? {
            name: String(m.nominee.name ?? ""),
            relation: String(m.nominee.relation ?? ""),
            phone: String(m.nominee.phone ?? ""),
            nid: String(m.nominee.nid ?? ""),
          }
        : null;
      const { data: adminProfile } = await supabaseAdmin
        .from("profiles")
        .select("display_name, identifier")
        .eq("user_id", adminId)
        .maybeSingle();
      const cashierName = String(
        adminProfile?.display_name || adminProfile?.identifier || d.cashierName || d.adminName || "এডমিন"
      );
      return {
        ok: true,
        samitiName: String(d.samitiName ?? "সমিতি"),
        samitiLogo: String(d.samitiLogo ?? ""),
        cashier: { name: cashierName, identifier: adminProfile?.identifier ? String(adminProfile.identifier) : undefined, role: "admin" },
        committee: (() => {
          const list = d?.settings?.committee;
          if (!Array.isArray(list)) return [];
          return list.map((c: any) => ({
            role: String(c?.role ?? ""),
            name: String(c?.name ?? ""),
            phone: String(c?.phone ?? ""),
            photo: c?.photo ? String(c.photo) : undefined,
            signature: c?.signature ? String(c.signature) : undefined,
          }));
        })(),
        member: {
          id: m.id,
          serial: typeof m.serial === "number" ? m.serial : undefined,
          name: String(m.name ?? ""),
          fatherName: m.fatherName ? String(m.fatherName) : undefined,
          motherName: m.motherName ? String(m.motherName) : undefined,
          phone: m.phone ? String(m.phone) : undefined,
          birthDate: m.birthDate ? String(m.birthDate) : undefined,
          nid: m.nid ? String(m.nid) : undefined,
          address: m.address ? String(m.address) : undefined,
          photo: m.photo ? String(m.photo) : undefined,
          joinDate: m.joinDate ? String(m.joinDate) : undefined,
          nominee,
        },
        loans,
        payments,
        deposits,
        summary: (() => {
          const allLoans: any[] = Array.isArray(d.loans) ? d.loans : [];
          const allPayments: any[] = Array.isArray(d.payments) ? d.payments : [];
          const allDeposits: any[] = Array.isArray(d.deposits) ? d.deposits : [];
          const totalLoanAmount = allLoans.reduce((s, l) => s + (Number(l.amount) || 0), 0);
          const totalPayments = allPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const totalDeposits = allDeposits.reduce((s, x) => s + (Number(x.amount) || 0), 0);
          const totalDue = allLoans.reduce((s, l) => {
            const amt = Number(l.amount) || 0; const rate = Number(l.interestRate) || 0; const mo = Number(l.durationMonths) || 0;
            return s + amt + (amt * rate * mo) / (100 * 12);
          }, 0);
          return {
            totalMembers: members.length,
            totalDeposits,
            totalLoans: allLoans.length,
            activeLoans: allLoans.filter((l) => l.status !== "closed").length,
            closedLoans: allLoans.filter((l) => l.status === "closed").length,
            totalLoanAmount,
            totalPayments,
            totalRemaining: Math.max(0, totalDue - totalPayments),
          };
        })(),
      };
    }
    return { ...empty, error: "এই সদস্যের তথ্য সমিতির ডেটাবেইসে পাওয়া যায়নি।" };
  });
