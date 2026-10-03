// ============================================================
// Open Studio 预约自动化 — Supabase Edge Function
// 触发：Shopify「订单付款成功」webhook (orders/paid)
// 作用：① 遍历订单里每一个预约 line item，各写一行 reservations 表
//       ② 给每位客户各发一封确认邮件（含 .ics），Yaya 收一封整单汇总
//       ③ 用 source_line_item_id 防止 webhook 重复触发
//       ④ 记录手工类型（拼豆 / 羊毛毡）到 craft_type，并显示在邮件里
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SHOPIFY_WEBHOOK_SECRET = Deno.env.get("SHOPIFY_WEBHOOK_SECRET") ?? "";

// false = observe mode (log the Shopify signature check, still process every order)
// true  = reject mode (invalid or missing signature -> 401, order not processed)
const HMAC_ENFORCE = false;

const FROM_EMAIL = "reservation@yayascreativestudio.com";
const FROM_NAME = "Yaya's Creative Studio";
const YAYA_EMAIL = "contact.yayacreativestudio@gmail.com";
const STUDIO_ADDRESS = "10 Rue Francisco Ferrer, 93170 Bagnolet, France";
const YAYA_PHONE = "0666899357";

const DAY_START_HOUR = 12;
const DAY_START_MIN = 30;
const DAY_END_HOUR = 19;
const DAY_END_MIN = 30;
const DAY_RANGE_LABEL = "12h30 – 19h30";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function getProp(props: any[], name: string): string {
  if (!Array.isArray(props)) return "";
  const found = props.find((p) => p.name === name);
  return found ? String(found.value) : "";
}

function getActiviteLabel(props: any[]): string {
  const withAccent = getProp(props, "Activité");
  if (withAccent) return withAccent;
  return getProp(props, "Activite");
}

function toCraftType(label: string): string | null {
  const s = String(label || "");
  if (s.includes("Feutrage") || s.includes("羊毛毡")) return "needle_felting";
  if (s.includes("Perles") || s.includes("拼豆")) return "fuse_beads";
  return null;
}

function parseHour(heure: string, type: string): number {
  if (type === "journee") return DAY_START_HOUR;
  const m = String(heure).match(/(\d{1,2})/);
  return m ? parseInt(m[1], 10) : DAY_START_HOUR;
}

function isJournee(typeLabel: string): boolean {
  return typeLabel.includes("Journée") || typeLabel.includes("全天") || typeLabel.includes("journee");
}

function buildICS(opts: {
  date: string;
  startHour: number;
  journee: boolean;
  poste: string;
  activiteLabel: string;
}): string {
  const { date, startHour, journee, poste, activiteLabel } = opts;
  const [y, mo, d] = date.split("-");
  const pad = (n: number) => String(n).padStart(2, "0");

  const startH = journee ? DAY_START_HOUR : startHour;
  const startMin = journee ? DAY_START_MIN : 30;
  const endH = journee ? DAY_END_HOUR : startHour + 1;
  const endMin = journee ? DAY_END_MIN : 30;

  const dtStart = `${y}${mo}${d}T${pad(startH)}${pad(startMin)}00`;
  const dtEnd = `${y}${mo}${d}T${pad(endH)}${pad(endMin)}00`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `${date}-${poste}-${startH}-${Math.random().toString(36).slice(2, 8)}@yayascreativestudio.com`;

  const activiteLine = activiteLabel ? ` Activité: ${activiteLabel}.` : "";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Yaya's Creative Studio//Reservation//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=Europe/Paris:${dtStart}`,
    `DTEND;TZID=Europe/Paris:${dtEnd}`,
    "SUMMARY:Atelier Yaya's Creative Studio",
    `LOCATION:${STUDIO_ADDRESS}`,
    `DESCRIPTION:Réservation atelier — Poste ${poste}.${activiteLine} Tél Yaya: ${YAYA_PHONE}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function buildEmailHTML(opts: {
  date: string;
  heure: string;
  poste: string;
  typeLabel: string;
  journee: boolean;
  activiteLabel: string;
}): string {
  const { date, poste, journee, activiteLabel } = opts;
  const [y, mo, d] = date.split("-");
  const frDate = `${d}/${mo}/${y}`;
  const creneauFR = journee ? `Journée entière (${DAY_RANGE_LABEL})` : `À partir de ${opts.heure}`;
  const creneauZH = journee ? `全天 (${DAY_RANGE_LABEL})` : `${opts.heure} 起`;

  const activiteBlock = activiteLabel
    ? `<div style="margin-top:6px;"><strong>Activité · 手工类型 :</strong> ${activiteLabel}</div>`
    : "";

  return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;color:#332847;line-height:1.6;">
  <div style="background:#332847;color:#F5EFE6;padding:24px 20px;border-radius:14px 14px 0 0;text-align:center;">
    <div style="font-size:20px;font-weight:700;">Réservation confirmée ✿</div>
    <div style="font-size:13px;opacity:.85;margin-top:4px;">预约已确认 · Yaya's Creative Studio</div>
  </div>
  <div style="background:#ffffff;border:1px solid #E8E3F0;border-top:none;padding:22px 20px;border-radius:0 0 14px 14px;">
    <p style="margin:0 0 14px;">Merci pour votre réservation ! Voici les détails de votre créneau.<br>
    <span style="color:#7B6A9B;font-size:13px;">感谢您的预约！以下是您的预约详情。</span></p>

    <div style="background:#F5EFE6;border-left:4px solid #4db8a0;border-radius:8px;padding:14px 16px;margin:16px 0;">
      <div style="margin-bottom:6px;"><strong>Date · 日期 :</strong> ${frDate}</div>
      <div style="margin-bottom:6px;"><strong>Horaire · 时间 :</strong> ${creneauFR}<br>
        <span style="color:#7B6A9B;font-size:13px;">${creneauZH}</span></div>
      <div><strong>Poste · 工作台 :</strong> ${poste}</div>
      ${activiteBlock}
    </div>

    <p style="margin:14px 0 6px;"><strong>Adresse · 地址</strong></p>
    <p style="margin:0 0 14px;">${STUDIO_ADDRESS}</p>

    <div style="background:#fbeef4;border:1px solid #f0d4e2;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:14px;">
      <strong style="color:#c47a9a;">À votre arrivée · 到达时</strong><br>
      Si personne ne répond après la sonnette, merci d'appeler Yaya au <strong>${YAYA_PHONE}</strong>.<br>
      <span style="color:#7B6A9B;font-size:13px;">按门铃后若无人回应，请致电 Yaya：${YAYA_PHONE}</span>
    </div>

    <p style="margin:14px 0 4px;font-size:13px;color:#5a4f6a;">
      Ouvert du mercredi au dimanche, ${DAY_RANGE_LABEL} (fermé lundi &amp; mardi).<br>
      <span style="color:#7B6A9B;">营业时间：周三至周日 ${DAY_RANGE_LABEL}（周一、周二关店）</span>
    </p>

    <p style="margin:16px 0 0;font-size:13px;color:#5a4f6a;">
      Un fichier calendrier (.ics) est joint : ajoutez le rendez-vous à votre téléphone en un clic.<br>
      <span style="color:#7B6A9B;">附件为日历文件（.ics），点击即可加入手机日历。</span>
    </p>

    <p style="margin:20px 0 0;text-align:center;color:#7B6A9B;font-size:13px;">
      À très bientôt ! · 期待与您相见<br>
      <strong style="color:#332847;">Yaya's Creative Studio</strong>
    </p>
  </div>
</div>`;
}

function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

function buildYayaSummaryHTML(clientName: string, clientEmail: string, rows: {date:string;heure:string;poste:string;journee:boolean;activiteLabel:string}[]): string {
  const items = rows.map((r) => {
    const [y, mo, d] = r.date.split("-");
    const frDate = `${d}/${mo}/${y}`;
    const creneau = r.journee ? `Journée (${DAY_RANGE_LABEL})` : `${r.heure} 起`;
    const activite = r.activiteLabel
      ? ` · <strong style="color:#4db8a0;">${r.activiteLabel}</strong>`
      : ` · <span style="color:#c47a9a;">Activité non précisée · 未注明手工类型</span>`;
    return `<li style="margin-bottom:6px;">Poste <strong>${r.poste}</strong> · ${frDate} · ${creneau}${activite}</li>`;
  }).join("");
  return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;color:#332847;line-height:1.6;">
  <div style="background:#332847;color:#F5EFE6;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
    <strong>Nouvelle réservation · 新预约</strong>
  </div>
  <div style="background:#fff;border:1px solid #E8E3F0;border-top:none;padding:20px;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 10px;"><strong>Client · 客户 :</strong> ${clientName || "—"} (${clientEmail || "—"})</p>
    <p style="margin:0 0 6px;"><strong>${rows.length}</strong> créneau(x) réservé(s) · 共 ${rows.length} 个预约 :</p>
    <ul style="margin:8px 0 0;padding-left:20px;">${items}</ul>
  </div>
</div>`;
}

async function sendEmail(payload: any) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) console.error("Resend error:", data);
  return data;
}

// Shopify signs every webhook: base64(HMAC-SHA256(raw body, secret)) in X-Shopify-Hmac-Sha256.
async function shopifyHmacOk(rawBody: Uint8Array, header: string | null): Promise<boolean> {
  if (!SHOPIFY_WEBHOOK_SECRET || !header) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SHOPIFY_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, rawBody));
  const expected = btoa(String.fromCharCode(...sig));
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  try {
    const rawBody = new Uint8Array(await req.arrayBuffer());
    const hmacOk = await shopifyHmacOk(rawBody, req.headers.get("X-Shopify-Hmac-Sha256"));
    if (!hmacOk) {
      console.error(`HMAC check failed (${HMAC_ENFORCE ? "rejected" : "observe mode"})`);
      if (HMAC_ENFORCE) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const order = JSON.parse(new TextDecoder().decode(rawBody));
    const orderId = String(order?.id ?? order?.order_number ?? "");
    if (hmacOk) console.log(`HMAC OK (order ${orderId})`);
    const lineItems = order?.line_items || [];

    const reservationItems: any[] = [];
    for (const li of lineItems) {
      const pr = li?.properties || [];
      if (Array.isArray(pr) && pr.some((p: any) => p.name === "Poste")) {
        reservationItems.push(li);
      }
    }

    if (reservationItems.length === 0) {
      return new Response(JSON.stringify({ skipped: "no reservation properties" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const clientEmail = order?.email || order?.contact_email || "";
    const clientName =
      ((order?.customer?.first_name || "") + " " + (order?.customer?.last_name || "")).trim();

    const yayaRows: {date:string;heure:string;poste:string;journee:boolean;activiteLabel:string}[] = [];

    for (const li of reservationItems) {
      const props = li?.properties || [];
      const poste = getProp(props, "Poste");
      const date = getProp(props, "Date");
      const heure = getProp(props, "Heure");
      const typeLabel = getProp(props, "Type");
      const activiteLabel = getActiviteLabel(props);
      const craftType = toCraftType(activiteLabel);
      const journee = isJournee(typeLabel);
      const startHour = parseHour(heure, journee ? "journee" : "hourly");

      const lineItemId = String(li?.id ?? `${orderId}-${poste}-${date}-${startHour}`);

      const { error: dbErr } = await sb.from("reservations").insert({
        date,
        poste,
        start_hour: startHour,
        type: journee ? "journee" : "hourly",
        status: "confirmed",
        client_name: clientName || clientEmail || "Client",
        source_line_item_id: lineItemId,
        craft_type: craftType,
      });

      if (dbErr) {
        if ((dbErr as any).code === "23505") {
          console.log(`Duplicate skipped: line item ${lineItemId}`);
          continue;
        }
        console.error("DB insert error:", dbErr);
      }

      const ics = buildICS({ date, startHour, journee, poste, activiteLabel });
      const html = buildEmailHTML({ date, heure, poste, typeLabel, journee, activiteLabel });
      if (clientEmail && clientEmail.includes("@")) {
        await sendEmail({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [clientEmail],
          cc: [YAYA_EMAIL],
          subject: "Confirmation de votre réservation · 预约确认 — Yaya's Creative Studio",
          html,
          attachments: [{ filename: "reservation.ics", content: toBase64(ics) }],
        });
      }

      yayaRows.push({ date, heure, poste, journee, activiteLabel });
    }

    if (yayaRows.length > 0) {
      await sendEmail({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [YAYA_EMAIL],
        subject: `Nouvelle réservation (${yayaRows.length}) · 新预约 — ${clientName || clientEmail}`,
        html: buildYayaSummaryHTML(clientName, clientEmail, yayaRows),
      });
    }

    return new Response(
      JSON.stringify({ ok: true, processed: reservationItems.length, written: yayaRows.length }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Function error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
