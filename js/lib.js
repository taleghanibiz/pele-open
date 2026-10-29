export const $ = s => document.querySelector(s);
export const projectTag = p => p ? '📁 ' + p : '';
// phone numbers stored as +<country><number> so calls (future PBX) match contacts; Iran is the default country
export function normPhone(raw) {
  const t = String(raw || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  let d = t.replace(/[^\d+]/g, '');
  if (!/\d/.test(d)) return '';
  if (d.startsWith('+')) return '+' + d.slice(1).replace(/\D/g, '');
  if (d.startsWith('00')) return '+' + d.slice(2);
  if (d.startsWith('0')) return '+98' + d.slice(1);
  if (d.length === 10 && d.startsWith('9')) return '+98' + d;
  return '+' + d;
}
export const fa = n => Number(n).toLocaleString('fa-IR', { useGrouping: false });
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

// tiny element builder: h('div', {class: 'x', onclick}, child, 'text')
export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value' || (k in e && typeof v !== 'string')) e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
  return e;
}

export function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3500);
}

// ---------- Jalali (Intl does the conversion) ----------
const jNum = new Intl.DateTimeFormat('en-u-ca-persian', { year: 'numeric', month: 'numeric', day: 'numeric' });
export const jParts = d => Object.fromEntries(jNum.formatToParts(d).filter(p => ['year', 'month', 'day'].includes(p.type)).map(p => [p.type, +p.value]));
export const jDay = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' });
export const jFull = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' });
export const jMonth = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long', year: 'numeric' });
export const WD = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const sameDay = (a, b) => a.toDateString() === b.toDateString();
export const satIndex = d => (d.getDay() + 1) % 7; // Saturday first
export function monthStart(d) { d = startOfDay(d); return addDays(d, 1 - jParts(d).day); }
export function monthLen(start) { let n = 29; while (jParts(addDays(start, n)).day !== 1) n++; return n; }
export const shiftMonth = (start, dir) => monthStart(dir > 0 ? addDays(start, monthLen(start) + 1) : addDays(start, -2));
const pad = n => String(n).padStart(2, '0');
export const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => isoDate(new Date());

export function dueState(due, done, today = todayISO()) {
  if (done) return 'ok';
  if (!due) return '';
  if (due < today) return 'late';
  return due <= isoDate(addDays(parseISO(today), 1)) ? 'soon' : '';
}

// fractional ordering: a = position above, b = position below
export function between(a, b) {
  if (a == null && b == null) return 1024;
  if (a == null) return b - 1024;
  if (b == null) return a + 1024;
  return (a + b) / 2;
}

export function faceColor(email) {
  let n = 0; for (const ch of email) n = (n * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${n} 55% 45%)`;
}

// Jalali date picker. value: Date|null. onPick(Date|null)
export function datePicker(value, onPick, { none = 'بدون تاریخ' } = {}) {
  let shown = monthStart(value || new Date());
  const btn = h('button', { type: 'button', class: 'field dp-btn', 'aria-expanded': 'false' });
  const panel = h('div', { class: 'dp', hidden: true });
  const label = () => btn.replaceChildren(h('span', {}, value ? jFull.format(value) : none), h('span', { 'aria-hidden': 'true' }, '▾'));
  const pick = d => { value = d; label(); panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); onPick(d); };
  function draw() {
    const n = monthLen(shown), today = new Date();
    panel.replaceChildren(
      h('div', { class: 'dp-head' },
        h('button', { type: 'button', class: 'icon', 'aria-label': 'ماه قبل', onclick: () => { shown = shiftMonth(shown, -1); draw(); } }, '›'),
        h('b', {}, jMonth.format(shown)),
        h('button', { type: 'button', class: 'icon', 'aria-label': 'ماه بعد', onclick: () => { shown = shiftMonth(shown, 1); draw(); } }, '‹')),
      h('div', { class: 'dp-grid' },
        WD.map(w => h('span', { class: 'wd' }, w)),
        Array.from({ length: satIndex(shown) }, () => h('span')),
        Array.from({ length: n }, (_, i) => {
          const d = addDays(shown, i);
          return h('button', { type: 'button', class: sameDay(d, today) ? 'today' : null, 'aria-pressed': String(!!value && sameDay(d, value)),
            'aria-label': jFull.format(d), onclick: () => pick(d) }, fa(i + 1));
        })),
      h('div', { class: 'chips' },
        h('button', { type: 'button', class: 'chip', onclick: () => pick(startOfDay(today)) }, 'امروز'),
        h('button', { type: 'button', class: 'chip', onclick: () => pick(addDays(startOfDay(today), 1)) }, 'فردا'),
        h('button', { type: 'button', class: 'chip', onclick: () => pick(addDays(startOfDay(today), 7)) }, 'هفته بعد'),
        h('button', { type: 'button', class: 'chip', onclick: () => pick(null) }, none)));
  }
  btn.onclick = () => { panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', String(!panel.hidden)); if (!panel.hidden) draw(); };
  label();
  return h('div', { class: 'dp-wrap' }, btn, panel);
}

// priority picker: segmented 0..3, onPick(n)
export function priPicker(value, labels, onPick) {
  const seg = h('div', { class: 'seg pri', role: 'radiogroup', 'aria-label': 'اولویت' });
  seg.append(...labels.map((t, n) => h('button', { type: 'button', role: 'radio', 'data-p': n, 'aria-checked': String(n === value),
    onclick: () => { if (n === value) return; value = n; for (const b of seg.children) b.setAttribute('aria-checked', String(b === seg.children[n])); onPick(n); } },
    t || 'بدون')));
  return seg;
}

// in-app text prompt (no window.prompt). Resolves trimmed text or null.
export function ask(label, value = '') {
  return new Promise(resolve => {
    const d = h('dialog', { class: 'ask glass' });
    const input = h('input', { class: 'field', value, 'aria-label': label });
    const done = v => { d.close(); d.remove(); resolve(v); };
    d.append(h('form', { method: 'dialog', onsubmit: e => { e.preventDefault(); done(input.value.trim() || null); } },
      h('label', {}, label), input,
      h('div', { class: 'row' }, h('button', { class: 'btn primary' }, 'تأیید'),
        h('button', { type: 'button', class: 'btn', onclick: () => done(null) }, 'انصراف'))));
    d.addEventListener('cancel', () => done(null));
    document.body.append(d); d.showModal(); input.focus(); input.select();
  });
}
