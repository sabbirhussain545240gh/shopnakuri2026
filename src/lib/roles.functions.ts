import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole = "admin" | "treasurer" | "president" | "secretary" | "member";

const ROLE_VALUES: AppRole[] = ["admin", "treasurer", "president", "secretary", "member"];

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

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { roles: (data ?? []).map((r) => r.role as AppRole) };
  });

export const listAllRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Resolve emails via admin API
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const emails: Record<string, string> = {};
    for (const uid of userIds) {
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
        if (data.user?.email) emails[uid] = data.user.email;
      } catch {}
    }
    return {
      assignments: (rows ?? []).map((r) => ({
        id: r.id as string,
        userId: r.user_id as string,
        email: emails[r.user_id] ?? "",
        role: r.role as AppRole,
        createdAt: r.created_at as string,
      })),
    };
  });

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Pull all role rows
    const { data: roleRows, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("id, user_id, role, created_at");
    if (rErr) throw new Error(rErr.message);

    const byUser: Record<string, { id: string; role: AppRole; createdAt: string }[]> = {};
    for (const r of roleRows ?? []) {
      (byUser[r.user_id as string] ||= []).push({
        id: r.id as string,
        role: r.role as AppRole,
        createdAt: r.created_at as string,
      });
    }

    // Pull profile metadata for display name + member reference + status
    const { data: profRows } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, member_ref, status, identifier");
    const profByUser: Record<string, { displayName: string | null; memberRef: string | null; status: string | null }> = {};
    for (const p of profRows ?? []) {
      profByUser[(p as any).user_id as string] = {
        displayName: (p as any).display_name ?? null,
        memberRef: (p as any).member_ref ?? null,
        status: (p as any).status ?? null,
      };
    }

    // Pull all auth users (paginate up to ~2000)
    const users: { id: string; email: string; createdAt: string; lastSignInAt: string | null }[] = [];
    for (let page = 1; page <= 10; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      for (const u of list.users) {
        users.push({
          id: u.id,
          email: u.email ?? "",
          createdAt: u.created_at ?? "",
          lastSignInAt: u.last_sign_in_at ?? null,
        });
      }
      if (list.users.length < 200) break;
    }

    return {
      users: users.map((u) => ({
        ...u,
        roles: byUser[u.id] ?? [],
        displayName: profByUser[u.id]?.displayName ?? null,
        memberRef: profByUser[u.id]?.memberRef ?? null,
        status: profByUser[u.id]?.status ?? null,
      })),
    };
  });


export const assignRoleByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; role: AppRole }) =>
    z
      .object({
        email: z.string().email().max(255),
        role: z.enum(ROLE_VALUES as [AppRole, ...AppRole[]]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    // Find user by email (paginate up to 1000)
    let foundId: string | null = null;
    for (let page = 1; page <= 10 && !foundId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const hit = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
      if (hit) foundId = hit.id;
      if (list.users.length < 200) break;
    }
    if (!foundId) throw new Error("এই ইমেইলে কোনো ইউজার পাওয়া যায়নি — প্রথমে ইনভাইট পাঠান");

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: foundId, role: data.role });
    if (insErr && !insErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(insErr.message);
    }
    return { ok: true, userId: foundId };
  });

export const removeRoleAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Prevent removing your own admin role if you're the last admin
    const { data: row, error: e0 } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("id", data.id)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (row?.role === "admin") {
      const { count, error: ce } = await supabaseAdmin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if (ce) throw new Error(ce.message);
      if ((count ?? 0) <= 1) throw new Error("শেষ সুপার এডমিন সরানো যাবে না");
    }

    const { error } = await supabaseAdmin.from("user_roles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
