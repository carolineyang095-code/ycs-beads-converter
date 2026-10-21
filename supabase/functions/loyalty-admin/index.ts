// ============================================================
// Carte de fidélité · 印章卡后台 — Supabase Edge Function
// 作用：Yaya 的后台页面（studio/cartes.html）通过这里：
//   today      看某天的预约 + 每位客人的印章情况
//   stamp      盖章（第 2 个章自动发升级券，第 4 个章自动发兑换码），并给客人发邮件
//   revoke     撤销最近一个章
//   members    客人列表（搜索 + 筛选）
//   member     单个客人的完整记录
//   use_upgrade 把升级券标记为已用
//   resend     重发印章卡链接
//   pool       还剩多少个兑换码
// 请求头 x-admin-password 必须等于 Supabase 密钥 ADMIN_PASSWORD（和 studio-admin 同一个密码）。
// 部署时 verify_jwt = false（页面用的是 publishable key，不是登录 JWT）。
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const ALLOWED_ORIGINS = ["https://tools.yayascreativestudio.com"];
const FROM_EMAIL = "reservation@yayascreativestudio.com";
const FROM_NAME = "Yaya's Creative Studio";
const CARD_URL = "https://tools.yayascreativestudio.com/carte/";
const BOOK_URL = "https://tools.yayascreativestudio.com/studio/";
const STAMP_REASONS = ["journee", "hourly_4h", "manual"];

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------- HTTP helpers ----------
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

function cleanEmail(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().slice(0, 254);
}

function validEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

function toLang(locale: unknown): "fr" | "en" | "zh" {
  const s = String(locale ?? "").toLowerCase();
  if (s.startsWith("zh")) return "zh";
  if (s.startsWith("en")) return "en";
  return "fr";
}

function parisToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

function daysAgo(n: number): string {
  const d = new Date(parisToday() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function escHtml(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

// ---------- 印章汇总（和 loyalty_add_stamp 的规则一致） ----------
type Stamp = { id: number; email: string; stamped_on: string; card_no: number; position: number; reason: string; reservation_id: number | null; revoked_at: string | null; created_at: string };
type Reward = { id: number; email: string; card_no: number; kind: string; stamp_id: number; code: string | null; issued_at: string; expires_at: string; used_at: string | null; used_note: string | null; revoked_at: string | null };

function summarize(email: string, stamps: Stamp[], rewards: Reward[]) {
  const now = new Date().toISOString();
  const cutoff = daysAgo(365);
  const mine = stamps.filter((s) => s.email === email && !s.revoked_at);
  const rw = rewards.filter((r) => r.email === email && !r.revoked_at);
  const freeDays = rw.filter((r) => r.kind === "free_day");
  const card = freeDays.reduce((m, r) => Math.max(m, r.card_no), 0) + 1;
  const active = mine
    .filter((s) => s.card_no === card && s.stamped_on > cutoff)
    .sort((a, b) => a.stamped_on.localeCompare(b.stamped_on));
  const upgrade = rw.find((r) => r.kind === "upgrade" && !r.used_at && r.expires_at > now) ?? null;
  const freeDay = freeDays.find((r) => !r.used_at && r.expires_at > now) ?? null;
  const last = mine.reduce((m, s) => (s.stamped_on > m ? s.stamped_on : m), "");
  return {
    email,
    card_no: card,
    count: active.length,
    stamps: active.map((s) => ({ id: s.id, date: s.stamped_on, reason: s.reason })),
    upgrade: upgrade ? { id: upgrade.id, expires_at: upgrade.expires_at } : null,
    free_day: freeDay ? { id: freeDay.id, code: freeDay.code, expires_at: freeDay.expires_at } : null,
    completed: freeDays.length,
    last_stamp: last || null,
  };
}

async function loadFor(emails: string[]) {
  if (emails.length === 0) return { members: [], stamps: [] as Stamp[], rewards: [] as Reward[] };
  const [m, s, r] = await Promise.all([
    sb.from("loyalty_members").select("email, display_name, lang, card_token, created_at").in("email", emails),
    sb.from("loyalty_stamps").select("*").in("email", emails),
    sb.from("loyalty_rewards").select("*").in("email", emails),
  ]);
  if (m.error) throw m.error;
  if (s.error) throw s.error;
  if (r.error) throw r.error;
  return { members: m.data ?? [], stamps: (s.data ?? []) as Stamp[], rewards: (r.data ?? []) as Reward[] };
}

// ---------- 邮件 ----------
const T = {
  fr: {
    subject: (n: number) => n >= 4 ? "Carte complète : votre journée offerte · Yaya's Creative Studio" : `Votre tampon n°${n} · Yaya's Creative Studio`,
    hello: (name: string) => name ? `Bonjour ${escHtml(name)},` : "Bonjour,",
    lines: {
      1: "Merci pour votre journée à l'atelier ! Votre premier tampon est sur votre carte de fidélité.",
      3: "Votre troisième tampon est sur votre carte. Encore une journée et la suivante vous est offerte.",
    } as Record<number, string>,
    second: "Votre deuxième tampon est sur votre carte. Petit cadeau : lors de votre prochaine journée, vous profitez de la plaque intelligente au prix de la plaque classique (35 € au lieu de 38 €). Valable un an, il suffit de le signaler à Yaya en arrivant.",
    full: "Carte complète ! Votre journée offerte vous attend, plaque intelligente comprise.",
    codeLabel: "Votre code",
    howTo: "Réservez une journée comme d'habitude, saisissez ce code au paiement : l'acompte passe à 0 €. Sur place, rien à régler.",
    valid: (d: string) => `Valable jusqu'au ${d}. Code personnel, non cessible.`,
    button: "Voir ma carte",
    book: "Réserver une journée",
    resend: "Voici le lien vers votre carte de fidélité. Gardez-le pour suivre vos tampons.",
    resendSubject: "Votre carte de fidélité · Yaya's Creative Studio",
    rules: "Un tampon par journée perles à repasser (journée complète ou 4 h et plus). Au 2e : plaque intelligente au prix de la plaque classique. Au 4e : une journée offerte.",
  },
  en: {
    subject: (n: number) => n >= 4 ? "Card complete: your free day · Yaya's Creative Studio" : `Your stamp no. ${n} · Yaya's Creative Studio`,
    hello: (name: string) => name ? `Hello ${escHtml(name)},` : "Hello,",
    lines: {
      1: "Thank you for your day at the studio! Your first stamp is on your loyalty card.",
      3: "Your third stamp is on your card. One more day and the next one is on us.",
    } as Record<number, string>,
    second: "Your second stamp is on your card. A small gift: on your next day, you get the smart pegboard at the classic pegboard price (€35 instead of €38). Valid for one year, just tell Yaya when you arrive.",
    full: "Card complete! Your free day is waiting for you, smart pegboard included.",
    codeLabel: "Your code",
    howTo: "Book a day as usual and enter this code at checkout: the deposit becomes €0. Nothing to pay at the studio.",
    valid: (d: string) => `Valid until ${d}. Personal code, not transferable.`,
    button: "See my card",
    book: "Book a day",
    resend: "Here is the link to your loyalty card. Keep it to follow your stamps.",
    resendSubject: "Your loyalty card · Yaya's Creative Studio",
    rules: "One stamp per fuse bead day (full day or 4 hours or more). 2nd stamp: smart pegboard at the classic price. 4th stamp: a free day.",
  },
  zh: {
    subject: (n: number) => n >= 4 ? "印章卡集满：送你一天免费拼豆 · Yaya's Creative Studio" : `你的第 ${n} 个章 · Yaya's Creative Studio`,
    hello: (name: string) => name ? `${escHtml(name)}，你好：` : "你好：",
    lines: {
      1: "谢谢你来工作室拼豆！第一个章已经盖在你的印章卡上了。",
      3: "第三个章已经盖好。再来一天，下一天就免费。",
    } as Record<number, string>,
    second: "第二个章已经盖好。送你一个小礼物：下次来可以用智能拼豆板，按普通板价格收费（35 €，不用付 38 €）。一年内有效，到店时告诉 Yaya 即可。",
    full: "印章卡集满啦！送你一天免费拼豆，含智能拼豆板。",
    codeLabel: "你的兑换码",
    howTo: "照常预约全天，付款时输入这个码，预约金变为 0 €。到店不用再付钱。",
    valid: (d: string) => `有效期至 ${d}。仅限本人使用，不可转让。`,
    button: "查看我的印章卡",
    book: "预约一天",
    resend: "这是你的印章卡链接，请保存好，随时查看集章进度。",
    resendSubject: "你的印章卡 · Yaya's Creative Studio",
    rules: "拼豆全天或满 4 小时盖一个章。第 2 个章：智能拼豆板按普通板价格。第 4 个章：送一天免费拼豆。",
  },
};

function fmtDate(iso: string, lang: "fr" | "en" | "zh"): string {
  const d = new Date(iso);
  const loc = lang === "zh" ? "zh-CN" : lang === "en" ? "en-GB" : "fr-FR";
  return new Intl.DateTimeFormat(loc, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(d);
}

function cardLink(token: string, lang: string): string {
  return `${CARD_URL}?t=${encodeURIComponent(token)}&lng=${lang}`;
}

function mailShell(inner: string): string {
  return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;color:#332847;line-height:1.6;">
  <div style="background:#332847;color:#F5EFE6;padding:22px 20px;border-radius:14px 14px 0 0;text-align:center;">
    <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#b8a8d4;">Open Studio · Bagnolet</div>
    <div style="font-size:20px;font-weight:700;margin-top:4px;">Yaya's Creative Studio</div>
  </div>
  <div style="background:#ffffff;border:1px solid #E8E3F0;border-top:none;padding:22px 20px;border-radius:0 0 14px 14px;">
${inner}
    <p style="margin:22px 0 0;text-align:center;color:#7B6A9B;font-size:13px;">Je crée donc je suis</p>
  </div>
</div>`;
}

function button(href: string, label: string, solid = true): string {
  const style = solid
    ? "background:#332847;color:#ffffff;border:1.5px solid #332847;"
    : "background:#ffffff;color:#332847;border:1.5px solid #332847;";
  return `<a href="${href}" style="display:inline-block;${style}text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:999px;margin:6px 4px 0 0;">${label}</a>`;
}

function stampEmail(lang: "fr" | "en" | "zh", name: string, pos: number, token: string, code: string | null, expires: string | null) {
  const t = T[lang];
  let body = "";
  if (pos >= 4 && code) {
    body = `
    <p style="margin:0 0 14px;">${t.full}</p>
    <div style="background:#F5EFE6;border-radius:12px;padding:16px;margin:14px 0;text-align:center;">
      <div style="font-size:13px;color:#5a4f6a;">${t.codeLabel}</div>
      <div style="font-size:24px;font-weight:700;letter-spacing:2px;margin-top:4px;">${escHtml(code)}</div>
    </div>
    <p style="margin:0 0 6px;">${t.howTo}</p>
    <p style="margin:0 0 14px;font-size:13px;color:#5a4f6a;">${t.valid(fmtDate(expires ?? new Date().toISOString(), lang))}</p>`;
  } else if (pos === 2) {
    body = `<p style="margin:0 0 14px;">${t.second}</p>`;
  } else {
    body = `<p style="margin:0 0 14px;">${t.lines[pos] ?? t.lines[1]}</p>`;
  }
  const html = mailShell(`
    <p style="margin:0 0 12px;">${t.hello(name)}</p>
${body}
    <p style="margin:14px 0 4px;font-size:13px;color:#5a4f6a;">${t.rules}</p>
    <div style="margin-top:12px;">${button(cardLink(token, lang), t.button)}${pos >= 4 ? button(BOOK_URL, t.book, false) : ""}</div>`);
  return { subject: t.subject(pos), html };
}

function resendEmail(lang: "fr" | "en" | "zh", name: string, token: string) {
  const t = T[lang];
  const html = mailShell(`
    <p style="margin:0 0 12px;">${t.hello(name)}</p>
    <p style="margin:0 0 14px;">${t.resend}</p>
    <div>${button(cardLink(token, lang), t.button)}</div>`);
  return { subject: t.resendSubject, html };
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [to], subject, html }),
  });
  if (!res.ok) console.error("Resend error:", await res.text());
  return res.ok;
}

function firstName(display: string | null | undefined): string {
  return String(display ?? "").trim().split(/\s+/)[0] ?? "";
}

// ---------- 主程序 ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method not allowed" });

  if (!(await passwordOk(req.headers.get("x-admin-password") ?? ""))) {
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
      case "today": {
        if (!validDate(body.date)) return json(req, 400, { error: "invalid date" });
        const [res, live, dayStamps] = await Promise.all([
          sb.from("reservations")
            .select("id, date, poste, start_hour, type, status, client_name, client_email, client_locale, craft_type, group_id, party_role, reward_code")
            .eq("date", body.date).order("start_hour").order("poste"),
          sb.from("live_status").select("poste, busy, client_name, started_at"),
          sb.from("loyalty_stamps").select("id, email, reservation_id, position").eq("stamped_on", body.date).is("revoked_at", null),
        ]);
        if (res.error) throw res.error;
        if (live.error) throw live.error;
        if (dayStamps.error) throw dayStamps.error;
        const emails = [...new Set([
          ...(res.data ?? []).map((r: any) => cleanEmail(r.client_email)).filter(Boolean),
          ...(dayStamps.data ?? []).map((s: any) => s.email),
        ])];
        const all = await loadFor(emails);
        const summaries: Record<string, unknown> = {};
        for (const e of emails) summaries[e] = summarize(e, all.stamps, all.rewards);
        return json(req, 200, { reservations: res.data, live: live.data, stamps: dayStamps.data, summaries });
      }

      case "stamp": {
        const email = cleanEmail(body.email);
        if (!validEmail(email)) return json(req, 400, { error: "invalid email" });
        if (!validDate(body.date)) return json(req, 400, { error: "invalid date" });
        if (!STAMP_REASONS.includes(body.reason)) return json(req, 400, { error: "invalid reason" });
        const reservationId = body.reservation_id == null ? null : Number(body.reservation_id);
        if (reservationId !== null && !Number.isInteger(reservationId)) return json(req, 400, { error: "invalid reservation" });

        let lang: "fr" | "en" | "zh" = toLang(body.lang);
        let name = String(body.name ?? "").trim().slice(0, 200);
        if (reservationId !== null) {
          const { data: r, error } = await sb.from("reservations")
            .select("id, client_email, client_locale, client_name").eq("id", reservationId).maybeSingle();
          if (error) throw error;
          if (!r) return json(req, 404, { error: "reservation not found" });
          if (!body.lang && r.client_locale) lang = toLang(r.client_locale);
          if (!name && r.client_name && cleanEmail(r.client_email) === email) name = r.client_name;
          // 只在预约还没有邮箱时补上；双人预约的第二位客人不会覆盖下单人的邮箱
          if (!r.client_email) {
            const { error: upErr } = await sb.from("reservations").update({ client_email: email }).eq("id", reservationId);
            if (upErr) throw upErr;
          }
        }
        const { data: existing } = await sb.from("loyalty_members").select("lang").eq("email", email).maybeSingle();
        if (existing?.lang && !body.lang) lang = existing.lang;

        const { data, error } = await sb.rpc("loyalty_add_stamp", {
          p_email: email, p_name: name, p_date: body.date, p_reason: body.reason,
          p_reservation_id: reservationId, p_lang: lang,
        });
        if (error) {
          if (String(error.message ?? "").includes("pool empty")) return json(req, 409, { error: "pool_empty" });
          throw error;
        }
        if (data?.status !== "ok") return json(req, 200, { ok: false, result: data });

        let expires: string | null = null;
        if (data.code) {
          const { data: rw } = await sb.from("loyalty_rewards").select("expires_at").eq("code", data.code).maybeSingle();
          expires = rw?.expires_at ?? null;
        }
        const { data: mem } = await sb.from("loyalty_members").select("display_name, lang").eq("email", email).maybeSingle();
        const mailLang = (mem?.lang ?? lang) as "fr" | "en" | "zh";
        const mail = stampEmail(mailLang, firstName(mem?.display_name), data.position, data.token, data.code, expires);
        const mailed = await sendEmail(email, mail.subject, mail.html);

        const all = await loadFor([email]);
        return json(req, 200, { ok: true, result: data, mailed, summary: summarize(email, all.stamps, all.rewards) });
      }

      case "revoke": {
        const id = Number(body.stamp_id);
        if (!Number.isInteger(id)) return json(req, 400, { error: "invalid stamp" });
        const { data, error } = await sb.rpc("loyalty_revoke_stamp", { p_stamp_id: id });
        if (error) throw error;
        return json(req, 200, { ok: data?.status === "ok", result: data });
      }

      case "members": {
        const q = String(body.q ?? "").trim().toLowerCase();
        const filter = String(body.filter ?? "all");
        const [m, s, r] = await Promise.all([
          sb.from("loyalty_members").select("email, display_name, lang, created_at").order("created_at", { ascending: false }).limit(2000),
          sb.from("loyalty_stamps").select("*").is("revoked_at", null).limit(20000),
          sb.from("loyalty_rewards").select("*").is("revoked_at", null).limit(20000),
        ]);
        if (m.error) throw m.error;
        if (s.error) throw s.error;
        if (r.error) throw r.error;
        const rows: any[] = (m.data ?? []).map((mem: any) => ({
          ...summarize(mem.email, s.data as Stamp[], r.data as Reward[]),
          name: mem.display_name ?? "",
        }));
        const counts = {
          all: rows.length,
          near: rows.filter((x) => x.count === 3).length,
          upgrade: rows.filter((x) => x.upgrade).length,
          code: rows.filter((x) => x.free_day).length,
        };
        let list = rows;
        if (q) list = list.filter((x) => x.email.includes(q) || x.name.toLowerCase().includes(q));
        if (filter === "near") list = list.filter((x) => x.count === 3);
        if (filter === "upgrade") list = list.filter((x) => x.upgrade);
        if (filter === "code") list = list.filter((x) => x.free_day);
        list.sort((a: any, b: any) => String(b.last_stamp ?? "").localeCompare(String(a.last_stamp ?? "")));
        return json(req, 200, { counts, members: list.slice(0, 300) });
      }

      case "member": {
        const email = cleanEmail(body.email);
        if (!validEmail(email)) return json(req, 400, { error: "invalid email" });
        const all = await loadFor([email]);
        const member = all.members[0];
        if (!member) return json(req, 404, { error: "not found" });
        const { count: visits } = await sb.from("reservations")
          .select("id", { count: "exact", head: true }).eq("client_email", email);
        return json(req, 200, {
          member: { email: member.email, name: member.display_name, lang: member.lang, created_at: member.created_at },
          summary: summarize(email, all.stamps, all.rewards),
          stamps: all.stamps.sort((a, b) => b.stamped_on.localeCompare(a.stamped_on) || b.id - a.id),
          rewards: all.rewards.sort((a, b) => b.issued_at.localeCompare(a.issued_at)),
          visits: visits ?? 0,
        });
      }

      case "use_upgrade": {
        const id = Number(body.reward_id);
        if (!Number.isInteger(id)) return json(req, 400, { error: "invalid reward" });
        const { data, error } = await sb.from("loyalty_rewards")
          .update({ used_at: new Date().toISOString(), used_note: "Utilisée sur place · 现场使用" })
          .eq("id", id).eq("kind", "upgrade").is("used_at", null).is("revoked_at", null)
          .select("id");
        if (error) throw error;
        return json(req, 200, { ok: (data ?? []).length === 1 });
      }

      case "resend": {
        const email = cleanEmail(body.email);
        const { data: mem, error } = await sb.from("loyalty_members")
          .select("display_name, lang, card_token").eq("email", email).maybeSingle();
        if (error) throw error;
        if (!mem) return json(req, 404, { error: "not found" });
        const mail = resendEmail(mem.lang, firstName(mem.display_name), mem.card_token);
        const mailed = await sendEmail(email, mail.subject, mail.html);
        return json(req, 200, { ok: mailed });
      }

      case "pool": {
        const [codes, used] = await Promise.all([
          sb.from("loyalty_codes").select("code", { count: "exact", head: true }),
          sb.from("loyalty_rewards").select("id", { count: "exact", head: true }).not("code", "is", null),
        ]);
        if (codes.error) throw codes.error;
        if (used.error) throw used.error;
        return json(req, 200, { total: codes.count ?? 0, left: (codes.count ?? 0) - (used.count ?? 0) });
      }

      default:
        return json(req, 400, { error: "unknown action" });
    }
  } catch (e) {
    console.error("loyalty-admin error:", e);
    return json(req, 500, { error: "server error" });
  }
});
