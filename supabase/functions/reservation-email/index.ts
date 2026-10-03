// ============================================================
// Open Studio 预约自动化 — Supabase Edge Function
// 触发：Shopify「订单付款成功」webhook (orders/paid)
// 作用：① 遍历订单里每一个预约 line item，各写一行 reservations 表
//       ② 给每位客户各发一封确认邮件（含 .ics），Yaya 收一封整单汇总
//       ③ 用 source_line_item_id 防止 webhook 重复触发
//       ④ 记录手工类型（拼豆 / 羊毛毡）到 craft_type，并显示在邮件里
//       ⑤ 亲子（Parent-enfant）line item 没有 Poste：用数据库函数 book_family
//         一次订完整个家庭；订不到就提醒 Yaya，并告诉客户「已收到，会联系您」
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

// ===== Parent-enfant · 亲子 =====
// 亲子 line item：没有 Poste，Type 含 Parent-enfant 或 亲子。
// Enfants 为 1 到 3 才预约；否则当作 invalid（不写库，提醒 Yaya，客户收到「已收到」）。
// 带 Poste 的 line item 一律走原来的流程。
const FAMILY_HOURS = 2;
// Numéro affiché dans les e-mails parent-enfant (les e-mails existants gardent YAYA_PHONE).
const YAYA_PHONE_DISPLAY = "06 66 89 93 57";
// 到店余款（已扣 8,90 € 预约金）：每个孩子 15 € - 8,90 €
const FAMILY_REMAINING: Record<number, string> = { 1: "6,10 €", 2: "21,10 €", 3: "36,10 €" };
const FAMILY_PRICING_FR =
  "15 € par enfant pour 2 h. Dépassement : +7,50 € par heure et par enfant, ou +3,75 € par demi-heure. " +
  "Le parent accompagne gratuitement ; s'il crée aussi, tarif adulte 10 € / h sur place.";
const FAMILY_PRICING_ZH =
  "每个孩子 2 小时 15 €。超时每个孩子每小时 +7,50 €，每半小时 +3,75 €。家长陪同免费；家长也一起做的话，现场按成人 10 €/小时收费。";

type FamilyRow = { date: string; startHour: number; children: number; postes: string[] };

function familyChildren(props: any[]): number {
  const n = getProp(props, "Enfants").trim();
  return /^[123]$/.test(n) ? parseInt(n, 10) : 0;
}

function isFamilyLine(props: any[]): boolean {
  if (!Array.isArray(props) || props.some((p: any) => p.name === "Poste")) return false;
  const t = getProp(props, "Type");
  return t.includes("Parent-enfant") || t.includes("亲子");
}

// "14h30" ou "14h30 à 16h30" -> 14 ; sinon null (book_family répondra "invalid")
function parseFamilyHour(heure: string): number | null {
  const m = String(heure).trim().match(/^(\d{1,2})h30/);
  return m ? parseInt(m[1], 10) : null;
}

function familyRangeFR(h: number): string {
  return `${h}h30 à ${h + FAMILY_HOURS}h30`;
}
function familyRangeZH(h: number): string {
  return `${h}h30 至 ${h + FAMILY_HOURS}h30`;
}
// n = 0 : nombre d'enfants invalide, on affiche la valeur reçue telle quelle.
function familyPeopleFR(n: number, raw = ""): string {
  if (n < 1) return `Enfants : ${escHtml(raw) || "?"}`;
  return `1 adulte + ${n} enfant${n > 1 ? "s" : ""}`;
}
function familyPeopleZH(n: number, raw = ""): string {
  if (n < 1) return `孩子人数：${escHtml(raw) || "?"}`;
  return `1 位家长 + ${n} 个孩子`;
}

function escHtml(s: string): string {
  return String(s || "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

function frDateOf(date: string): string {
  const [y, mo, d] = String(date).split("-");
  return d && mo && y ? `${d}/${mo}/${y}` : String(date || "?");
}

function buildFamilyICS(date: string, startHour: number, children: number): string {
  const [y, mo, d] = date.split("-");
  const pad = (n: number) => String(n).padStart(2, "0");
  const dtStart = `${y}${mo}${d}T${pad(startHour)}3000`;
  const dtEnd = `${y}${mo}${d}T${pad(startHour + FAMILY_HOURS)}3000`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `${date}-family-${startHour}-${Math.random().toString(36).slice(2, 8)}@yayascreativestudio.com`;
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
    "SUMMARY:Atelier parent-enfant · Yaya's Creative Studio",
    `LOCATION:${STUDIO_ADDRESS}`,
    `DESCRIPTION:Atelier parent-enfant: ${familyPeopleFR(children)}. Perles à repasser. Tél Yaya: ${YAYA_PHONE_DISPLAY}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// Bas de mail commun aux deux e-mails clients parent-enfant (même style que l'e-mail actuel).
function familyMailFooter(withIcs: boolean): string {
  const icsBlock = withIcs
    ? `
    <p style="margin:16px 0 0;font-size:13px;color:#5a4f6a;">
      Un fichier calendrier (.ics) est joint : ajoutez le rendez-vous à votre téléphone en un clic.<br>
      <span style="color:#7B6A9B;">附件为日历文件（.ics），点击即可加入手机日历。</span>
    </p>`
    : "";
  return `
    <p style="margin:14px 0 6px;"><strong>Adresse · 地址</strong></p>
    <p style="margin:0 0 14px;">${STUDIO_ADDRESS}</p>

    <div style="background:#fbeef4;border:1px solid #f0d4e2;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:14px;">
      <strong style="color:#c47a9a;">À votre arrivée · 到达时</strong><br>
      Si personne ne répond après la sonnette, merci d'appeler Yaya au <strong>${YAYA_PHONE_DISPLAY}</strong>.<br>
      <span style="color:#7B6A9B;font-size:13px;">按门铃后若无人回应，请致电 Yaya：${YAYA_PHONE_DISPLAY}</span>
    </div>

    <p style="margin:14px 0 4px;font-size:13px;color:#5a4f6a;">
      Ouvert du mercredi au dimanche, de 12h30 à 19h30 (fermé lundi et mardi).<br>
      <span style="color:#7B6A9B;">营业时间：周三至周日 12h30 至 19h30（周一、周二关店）</span>
    </p>
${icsBlock}
    <p style="margin:20px 0 0;text-align:center;color:#7B6A9B;font-size:13px;">
      À très bientôt ! · 期待与您相见<br>
      <strong style="color:#332847;">Yaya's Creative Studio</strong>
    </p>`;
}

function familyDetailsBox(date: string, startHour: number | null, children: number, border: string, childrenRaw = ""): string {
  const horaireFR = startHour === null ? "?" : `De ${familyRangeFR(startHour)} (2 h)`;
  const horaireZH = startHour === null ? "?" : `${familyRangeZH(startHour)}（2 小时）`;
  return `
    <div style="background:#F5EFE6;border-left:4px solid ${border};border-radius:8px;padding:14px 16px;margin:16px 0;">
      <div style="margin-bottom:6px;"><strong>Date · 日期 :</strong> ${escHtml(frDateOf(date))}</div>
      <div style="margin-bottom:6px;"><strong>Horaire · 时间 :</strong> ${horaireFR}<br>
        <span style="color:#7B6A9B;font-size:13px;">${horaireZH}</span></div>
      <div style="margin-bottom:6px;"><strong>Participants · 人数 :</strong> ${familyPeopleFR(children, childrenRaw)}<br>
        <span style="color:#7B6A9B;font-size:13px;">${familyPeopleZH(children, childrenRaw)}</span></div>
      <div><strong>Activité · 手工类型 :</strong> Perles à repasser · 拼豆</div>
    </div>`;
}

function buildFamilyEmailHTML(date: string, startHour: number, children: number): string {
  return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;color:#332847;line-height:1.6;">
  <div style="background:#332847;color:#F5EFE6;padding:24px 20px;border-radius:14px 14px 0 0;text-align:center;">
    <div style="font-size:20px;font-weight:700;">Réservation confirmée ✿</div>
    <div style="font-size:13px;opacity:.85;margin-top:4px;">预约已确认 · Atelier parent-enfant · 亲子时段</div>
  </div>
  <div style="background:#ffffff;border:1px solid #E8E3F0;border-top:none;padding:22px 20px;border-radius:0 0 14px 14px;">
    <p style="margin:0 0 14px;">Merci pour votre réservation ! Voici les détails de votre atelier parent-enfant.<br>
    <span style="color:#7B6A9B;font-size:13px;">感谢您的预约！以下是您的亲子时段详情。</span></p>
${familyDetailsBox(date, startHour, children, "#4db8a0")}
    <div style="border-left:4px solid #7B6A9B;background:#f3f0f9;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:14px;">
      <strong>Tarif · 收费</strong><br>
      ${FAMILY_PRICING_FR}<br>
      <span style="color:#7B6A9B;font-size:13px;">${FAMILY_PRICING_ZH}</span>
      <div style="margin-top:10px;"><strong>Reste à régler sur place · 到店需付 : ${FAMILY_REMAINING[children]}</strong><br>
        <span style="font-size:13px;color:#5a4f6a;">Acompte de 8,90 € déjà déduit, hors dépassement.</span><br>
        <span style="color:#7B6A9B;font-size:13px;">已扣除 8,90 € 预约金，不含超时费用。</span></div>
    </div>
${familyMailFooter(true)}
  </div>
</div>`;
}

// E-mail client quand la réservation n'a pas pu être enregistrée automatiquement.
function buildFamilyPendingEmailHTML(date: string, startHour: number | null, children: number, childrenRaw = ""): string {
  return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;color:#332847;line-height:1.6;">
  <div style="background:#332847;color:#F5EFE6;padding:24px 20px;border-radius:14px 14px 0 0;text-align:center;">
    <div style="font-size:20px;font-weight:700;">Réservation reçue ✿</div>
    <div style="font-size:13px;opacity:.85;margin-top:4px;">预约已收到 · Atelier parent-enfant · 亲子时段</div>
  </div>
  <div style="background:#ffffff;border:1px solid #E8E3F0;border-top:none;padding:22px 20px;border-radius:0 0 14px 14px;">
    <p style="margin:0 0 14px;">Merci ! Nous avons bien reçu votre acompte pour un atelier parent-enfant.<br>
    <span style="color:#7B6A9B;font-size:13px;">谢谢！我们已收到您亲子时段的预约金。</span></p>
${familyDetailsBox(date, startHour, children, "#c47a9a", childrenRaw)}
    <div style="background:#fbeef4;border:1px solid #f0d4e2;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:14px;">
      <strong style="color:#c47a9a;">Pas encore confirmée · 尚未确认</strong><br>
      Nous vérifions les postes disponibles pour ce créneau. Yaya vous contactera très vite pour confirmer votre réservation.
      Merci d'attendre notre message avant de venir.<br>
      <span style="color:#7B6A9B;font-size:13px;">我们正在确认这个时段的工位。Yaya 会尽快联系您确认预约。收到我们的消息之前，请先不要前往工作室。</span>
    </div>

    <p style="margin:14px 0 0;font-size:14px;">
      Une question ? Appelez Yaya au <strong>${YAYA_PHONE_DISPLAY}</strong>.<br>
      <span style="color:#7B6A9B;font-size:13px;">有任何问题请致电 Yaya：${YAYA_PHONE_DISPLAY}</span>
    </p>

    <p style="margin:20px 0 0;text-align:center;color:#7B6A9B;font-size:13px;">
      À très bientôt ! · 期待与您相见<br>
      <strong style="color:#332847;">Yaya's Creative Studio</strong>
    </p>
  </div>
</div>`;
}

function buildFamilyAlertHTML(opts: {
  orderLabel: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  date: string;
  heure: string;
  startHour: number | null;
  children: number;
  childrenRaw: string;
  reason: string;
}): string {
  const o = opts;
  const horaire = o.startHour === null ? escHtml(o.heure || "?") : familyRangeFR(o.startHour);
  return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;color:#332847;line-height:1.6;">
  <div style="background:#c47a9a;color:#ffffff;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
    <strong>Conflit parent-enfant · 亲子预约未能自动确认</strong>
  </div>
  <div style="background:#fff;border:1px solid #E8E3F0;border-top:none;padding:20px;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 10px;">Rien n'a été enregistré dans le planning. Le client a reçu un e-mail « réservation reçue, nous vous contactons ».<br>
    <span style="color:#7B6A9B;font-size:13px;">没有写入任何预约。客户收到的是「已收到，我们会联系您」的邮件。</span></p>
    <div style="background:#F5EFE6;border-left:4px solid #c47a9a;border-radius:8px;padding:14px 16px;margin:12px 0;">
      <div><strong>Commande · 订单 :</strong> ${escHtml(o.orderLabel)}</div>
      <div><strong>Client · 客户 :</strong> ${escHtml(o.clientName || "?")} (${escHtml(o.clientEmail || "?")})</div>
      <div><strong>Téléphone · 电话 :</strong> ${escHtml(o.clientPhone || "?")}</div>
      <div><strong>Date · 日期 :</strong> ${escHtml(frDateOf(o.date))}</div>
      <div><strong>Horaire · 时间 :</strong> ${horaire}</div>
      <div><strong>Participants · 人数 :</strong> ${familyPeopleFR(o.children, o.childrenRaw)} · ${familyPeopleZH(o.children, o.childrenRaw)}</div>
      <div><strong>Raison · 原因 :</strong> ${escHtml(o.reason)}</div>
    </div>
    <p style="margin:10px 0 0;"><strong>À faire · 待办 :</strong> contacter le client pour proposer un autre créneau ou rembourser l'acompte.<br>
    <span style="color:#7B6A9B;font-size:13px;">联系客户，改约其他时段或退还预约金。</span></p>
  </div>
</div>`;
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

function buildYayaSummaryHTML(clientName: string, clientEmail: string, rows: {date:string;heure:string;poste:string;journee:boolean;activiteLabel:string}[], families: FamilyRow[] = []): string {
  const items = rows.map((r) => {
    const [y, mo, d] = r.date.split("-");
    const frDate = `${d}/${mo}/${y}`;
    const creneau = r.journee ? `Journée (${DAY_RANGE_LABEL})` : `${r.heure} 起`;
    const activite = r.activiteLabel
      ? ` · <strong style="color:#4db8a0;">${r.activiteLabel}</strong>`
      : ` · <span style="color:#c47a9a;">Activité non précisée · 未注明手工类型</span>`;
    return `<li style="margin-bottom:6px;">Poste <strong>${r.poste}</strong> · ${frDate} · ${creneau}${activite}</li>`;
  }).join("");
  const familyItems = families.map((f) =>
    `<li style="margin-bottom:6px;">${frDateOf(f.date)} · ${familyRangeFR(f.startHour)} · ${familyPeopleFR(f.children)} · ` +
    `Postes <strong>${f.postes.join(", ")}</strong> · <strong style="color:#4db8a0;">Perles à repasser · 拼豆</strong> · ` +
    `reste sur place ${FAMILY_REMAINING[f.children]}</li>`
  ).join("");
  const familyBlock = families.length > 0
    ? `
    <p style="margin:12px 0 6px;"><strong>Parent-enfant · 亲子</strong> (${families.length}) :</p>
    <ul style="margin:8px 0 0;padding-left:20px;">${familyItems}</ul>`
    : "";
  return `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;color:#332847;line-height:1.6;">
  <div style="background:#332847;color:#F5EFE6;padding:20px;border-radius:12px 12px 0 0;text-align:center;">
    <strong>Nouvelle réservation · 新预约</strong>
  </div>
  <div style="background:#fff;border:1px solid #E8E3F0;border-top:none;padding:20px;border-radius:0 0 12px 12px;">
    <p style="margin:0 0 10px;"><strong>Client · 客户 :</strong> ${clientName || "—"} (${clientEmail || "—"})</p>
    ${rows.length > 0 ? `<p style="margin:0 0 6px;"><strong>${rows.length}</strong> créneau(x) réservé(s) · 共 ${rows.length} 个预约 :</p>
    <ul style="margin:8px 0 0;padding-left:20px;">${items}</ul>` : ""}${familyBlock}
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
    const familyItems: any[] = [];
    for (const li of lineItems) {
      const pr = li?.properties || [];
      if (Array.isArray(pr) && pr.some((p: any) => p.name === "Poste")) {
        reservationItems.push(li);
      } else if (isFamilyLine(pr)) {
        familyItems.push(li);
      }
    }

    if (reservationItems.length === 0 && familyItems.length === 0) {
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

    // ===== Parent-enfant · 亲子 =====
    const familyRows: FamilyRow[] = [];
    const orderLabel = String(order?.name || (order?.order_number ? `#${order.order_number}` : orderId));
    const clientPhone = String(order?.phone || order?.customer?.phone || order?.billing_address?.phone || "");

    for (const li of familyItems) {
      const props = li?.properties || [];
      const date = getProp(props, "Date");
      const heure = getProp(props, "Heure");
      const childrenRaw = getProp(props, "Enfants").trim();
      const children = familyChildren(props);
      const startHour = parseFamilyHour(heure);
      const lineItemId = String(li?.id ?? `${orderId}-family-${date}-${heure}`);

      // Enfants hors 1 à 3 : pas d'appel à book_family, traité comme "invalid"
      const { data: booking, error: rpcErr } = children > 0
        ? await sb.rpc("book_family", {
          p_date: date,
          p_start_hour: startHour,
          p_children: children,
          p_client_name: clientName || clientEmail || "Client",
          p_line_item_id: lineItemId,
        })
        : { data: { status: "invalid", reason: `Enfants = "${childrenRaw}"` }, error: null };
      const status = rpcErr ? "error" : String(booking?.status ?? "error");

      if (status === "duplicate") {
        console.log(`Duplicate skipped: family line item ${lineItemId}`);
        continue;
      }

      if (status === "booked" && startHour !== null) {
        const postes: string[] = Array.isArray(booking?.postes) ? booking.postes : [];
        console.log(`Family booked: line item ${lineItemId}, postes ${postes.join(",")}`);
        if (clientEmail && clientEmail.includes("@")) {
          await sendEmail({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: [clientEmail],
            cc: [YAYA_EMAIL],
            subject: "Confirmation de votre atelier parent-enfant · 亲子预约确认 · Yaya's Creative Studio",
            html: buildFamilyEmailHTML(date, startHour, children),
            attachments: [{ filename: "reservation.ics", content: toBase64(buildFamilyICS(date, startHour, children)) }],
          });
        }
        familyRows.push({ date, startHour, children, postes });
        continue;
      }

      // conflict / invalid / error: nothing was written
      const reason = rpcErr
        ? `Erreur technique · 技术错误 (${(rpcErr as any).message ?? "rpc"})`
        : status === "conflict"
          ? `Pas assez de postes libres · 工位不够 (libres : ${(booking?.free_postes ?? []).join(", ") || "aucun"} ; il en faut ${booking?.needed})`
          : `Données invalides · 数据无效 (${booking?.reason ?? status})`;
      console.error(`Family not booked (${status}): line item ${lineItemId}`, rpcErr ?? booking);

      await sendEmail({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [YAYA_EMAIL],
        subject: `Conflit parent-enfant · 亲子预约冲突 · Commande ${orderLabel}`,
        html: buildFamilyAlertHTML({
          orderLabel, clientName, clientEmail, clientPhone, date, heure, startHour, children, childrenRaw, reason,
        }),
      });
      if (clientEmail && clientEmail.includes("@")) {
        await sendEmail({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [clientEmail],
          subject: "Réservation reçue · 预约已收到 · Yaya's Creative Studio",
          html: buildFamilyPendingEmailHTML(date, startHour, children, childrenRaw),
        });
      }
    }

    if (yayaRows.length > 0 || familyRows.length > 0) {
      await sendEmail({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [YAYA_EMAIL],
        subject: `Nouvelle réservation (${yayaRows.length + familyRows.length}) · 新预约 — ${clientName || clientEmail}`,
        html: buildYayaSummaryHTML(clientName, clientEmail, yayaRows, familyRows),
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: reservationItems.length,
        written: yayaRows.length,
        family_processed: familyItems.length,
        family_written: familyRows.length,
      }),
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
