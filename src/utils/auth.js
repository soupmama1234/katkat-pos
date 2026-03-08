// src/utils/auth.js
import { supabase as sb } from "../supabase";

const SESSION_KEY = "katkat_session";

// ── Permission matrix ─────────────────────────────────────────
const PERMISSIONS = {
  owner: [
    "pos", "dashboard", "analytics", "orders",
    "delete_order", "close_day", "menu_manager",
    "modifier_manager", "members", "staff_manager",
  ],
  manager: [
    "pos", "dashboard", "orders",
    "delete_order", "close_day",
  ],
  staff: ["pos"],
};

export function can(role, action) {
  return (PERMISSIONS[role] || []).includes(action);
}

// ── Session ───────────────────────────────────────────────────
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession(staffRow) {
  const session = {
    id: staffRow.id,
    name: staffRow.name,
    role: staffRow.role,
    loginAt: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

// ── Hash ด้วย Web Crypto API (built-in ทุก browser ไม่ต้อง install) ──
// format: "sha256:salt:hash"
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin) {
  const salt = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const hash = await sha256(salt + String(pin));
  return `sha256:${salt}:${hash}`;
}

async function verifyPin(pin, stored) {
  if (stored && stored.startsWith("sha256:")) {
    const parts = stored.split(":");
    const salt = parts[1];
    const hash = parts[2];
    const check = await sha256(salt + String(pin));
    return check === hash;
  }
  // fallback plain (dev only)
  return String(pin) === stored;
}

// ── Rate limiting (localStorage) ─────────────────────────────
const RATE_KEY = "katkat_login_attempts";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 1000; // 30 วินาที

function getRateState() {
  try { return JSON.parse(localStorage.getItem(RATE_KEY)) || { count: 0, lockedUntil: 0 }; }
  catch { return { count: 0, lockedUntil: 0 }; }
}
function setRateState(state) {
  localStorage.setItem(RATE_KEY, JSON.stringify(state));
}
function resetRate() {
  localStorage.removeItem(RATE_KEY);
}

export function getRateLockRemaining() {
  const s = getRateState();
  if (s.lockedUntil > Date.now()) return Math.ceil((s.lockedUntil - Date.now()) / 1000);
  return 0;
}

// ── Login ─────────────────────────────────────────────────────
export async function login(name, pin) {
  // ตรวจ rate limit
  const rate = getRateState();
  if (rate.lockedUntil > Date.now()) {
    const sec = Math.ceil((rate.lockedUntil - Date.now()) / 1000);
    return { ok: false, error: `ล็อคอยู่ — รออีก ${sec} วินาที` };
  }

  // ดึง staff จาก DB
  const { data, error } = await sb
    .from("staff")
    .select("*")
    .ilike("name", name.trim())
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return bumpRate("ไม่พบชื่อผู้ใช้ หรือบัญชีถูกปิดใช้งาน");
  }

  // verify PIN
  const ok = await verifyPin(pin, data.pin_hash);
  if (!ok) {
    return bumpRate("PIN ไม่ถูกต้อง");
  }

  // สำเร็จ
  resetRate();
  const session = saveSession(data);
  return { ok: true, session };
}

function bumpRate(errorMsg) {
  const s = getRateState();
  const newCount = s.count + 1;
  if (newCount >= MAX_ATTEMPTS) {
    setRateState({ count: 0, lockedUntil: Date.now() + LOCKOUT_MS });
    return { ok: false, error: `กรอกผิดครบ ${MAX_ATTEMPTS} ครั้ง — ล็อค 30 วินาที` };
  }
  setRateState({ count: newCount, lockedUntil: 0 });
  return { ok: false, error: `${errorMsg} (${newCount}/${MAX_ATTEMPTS})` };
    }
    
