import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const INVITE_TTL_HOURS = 48;

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("শুধুমাত্র অ্যাডমিন অনুমোদিত");
}

export const getRoleInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    const { data: mine, error: e2 } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (e2) throw new Error(e2.message);
    return { isAdmin: !!mine, adminCount: count ?? 0 };
  });

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) throw new Error("একজন অ্যাডমিন ইতিমধ্যে রয়েছেন");
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; redirectTo: string }) =>
    z
      .object({
        email: z.string().email().max(255),
        redirectTo: z.string().url().max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000).toISOString();

    // Revoke any prior pending invites for this email
    await supabaseAdmin
      .from("invites")
      .update({ revoked_at: new Date().toISOString() })
      .ilike("email", email)
      .is("used_at", null)
      .is("revoked_at", null);

    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);

    const { error: insErr } = await supabaseAdmin.from("invites").insert({
      email,
      invited_by: context.userId,
      expires_at: expiresAt,
    });
    if (insErr) throw new Error(insErr.message);

    return { ok: true, userId: invited.user?.id ?? null, expiresAt };
  });

export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("invites")
      .select("id, email, expires_at, used_at, revoked_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { invites: data ?? [] };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .is("used_at", null)
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Called by the /welcome page (user is already authenticated via the invite link).
// Validates that a pending, non-expired, non-revoked invite exists for this email.
export const validateMyInvite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user, error: uerr } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (uerr) throw new Error(uerr.message);
    const email = (user.user?.email ?? "").toLowerCase();
    if (!email) throw new Error("ইমেইল পাওয়া যায়নি");

    const { data, error } = await supabaseAdmin
      .from("invites")
      .select("id, expires_at, used_at, revoked_at")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!data) return { valid: false, reason: "not_found" as const };
    if (data.revoked_at) return { valid: false, reason: "revoked" as const };
    if (data.used_at) return { valid: false, reason: "used" as const };
    if (new Date(data.expires_at).getTime() < Date.now())
      return { valid: false, reason: "expired" as const };

    return { valid: true as const, inviteId: data.id, expiresAt: data.expires_at };
  });

// Marks the invite as consumed. Call after the user successfully sets a password.
export const consumeMyInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { inviteId: string }) =>
    z.object({ inviteId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", data.inviteId)
      .is("used_at", null)
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
