// ============================================================
// Studio admin — Supabase Edge Function
// 作用：管理员页面通过这里读取客户名、新增、修改、删除预约。
//       请求头 x-admin-password 必须等于 Supabase 密钥 ADMIN_PASSWORD。
//       内部使用 service role key，页面里永远不出现密码或 service role key。
// 部署时 verify_jwt = false（页面用的是 publishable key，不是登录 JWT）。
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? "";

const ALLOWED_ORIGINS = ["https://tools.yayascreativestudio.com"];
const POSTES = ["A", "B", "C", "D"];
const TYPES = ["hourly", "journee"];

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-password",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// Compare SHA-256 digests so the check takes the same time whatever the input.
async function passwordOk(given: string): Promise<boolean> {
  if (!ADMIN_PASSWORD || !given) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(ADMIN_PASSWORD)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function validDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Only the fields the admin form can set today; anything else is ignored.
function cleanFields(input: any): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  if (input.client_name !== undefined) out.client_name = String(input.client_name ?? "").slice(0, 200);
  if (input.type !== undefined) {
    if (!TYPES.includes(input.type)) return null;
    out.type = input.type;
  }
  if (input.start_hour !== undefined) {
    const h = Number(input.start_hour);
    if (!Number.isInteger(h) || h < 0 || h > 23) return null;
    out.start_hour = h;
  }
  out.status = "confirmed";
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method not allowed" });

  if (!(await passwordOk(req.headers.get("x-admin-password") ?? ""))) {
    // Slow down password guessing a little.
    await new Promise((r) => setTimeout(r, 1000));
    return json(req, 401, { error: "unauthorized" });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: "invalid json" });
  }

  try {
    switch (body?.action) {
      case "list": {
        if (!validDate(body.date)) return json(req, 400, { error: "invalid date" });
        const { data, error } = await sb.from("reservations").select("*").eq("date", body.date);
        if (error) throw error;
        return json(req, 200, { data });
      }
      case "insert": {
        const r = body.row ?? {};
        if (!validDate(r.date) || !POSTES.includes(r.poste)) return json(req, 400, { error: "invalid row" });
        const fields = cleanFields(r);
        if (!fields) return json(req, 400, { error: "invalid row" });
        const { error } = await sb.from("reservations").insert({ date: r.date, poste: r.poste, ...fields });
        if (error) throw error;
        return json(req, 200, { ok: true });
      }
      case "update": {
        const id = Number(body.id);
        const fields = cleanFields(body.fields ?? {});
        if (!Number.isInteger(id) || !fields) return json(req, 400, { error: "invalid update" });
        const { error } = await sb.from("reservations").update(fields).eq("id", id);
        if (error) throw error;
        return json(req, 200, { ok: true });
      }
      case "delete": {
        const id = Number(body.id);
        if (!Number.isInteger(id)) return json(req, 400, { error: "invalid id" });
        const { error } = await sb.from("reservations").delete().eq("id", id);
        if (error) throw error;
        return json(req, 200, { ok: true });
      }
      default:
        return json(req, 400, { error: "unknown action" });
    }
  } catch (e) {
    console.error("studio-admin error:", e);
    return json(req, 500, { error: "server error" });
  }
});
