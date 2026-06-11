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

export const setAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; status: AccountStatus }) =>
    z
      .object({
        userId: z.string().uuid(),
        status: z.enum(["pending", "active", "rejected"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch =
      data.status === "active"
        ? { status: data.status, approved_at: new Date().toISOString(), approved_by: context.userId }
        : { status: data.status, approved_at: null, approved_by: null };
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
