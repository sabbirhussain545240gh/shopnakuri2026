import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyRoles, type AppRole } from "@/lib/roles.functions";
import { supabase } from "@/integrations/supabase/client";

export type { AppRole };

// Tab keys (must match navItems values in src/routes/index.tsx)
export type TabKey =
  | "dashboard"
  | "members"
  | "savings"
  | "loans"
  | "installments"
  | "receipts"
  | "deposits"
  | "cashbook"
  | "reports"
  | "settings"
  | "admin";

// What each role is allowed to SEE
const TAB_PERMISSIONS: Record<AppRole, TabKey[]> = {
  admin: [
    "dashboard", "members", "savings", "loans", "installments",
    "receipts", "deposits", "cashbook", "reports", "settings", "admin",
  ],
  treasurer: [
    "dashboard", "members", "savings", "loans", "installments",
    "receipts", "deposits", "cashbook", "reports",
  ],
  president: [
    "dashboard", "members", "savings", "loans", "installments",
    "receipts", "deposits", "cashbook", "reports", "settings",
  ],
  secretary: [
    "dashboard", "members", "savings", "loans", "installments",
    "receipts", "deposits", "cashbook", "reports", "settings",
  ],
  member: ["dashboard", "reports"],
};

// Can perform write operations (add/edit/delete members, deposits, loans, payments, transactions)
const WRITE_ROLES: AppRole[] = ["admin", "treasurer"];

// Can edit settings (samiti info, intro page, notice, messages, etc.)
const SETTINGS_EDIT_ROLES: AppRole[] = ["admin"];

// Can edit notice + messages only (limited settings access)
const NOTICE_EDIT_ROLES: AppRole[] = ["admin", "president", "secretary"];

export function allowedTabs(roles: AppRole[]): TabKey[] {
  const set = new Set<TabKey>();
  for (const r of roles) for (const t of TAB_PERMISSIONS[r] ?? []) set.add(t);
  if (set.size === 0) set.add("dashboard");
  return Array.from(set);
}

export function canWrite(roles: AppRole[]): boolean {
  return roles.some((r) => WRITE_ROLES.includes(r));
}
export function canEditSettings(roles: AppRole[]): boolean {
  return roles.some((r) => SETTINGS_EDIT_ROLES.includes(r));
}
export function canEditNotice(roles: AppRole[]): boolean {
  return roles.some((r) => NOTICE_EDIT_ROLES.includes(r));
}
export function isSuperAdmin(roles: AppRole[]): boolean {
  return roles.includes("admin");
}

export function roleLabel(r: AppRole): string {
  return {
    admin: "সুপার এডমিন",
    treasurer: "কোষাধ্যক্ষ",
    president: "সভাপতি",
    secretary: "সাধারণ সম্পাদক",
    member: "সদস্য",
  }[r];
}

export function roleBadgeClass(r: AppRole): string {
  switch (r) {
    case "admin":
      return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50";
    case "treasurer":
      return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50";
    case "president":
      return "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/50";
    case "secretary":
      return "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/50";
    case "member":
      return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-950/40 dark:text-slate-300 dark:border-slate-900/50";
  }
}

export function useMyRoles() {
  const fetchRoles = useServerFn(getMyRoles);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (alive) { setRoles([]); setLoading(false); }
          return;
        }
        const r = await fetchRoles();
        if (alive) setRoles(r.roles);
      } catch {
        if (alive) setRoles([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") load();
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [fetchRoles]);

  return { roles, loading, refresh: () => setLoading(true) };
}
