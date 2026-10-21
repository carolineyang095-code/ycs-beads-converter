// ============================================================
// Carte de fidélité · 客人印章卡 — Supabase Edge Function
// 作用：客人打开私人链接（tools.yayascreativestudio.com/carte/?t=...）时，
//       页面带着 t（card_token）来这里读自己的印章卡。
// 只读；只返回这张卡需要显示的内容（名字只给名，不返回邮箱）。
// 部署时 verify_jwt = false（页面用的是 publishable key）。
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOWED_ORIGINS = ["https://tools.yayascreativestudio.com"];

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function validUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function parisToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method not allowed" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: "invalid json" });
  }
  if (!validUuid(body?.token)) {
    await new Promise((r) => setTimeout(r, 500));
    return json(req, 404, { error: "not found" });
  }

  try {
    const { data: member, error } = await sb.from("loyalty_members")
      .select("email, display_name, lang").eq("card_token", body.token).maybeSingle();
    if (error) throw error;
    if (!member) {
      await new Promise((r) => setTimeout(r, 500));
      return json(req, 404, { error: "not found" });
    }

    const [s, r] = await Promise.all([
      sb.from("loyalty_stamps").select("id, stamped_on, card_no, reason")
        .eq("email", member.email).is("revoked_at", null).order("stamped_on"),
      sb.from("loyalty_rewards").select("kind, card_no, code, issued_at, expires_at, used_at")
        .eq("email", member.email).is("revoked_at", null),
    ]);
    if (s.error) throw s.error;
    if (r.error) throw r.error;
    const stamps: any[] = s.data ?? [];
    const rewards: any[] = r.data ?? [];

    const now = new Date().toISOString();
    const d = new Date(parisToday() + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 365);
    const cutoff = d.toISOString().slice(0, 10);

    const freeDays = rewards.filter((x) => x.kind === "free_day");
    const card = freeDays.reduce((m, x) => Math.max(m, x.card_no), 0) + 1;
    const current = stamps
      .filter((x) => x.card_no === card && x.stamped_on > cutoff)
      .map((x) => ({ date: x.stamped_on, reason: x.reason }));

    // 还没用的免费日：客人看到的是「集满的那张卡 + 兑换码」
    const openFree = freeDays
      .filter((x) => !x.used_at && x.expires_at > now)
      .sort((a, b) => a.card_no - b.card_no)[0] ?? null;
    const fullCard = openFree
      ? stamps.filter((x) => x.card_no === openFree.card_no).map((x) => ({ date: x.stamped_on, reason: x.reason }))
      : null;

    // 升级券：显示最近一张（还没过期的）
    const upg = rewards
      .filter((x) => x.kind === "upgrade" && x.expires_at > now)
      .sort((a, b) => b.issued_at.localeCompare(a.issued_at))[0] ?? null;

    return json(req, 200, {
      name: String(member.display_name ?? "").trim().split(/\s+/)[0] ?? "",
      lang: member.lang,
      card_no: card,
      stamps: current,
      completed: freeDays.length,
      free_day: openFree ? { code: openFree.code, expires_at: openFree.expires_at, stamps: fullCard } : null,
      upgrade: upg ? { used: !!upg.used_at, expires_at: upg.expires_at } : null,
      history: stamps.slice(-12).reverse().map((x) => ({ date: x.stamped_on, reason: x.reason })),
    });
  } catch (e) {
    console.error("loyalty-card error:", e);
    return json(req, 500, { error: "server error" });
  }
});
