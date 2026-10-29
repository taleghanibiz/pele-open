export const env = k => { const v = process.env[k]; if (!v) throw new Error('missing env ' + k); return v; };
export const enc = encodeURIComponent;

export async function db(path, { method = 'GET', body, prefer } = {}) {
  const key = env('SUPABASE_SERVICE_KEY');
  const headers = { apikey: key, 'Content-Type': 'application/json', ...(prefer && { Prefer: prefer }) };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; // legacy JWT keys
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, { method, headers, body: body && JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`db ${method} ${path}: ${r.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function tg(method, params) {
  const r = await fetch(`https://api.telegram.org/bot${env('TELEGRAM_TOKEN')}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
  const j = await r.json().catch(() => ({ ok: false }));
  if (!j.ok) console.error('telegram', method, j.description); // e.g. user blocked the bot — never fatal
  return j;
}

const APP = () => process.env.APP_URL || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
export const openBtn = id => ({ inline_keyboard: [[{ text: 'باز کردن کارت', url: `${APP()}/#card=${id}` }]] });

export const tehranToday = (now = Date.now()) => new Date(now + 3.5 * 36e5).toISOString().slice(0, 10); // Iran: UTC+3:30, no DST
export const addDaysISO = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export async function lastColumns() {
  const cols = await db('columns?select=id,team_id&order=position.desc');
  const m = {}; for (const c of cols) m[c.team_id] ??= c.id; return m;
}

// meeting reminders: Tehran wall time -> UTC ms; which of 24/12/1h is due and not sent yet
export const meetingAt = (date, time) => Date.parse(`${date}T${time.slice(0, 5)}:00+03:30`);
export function reminderStage(at, sent, now = Date.now()) {
  const left = (at - now) / 36e5;
  if (left <= 0) return null;
  const stage = [1, 12, 24].find(h => left <= h);
  return stage && stage < (sent ?? Infinity) ? stage : null;
}
