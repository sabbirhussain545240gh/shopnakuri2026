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
    return { ok: false, isAdmin: false, canWrite, data: null, ownerUserId: null, error: "সমিতির ডেটা পাওয়া যায়নি।" };
  });
