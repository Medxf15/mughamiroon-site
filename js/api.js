// Minimal Supabase client (Auth + PostgREST) with no dependencies.
export const SB_URL = "https://wceepxckasjmzobbjwpf.supabase.co";
export const SB_KEY = "sb_publishable_F1cA5FIVo5NieSQZ6S4-cg_xn-KtdiW";
const SKEY = "mgh.session.v1";

let session = null;
try { session = JSON.parse(localStorage.getItem(SKEY) || "null"); } catch (e) { session = null; }

function save(s) {
  session = s;
  try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch (e) {}
}

export class ApiError extends Error {
  constructor(msg, status, code) { super(msg); this.status = status; this.code = code; }
}

function friendly(status, body) {
  const raw = (body && (body.msg || body.message || body.error_description || body.error)) || "";
  const code = (body && (body.error_code || body.code)) || "";
  const map = {
    invalid_credentials: "الإيميل أو كلمة المرور غير صحيحة.",
    email_not_confirmed: "حسابك بانتظار موافقة مسؤول الفئة. بعد الموافقة ادخل بنفس الإيميل وكلمة المرور.",
    user_already_exists: "هذا الإيميل مسجّل من قبل. سجّل الدخول أو استخدم «نسيت كلمة المرور».",
    weak_password: "كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.",
    over_email_send_rate_limit: "أُرسلت رسائل كثيرة الآن. انتظر قليلًا ثم حاول.",
    over_request_rate_limit: "محاولات كثيرة. انتظر دقيقة ثم حاول.",
    "42501": "ليس لديك صلاحية لهذا التعديل.",
  };
  if (map[code]) return map[code];
  if (/Invalid login/i.test(raw)) return map.invalid_credentials;
  if (/not confirmed/i.test(raw)) return map.email_not_confirmed;
  if (/already registered/i.test(raw)) return map.user_already_exists;
  if (/row-level security/i.test(raw)) return map["42501"];
  if (status === 0) return "تعذّر الاتصال. تأكد من الإنترنت وحاول مرة ثانية.";
  return raw || "حدث خطأ غير متوقع (" + status + ").";
}

async function raw(path, { method = "GET", body, headers = {}, auth = true } = {}) {
  const h = { apikey: SB_KEY, "Content-Type": "application/json", ...headers };
  if (auth && session && session.access_token) h.Authorization = "Bearer " + session.access_token;
  let res;
  try {
    res = await fetch(SB_URL + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (e) { throw new ApiError(friendly(0), 0); }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) throw new ApiError(friendly(res.status, data), res.status, data && (data.error_code || data.code));
  return data;
}

async function call(path, opts = {}) {
  await ensureFresh();
  try { return await raw(path, opts); }
  catch (e) {
    if (e.status === 401 && session && session.refresh_token) {
      const ok = await refresh();
      if (ok) return raw(path, opts);
    }
    throw e;
  }
}

// ---------- Auth ----------
export const auth = {
  get session() { return session; },
  get userId() { return session && session.user && session.user.id; },
  async signIn(email, password) {
    const d = await raw("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password }, auth: false });
    save(withExpiry(d)); return d;
  },
  async signUp(email, password, full_name, requested_role) {
    const redirect = location.origin + location.pathname;
    return raw("/auth/v1/signup?redirect_to=" + encodeURIComponent(redirect), {
      method: "POST", auth: false,
      body: { email, password, data: { full_name, requested_role }, options: { emailRedirectTo: redirect } },
    });
  },
  async recover(email) {
    const redirect = location.origin + location.pathname + "#reset";
    return raw("/auth/v1/recover?redirect_to=" + encodeURIComponent(redirect), { method: "POST", auth: false, body: { email } });
  },
  async setPassword(password) { return call("/auth/v1/user", { method: "PUT", body: { password } }); },
  async signOut() { try { await raw("/auth/v1/logout", { method: "POST" }); } catch (e) {} save(null); },
  // tokens arriving in the URL hash after email confirmation / password recovery
  consumeHash() {
    const h = location.hash.replace(/^#/, "");
    if (!/access_token=/.test(h)) return null;
    const p = new URLSearchParams(h);
    const s = { access_token: p.get("access_token"), refresh_token: p.get("refresh_token"), expires_in: Number(p.get("expires_in") || 3600) };
    save(withExpiry(s));
    return p.get("type") || "signup";
  },
  async loadUser() {
    if (!session) return null;
    const u = await call("/auth/v1/user");
    session.user = u; save(session); return u;
  },
};

function withExpiry(d) { return { ...d, expires_at: Math.floor(Date.now() / 1000) + Number(d.expires_in || 3600) }; }

let refreshing = null;
async function refresh() {
  if (!session || !session.refresh_token) return false;
  if (!refreshing) {
    refreshing = raw("/auth/v1/token?grant_type=refresh_token", { method: "POST", auth: false, body: { refresh_token: session.refresh_token } })
      .then((d) => { save(withExpiry({ ...session, ...d })); return true; })
      .catch(() => { save(null); return false; })
      .finally(() => { setTimeout(() => (refreshing = null), 0); });
  }
  return refreshing;
}
async function ensureFresh() {
  if (session && session.expires_at && session.expires_at - Date.now() / 1000 < 60) await refresh();
}

// ---------- REST ----------
function qs(params) {
  return Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
}
export const db = {
  select(table, params = {}) { return call("/rest/v1/" + table + "?" + qs({ select: "*", ...params })); },
  insert(table, rows) { return call("/rest/v1/" + table, { method: "POST", body: rows, headers: { Prefer: "return=representation" } }); },
  upsert(table, rows, onConflict) {
    return call("/rest/v1/" + table + (onConflict ? "?on_conflict=" + onConflict : ""), {
      method: "POST", body: rows, headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    });
  },
  update(table, match, patch) { return call("/rest/v1/" + table + "?" + qs(eqs(match)), { method: "PATCH", body: patch, headers: { Prefer: "return=representation" } }); },
  remove(table, match) { return call("/rest/v1/" + table + "?" + qs(eqs(match)), { method: "DELETE", headers: { Prefer: "return=representation" } }); },
  rpc(fn, args = {}) { return call("/rest/v1/rpc/" + fn, { method: "POST", body: args }); },
};
function eqs(match) { const o = {}; for (const k in match) o[k] = "eq." + match[k]; return o; }
