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
  | "settings";

// What each role is allowed to SEE
const TAB_PERMISSIONS: Record<AppRole, TabKey[]> = {
  admin: [
    "dashboard", "members", "savings", "loans", "installments",
    "receipts", "deposits", "cashbook", "reports", "settings",
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
