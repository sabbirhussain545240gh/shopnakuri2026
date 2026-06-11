import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: z.string().min(6).max(72),
});

function normalize(raw: string): { email?: string } | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
    return { email: v.toLowerCase() };
  }
  return null;
}


export const Route = createFileRoute("/api/public/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = Body.parse(await request.json());
        } catch {
          return new Response(JSON.stringify({ error: "অবৈধ ইনপুট" }), { status: 400 });
        }
        const creds = normalize(parsed.identifier);
        if (!creds || !creds.email) {
          return new Response(JSON.stringify({ error: "সঠিক ইমেইল ঠিকানা দিন" }), { status: 400 });
        }
        const ident = creds.email;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
          email: creds.email,
          email_confirm: true,
          password: parsed.password,
        });

        if (cErr || !created.user) {
          return new Response(JSON.stringify({ error: cErr?.message ?? "অ্যাকাউন্ট তৈরি ব্যর্থ" }), { status: 400 });
        }
        await supabaseAdmin.from("profiles").upsert({
          user_id: created.user.id,
          identifier: ident,
          status: "pending",
        });
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
