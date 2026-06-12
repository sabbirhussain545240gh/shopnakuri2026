import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SharedSamitiResponse = {
  ok: boolean;
  isAdmin: boolean;
  canWrite: boolean;
  data: any;
  ownerUserId: string | null;
  error?: string;
};

/**
 * Returns the shared (super-admin owned) samiti data so non-admin staff
 * (treasurer / president / secretary) can SEE the same data the admin sees.
 * Admins receive their own data row.
 */
export const getSharedSamitiData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SharedSamitiResponse> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: myRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (myRoles ?? []).map((r: any) => r.role as string);
    const isAdmin = roles.includes("admin");
    const canWrite = isAdmin || roles.includes("treasurer");

    if (isAdmin) {
      const { data: row } = await supabaseAdmin
        .from("samiti_cloud_data")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      return {
        ok: true,
        isAdmin: true,
        canWrite: true,
        data: (row?.data as any) ?? null,
        ownerUserId: userId,
      };
    }

    // Non-admin: load the first admin's samiti data
    const { data: adminRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: true });
    const adminIds = (adminRows ?? []).map((r: any) => r.user_id as string);
    let firstAdminId: string | null = adminIds[0] ?? null;
    for (const adminId of adminIds) {
      const { data: row } = await supabaseAdmin
        .from("samiti_cloud_data")
        .select("data")
        .eq("user_id", adminId)
        .maybeSingle();
      if (row?.data && typeof row.data === "object" && Object.keys(row.data as object).length > 0) {
        return {
          ok: true,
          isAdmin: false,
          canWrite,
          data: row.data as any,
          ownerUserId: adminId,
        };
      }
    }
    return {
      ok: !!firstAdminId,
      isAdmin: false,
      canWrite,
      data: null,
      ownerUserId: firstAdminId,
      error: firstAdminId ? undefined : "সমিতির ডেটা পাওয়া যায়নি।",
    };
  });

/**
 * Allows treasurer (or admin) to write the shared samiti data row,
 * which is owned by the super-admin's user_id.
 */
export const writeSharedSamitiData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { data: any }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: myRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (myRoles ?? []).map((r: any) => r.role as string);
    const isAdmin = roles.includes("admin");
    const isTreasurer = roles.includes("treasurer");
    if (!isAdmin && !isTreasurer) {
      throw new Error("Forbidden: শুধু এডমিন বা কোষাধ্যক্ষ পরিবর্তন করতে পারবেন।");
    }

    let ownerUserId: string = userId;
    if (!isAdmin) {
      const { data: adminRows } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, created_at")
        .eq("role", "admin")
        .order("created_at", { ascending: true })
        .limit(1);
      const firstAdmin = (adminRows ?? [])[0]?.user_id as string | undefined;
      if (!firstAdmin) throw new Error("কোন এডমিন পাওয়া যায়নি।");
      ownerUserId = firstAdmin;
    }

    const { error } = await supabaseAdmin
      .from("samiti_cloud_data")
      .upsert({ user_id: ownerUserId, data: data.data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true, ownerUserId };
  });
