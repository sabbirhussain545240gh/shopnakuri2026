import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemberViewLoan = {
  id: string;
  amount: number;
  interestRate: number;
  date: string;
  durationMonths: number;
  status: "active" | "closed";
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
export type MemberViewResponse = {
  ok: boolean;
  error?: string;
  samitiName: string;
  samitiLogo: string;
  member: { id: string; serial?: number; name: string } | null;
  loans: MemberViewLoan[];
  payments: MemberViewPayment[];
  deposits: MemberViewDeposit[];
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
      const loans = (Array.isArray(d.loans) ? d.loans : [])
        .filter((l: any) => l?.memberId === memberRef)
        .map((l: any) => ({
          id: String(l.id),
          amount: Number(l.amount) || 0,
          interestRate: Number(l.interestRate) || 0,
          date: String(l.date ?? ""),
          durationMonths: Number(l.durationMonths) || 0,
          status: l.status === "closed" ? "closed" : "active",
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
      return {
        ok: true,
        samitiName: String(d.samitiName ?? "সমিতি"),
        samitiLogo: String(d.samitiLogo ?? ""),
        member: { id: m.id, serial: typeof m.serial === "number" ? m.serial : undefined, name: String(m.name ?? "") },
        loans,
        payments,
        deposits,
      };
    }
    return { ...empty, error: "এই সদস্যের তথ্য সমিতির ডেটাবেইসে পাওয়া যায়নি।" };
  });
