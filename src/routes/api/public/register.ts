import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: z.string().min(6).max(72),
});

function normalize(raw: string): { email?: string; phone?: string } | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.includes("@")) return { email: v.toLowerCase() };
  let p = v.replace(/[^\d+]/g, "");
  if (!p) return null;
  if (p.startsWith("+")) p = "+" + p.slice(1).replace(/\D/g, "");
  else if (p.startsWith("00")) p = "+" + p.slice(2);
  else if (p.startsWith("880")) p = "+" + p;
  else if (p.startsWith("0")) p = "+880" + p.slice(1);
  else p = "+880" + p;
  if (!/^\+[1-9]\d{7,14}$/.test(p)) return null;
  return { phone: p };
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
        if (!creds) {
          return new Response(JSON.stringify({ error: "সঠিক ইমেইল বা মোবাইল নম্বর দিন" }), { status: 400 });
        }
        const ident = creds.email ?? creds.phone!;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
          ...(creds.email
            ? { email: creds.email, email_confirm: true }
            : { phone: creds.phone, phone_confirm: true }),
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
