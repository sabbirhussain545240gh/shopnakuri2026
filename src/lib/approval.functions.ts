import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccountStatus = "pending" | "active" | "rejected";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("শুধুমাত্র সুপার এডমিন অনুমোদিত");
}

// Called by AuthGate right after sign-in to know whether to allow entry.
export const getMyAccountStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("status, identifier, created_at, approved_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      // If a user exists in auth but has no profile, create one as pending.
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const ident = u.user?.email ?? u.user?.phone ?? "";
      await supabaseAdmin.from("profiles").insert({
        user_id: context.userId,
        identifier: ident,
        status: "pending",
      });
      return { status: "pending" as AccountStatus, identifier: ident };
    }
    return { status: data.status as AccountStatus, identifier: data.identifier };
  });

export const listPendingAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, identifier, status, created_at, approved_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { profiles: data ?? [] };
  });

const ROLE_VALUES = ["admin", "treasurer", "president", "secretary", "member"] as const;
export type ApprovalRole = (typeof ROLE_VALUES)[number];

export const setAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    userId: string;
    status: AccountStatus;
    role?: ApprovalRole;
    displayName?: string;
    memberRef?: string;
  }) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["pending", "active", "rejected"]),
        role: z.enum(ROLE_VALUES).optional(),
        displayName: z.string().trim().max(120).optional(),
        memberRef: z.string().trim().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: {
      status: AccountStatus;
      approved_at: string | null;
      approved_by: string | null;
      display_name?: string | null;
      member_ref?: string | null;
    } =
      data.status === "active"
        ? { status: data.status, approved_at: new Date().toISOString(), approved_by: context.userId }
        : { status: data.status, approved_at: null, approved_by: null };
    if (data.displayName !== undefined) patch.display_name = data.displayName || null;
    if (data.memberRef !== undefined) patch.member_ref = data.memberRef || null;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);

    if (data.status === "active" && data.role) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
        throw new Error(roleErr.message);
      }
    }
    return { ok: true };
  });
