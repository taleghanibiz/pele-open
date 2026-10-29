import { $, h, fa, store, toast, jFull, jDay, dueState, todayISO, between, faceColor, parseISO, ask, isoDate, addDays, projectTag } from './lib.js';
import { sb, S, q, onLoad, runLoad, isDone, nameOf, teamEmails, matches, filtering, unread, doneCol, PRI, onRender, saveCard, stepsOf } from './state.js';
import { openCard, openNew, refreshOpenCard, toggleStep } from './card.js';
import { renderCal } from './calendar.js';
import { renderNotes, addNote } from './notes.js';
import { renderContacts, reloadContacts } from './contacts.js';
import { openMembers } from './members.js';
import { openPalette } from './palette.js';
import { BOT } from './config.js';

const act = fn => (...a) => fn(...a).catch(e => { toast(e.message); runLoad(); });

// ---------- auth gate ----------
function gate(state, msg = '') {
  $('#app').hidden = true; $('#bottom').hidden = true; $('#gate').hidden = false;
  $('#gate').dataset.state = state;
  $('#gateNote').textContent = msg;
}
$('#signIn').onclick = async () => {
  const b = $('#signIn'); b.disabled = true; b.querySelector('span').textContent = 'در حال انتقال به گوگل…';
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
  if (error) { b.disabled = false; b.querySelector('span').textContent = 'ادامه با گوگل'; toast(error.message); }
};
$('#signOut').onclick = $('#signOutGate').onclick = () => sb.auth.signOut();
$('#retry').onclick = () => { gate('loading'); boot().catch(bootFail); };
const bootFail = e => gate('error', `اتصال برقرار نشد. اینترنت را بررسی کنید و دوباره تلاش کنید.\n(${e.message})`);

let bootId = 0;
async function boot() {
  const id = ++bootId;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return gate('out');
  const email = session.user.email.toLowerCase();
  const [me] = await q(sb.from('members').select('*').eq('email', email));
  if (id !== bootId) return;
  if (!me && await q(sb.rpc('bootstrap'))) return boot(); // first sign-in on a fresh install → admin
  if (!me) return gate('blocked', `حساب \u2066${email}\u2069 هنوز به پله دعوت نشده است. از مدیر بخواهید شما را اضافه کند.`);
  const gname = session.user.user_metadata?.full_name || session.user.user_metadata?.name;
  if (!me.name && gname) { await sb.rpc('claim_name', { n: gname }); me.name = gname.trim().slice(0, 60); }
  [S.members, S.teams, S.memberships] = await Promise.all([
    q(sb.from('members').select('email,name,is_admin').order('name')),
    q(sb.from('teams').select('*').order('id')),
    q(sb.from('team_members').select('team_id,email')),
  ]);
  S.me = me;
  if (!S.teams.length) return gate('blocked', 'هنوز عضو هیچ تیمی نیستید. از مدیر بخواهید شما را به یک تیم اضافه کند.');
  $('#gate').hidden = true; $('#app').hidden = false; $('#bottom').hidden = false;
  $('#today').textContent = jFull.format(new Date());
  $('#hello').textContent = `سلام ${me.name || email.split('@')[0]} 👋`;
  $('#membersBtn').hidden = !me.is_admin;
  $('#tgLink').hidden = !BOT;
  await start();
}
sb.auth.onAuthStateChange(ev => {
  if (ev === 'INITIAL_SESSION' || ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') setTimeout(() => boot().catch(bootFail));
});

// ---------- team + load + realtime ----------
async function start() {
  S.mode = store.get('mode') || 'board';
  const want = +store.get('team');
  await openTeam(S.teams.find(t => t.id === want) || S.teams[0]);
  const m = location.hash.match(/card=([\w-]+)/);
  if (m) { history.replaceState(null, '', location.pathname); openCard(m[1]); }
}

async function openTeam(t) {
  S.team = t; store.set('team', t.id); S.filter.who = null; S.cust = null;
  document.body.style.setProperty('--team', t.color);
  renderTabs();
  await load();
  subscribe();
}

async function load() {
  const t = S.team;
  const [cols, cards] = await Promise.all([
    q(sb.from('columns').select('*').eq('team_id', t.id).order('position')),
    q(sb.from('cards').select('*, card_assignees(email), comments(count), attachments(count), card_steps(*)').eq('team_id', t.id).order('position')),
    reloadContacts(),
  ]);
  if (t !== S.team) return;
  S.columns = cols; S.cards = cards;
  render(); refreshOpenCard();
}
onLoad(() => load().catch(e => toast(e.message)));
onRender(() => animate(() => { S.cards.sort((a, b) => a.position - b.position); render(); }));

// cards glide to their new place when something you did moves them (View Transitions; plain swap where unsupported)
const calm = matchMedia('(prefers-reduced-motion: reduce)');
function animate(fn) {
  if (!document.startViewTransition || calm.matches || document.hidden) return fn();
  document.startViewTransition(fn);
}
const vt = c => `view-transition-name:c-${c.id}`;

// cursor-following glow on cards
$('#view').addEventListener('pointermove', e => {
  const el = e.target.closest('.card'); if (!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`);
});

let ch = null, timer;
function subscribe() {
  if (ch) sb.removeChannel(ch);
  const kick = () => { clearTimeout(timer); timer = setTimeout(runLoad, 300); };
  ch = sb.channel('board');
  for (const table of ['columns', 'cards', 'card_assignees', 'comments', 'attachments', 'card_steps'])
    ch.on('postgres_changes', { event: '*', schema: 'public', table }, kick);
  ch.subscribe();
}

function renderTabs() {
  $('#tabs').replaceChildren(...S.teams.map(t => h('button', {
    class: 'tab', style: `--c:${t.color}`, 'aria-current': String(t.id === S.team?.id),
    onclick: () => t !== S.team && openTeam(t).catch(e => toast(e.message)),
  }, t.name)));
}

// ---------- render ----------
function setMode(m) { S.mode = m; store.set('mode', m); animate(render); }
$('#vBoard').onclick = () => setMode('board');
$('#vCal').onclick = () => setMode('cal');
$('#vList').onclick = () => setMode('list');
$('#vFlow').onclick = () => setMode('flow');
$('#vNotes').onclick = () => setMode('notes');
$('#vContacts').onclick = () => { S.cust = null; setMode('contacts'); };
document.addEventListener('pele:mode', () => setMode(S.mode)); // contacts.js jumps here from a card
$('#membersBtn').onclick = () => openMembers();
$('#bottom').onclick = e => {
  const go = e.target.closest('button')?.dataset.go;
  if (go === 'add') S.mode === 'flow' ? newFlow() : S.mode === 'notes' ? addNote() : quickAdd(); else if (go) setMode(go);
};

export function render() {
  for (const [id, m] of [['#vBoard', 'board'], ['#vList', 'list'], ['#vCal', 'cal'], ['#vFlow', 'flow'], ['#vNotes', 'notes'], ['#vContacts', 'contacts']]) $(id).setAttribute('aria-pressed', String(S.mode === m));
  for (const b of $('#bottom').querySelectorAll('[data-go]')) b.toggleAttribute('data-on', b.dataset.go === S.mode);
  renderFilters();
  $('#colTabs').hidden = S.mode !== 'board';
  S.mode === 'cal' ? renderCal() : S.mode === 'list' ? renderList() : S.mode === 'flow' ? renderFlow() : S.mode === 'notes' ? renderNotes() : S.mode === 'contacts' ? renderContacts() : renderBoard();
}

// ---------- filters: search, mine, person, today/late ----------
const search = h('input', { type: 'search', class: 'search', placeholder: 'جستجو در کارها…', 'aria-label': 'جستجو',
  oninput: e => { S.filter.q = e.target.value.trim(); render(); } });
const setF = patch => { Object.assign(S.filter, patch); render(); };

function renderFilters() {
  const f = S.filter, today = todayISO(), week = Date.now() - 7 * 864e5;
  const tasks = S.cards.filter(c => c.kind === 'task'), open = tasks.filter(c => !isDone(c));
  const nToday = open.filter(c => c.due_date === today).length, nLate = open.filter(c => c.due_date && c.due_date < today).length;
  const nWeek = tasks.filter(c => isDone(c) && Date.parse(c.updated_at) > week).length;
  const chip = (label, on, onclick, cls = '') => h('button', { class: 'fchip ' + cls, 'aria-pressed': String(!!on), onclick }, label);
  $('#filters').replaceChildren(search,
    chip('کارهای من', f.me, () => setF({ me: !f.me, who: null })),
    chip(['فوری ', h('b', {}, fa(open.filter(c => c.priority === 3).length))], f.urgent, () => setF({ urgent: !f.urgent }), 'urgent'),
    chip(['امروز ', h('b', {}, fa(nToday))], f.due === 'today', () => setF({ due: f.due === 'today' ? null : 'today' })),
    chip(['عقب‌افتاده ', h('b', {}, fa(nLate))], f.due === 'late', () => setF({ due: f.due === 'late' ? null : 'late' }), nLate ? 'late' : ''),
    h('div', { class: 'who' }, teamEmails().filter(e => e !== S.me.email).map(e => h('button', {
      class: 'face', style: `background:${faceColor(e)}`, title: nameOf(e), 'aria-label': 'کارهای ' + nameOf(e), 'aria-pressed': String(f.who === e),
      onclick: () => setF({ who: f.who === e ? null : e, me: false }) }, nameOf(e).slice(0, 1)))),
    filtering() ? chip('پاک کردن فیلترها', false, () => { search.value = ''; setF({ q: '', me: false, who: null, due: null, urgent: false }); }, 'clear')
      : h('span', { class: 'week' }, `✓ ${fa(nWeek)} کار این هفته`));
}

const count = rel => rel?.[0]?.count || 0;
export function faces(emails) {
  return h('div', { class: 'faces' }, emails.slice(0, 4).map(e =>
    h('span', { class: 'face', title: nameOf(e), style: `background:${faceColor(e)}` }, nameOf(e).slice(0, 1))));
}

function renderBoard() {
  const v = $('#view'), keep = v.className === 'board' ? v.scrollLeft : 0;
  v.className = 'board';
  v.replaceChildren(...S.columns.map(renderCol), renderNewCol());
  v.scrollLeft = keep;
  // phone: tabs show which column you're on and jump between them (drag doesn't work on touch)
  const tabs = S.columns.map((col, i) => h('button', { onclick: () => v.children[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }) },
    col.title, h('b', {}, fa(S.cards.filter(c => c.kind === 'task' && c.column_id === col.id && matches(c, todayISO())).length))));
  $('#colTabs').replaceChildren(...tabs);
  const mark = () => {
    const w = v.children[0]?.offsetWidth + 10 || 1, i = Math.min(tabs.length - 1, Math.round(Math.abs(v.scrollLeft) / w));
    tabs.forEach((t, j) => t.setAttribute('aria-current', String(i === j)));
  };
  v.onscroll = mark; mark();
}

function renderCol(col) {
  const today = todayISO();
  const all = S.cards.filter(c => c.kind === 'task' && c.column_id === col.id), cards = all.filter(c => matches(c, today));
  const list = h('div', { class: 'list', 'data-col': col.id,
    ondragover: e => { e.preventDefault(); list.classList.add('over'); },
    ondragleave: () => list.classList.remove('over'),
    ondrop: e => drop(e, col, list) }, cards.map(renderCard));
  return h('section', { class: 'col glass' },
    h('header', {},
      h('h3', { title: 'برای تغییر نام دوبار بزنید', ondblclick: () => renameCol(col) }, col.title),
      h('span', { class: 'count' }, filtering() ? `${fa(cards.length)}/${fa(all.length)}` : fa(all.length)),
      h('button', { class: 'icon x', 'aria-label': 'حذف ستون', onclick: () => delCol(col, all.length) }, '×')),
    list,
    cards.length || all.length ? null : h('p', { class: 'empty' }, 'کاری اینجا نیست'),
    h('button', { class: 'add', onclick: () => addCard(col) }, '＋ کار جدید'));
}

function renderCard(c) {
  const done = isDone(c);
  const nA = count(c.attachments), nC = count(c.comments), fresh = unread(c), st = stepsOf(c);
  return h('article', { class: 'card' + (done ? ' done' : ''), style: vt(c), draggable: 'true', 'data-id': c.id, tabindex: '0',
    ondragstart: e => { e.dataTransfer.setData('text/card', c.id); e.dataTransfer.effectAllowed = 'move'; e.currentTarget.classList.add('dragging'); },
    ondragend: e => e.currentTarget.classList.remove('dragging'),
    onclick: () => openCard(c.id),
    onkeydown: e => e.key === 'Enter' && openCard(c.id) },
    c.priority ? h('span', { class: 'pri-tag', 'data-p': c.priority }, PRI[c.priority]) : null,
    c.project ? h('span', { class: 'proj-tag' }, projectTag(c.project)) : null,
    h('p', {}, c.title),
    h('div', { class: 'prog' }, h('div', { style: `width:${done ? 100 : c.progress}%` })),
    h('div', { class: 'meta' },
      h('span', { class: 'due ' + dueState(c.due_date, done) }, c.due_date ? jDay.format(parseISO(c.due_date)) : ''),
      h('span', { class: 'counts' }, st.length ? '🪜' + fa(st.filter(s => s.done).length) + '/' + fa(st.length) : '', c.notes ? h('span', { title: 'یادداشت جلسه دارد' }, '📝') : '', nA ? '📎' + fa(nA) : '', nC ? h('span', { class: fresh ? 'new' : null, title: fresh ? 'پیام تازه' : null }, '💬' + fa(nC)) : ''),
      faces(c.card_assignees.map(a => a.email))));
}

// ---------- processes: one tab per main task; the tab shows its steps, each with its own owner ----------
function renderFlow() {
  const v = $('#view'); v.className = 'list-view glass';
  const today = todayISO();
  const flows = S.cards.filter(c => c.kind === 'task' && c.card_steps?.length && matches(c, today))
    .sort((a, b) => isDone(a) - isDone(b) || b.priority - a.priority);
  const c = flows.find(f => f.id === store.get('flow')) || flows[0];
  const tabs = h('nav', { class: 'ftabs', 'aria-label': 'فرایندها' },
    flows.map(f => { const st = stepsOf(f);
      return h('button', { class: 'tab' + (isDone(f) ? ' done' : ''), style: '--c:var(--team)', 'aria-current': String(f === c), onclick: () => { store.set('flow', f.id); render(); } },
        f.title, h('small', {}, `${fa(st.filter(s => s.done).length)}/${fa(st.length)}`)); }),
    h('button', { class: 'tab add-flow', onclick: newFlow }, '＋ فرایند جدید'));
  if (!c) return v.replaceChildren(tabs, h('p', { class: 'empty big' }, filtering() ? 'با این فیلتر فرایندی پیدا نشد.' : 'هنوز فرایندی نیست. مثلاً «گرفتن مدرک دانش‌بنیان» را با مراحلش بسازید؛ هر مرحله یک مسئول دارد.'));
  const st = stepsOf(c), cur = st.find(s => !s.done), n = st.filter(s => s.done).length;
  v.replaceChildren(tabs,
    h('div', { class: 'flow-head' },
      h('h2', {}, c.priority ? h('span', { class: 'pri-tag', 'data-p': c.priority }, PRI[c.priority]) : null, c.title),
      c.due_date ? h('span', { class: 'due ' + dueState(c.due_date, isDone(c)) }, jDay.format(parseISO(c.due_date))) : null,
      h('button', { class: 'btn', onclick: () => openCard(c.id) }, 'ویرایش و گفتگو')),
    h('div', { class: 'prog' }, h('div', { style: `width:${Math.round(n / st.length * 100)}%` })),
    h('ol', { class: 'fsteps' }, st.map((s, i) => h('li', { class: s.done ? 'ok' : s === cur ? 'now' : '', 'data-id': c.id },
      h('button', { class: 'tick', role: 'checkbox', 'aria-checked': String(s.done), 'aria-label': `مرحلهٔ ${fa(i + 1)} انجام شد`, onclick: () => toggleStep(c, s) }),
      h('div', { class: 'fmain' }, h('small', {}, `مرحلهٔ ${fa(i + 1)}`), h('p', {}, s.title)),
      h('span', { class: 'fstate' }, s.done ? 'انجام شد' : s === cur ? 'نوبت این مرحله' : 'در انتظار'),
      h('span', { class: 'fwho' }, s.email ? [h('span', { class: 'face', style: `background:${faceColor(s.email)}` }, nameOf(s.email).slice(0, 1)), nameOf(s.email)] : 'بدون مسئول')))));
}

// ---------- list: open tasks grouped by deadline, tick to finish ----------
function renderList() {
  const v = $('#view'); v.className = 'list-view glass';
  const today = todayISO(), tmr = isoDate(addDays(parseISO(today), 1)), wk = isoDate(addDays(parseISO(today), 7));
  const tasks = S.cards.filter(c => c.kind === 'task' && matches(c, today));
  const groups = [['عقب‌افتاده', c => c.due_date < today, 'late'], ['امروز', c => c.due_date === today], ['فردا', c => c.due_date === tmr],
    ['تا یک هفته', c => c.due_date <= wk], ['بعداً', c => true], ['بدون موعد', c => true]];
  const open = tasks.filter(c => !isDone(c)), buckets = groups.map(() => []);
  open.sort((a, b) => b.priority - a.priority || (a.due_date || '9').localeCompare(b.due_date || '9'));
  for (const c of open) buckets[c.due_date ? groups.findIndex(([, f], i) => i < 5 && f(c)) : 5].push(c);
  const done = tasks.filter(isDone).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 15);
  const sec = (title, list, cls = '') => list.length ? h('section', { class: 'grp ' + cls },
    h('h3', {}, title, h('span', { class: 'count' }, fa(list.length))), list.map(row)) : null;
  const body = [...groups.map(([t, , cls], i) => sec(t, buckets[i], cls)), sec('انجام‌شده اخیر', done, 'muted')].filter(Boolean);
  v.replaceChildren(...(body.length ? body : [h('p', { class: 'empty big' }, filtering() ? 'با این فیلتر کاری پیدا نشد.' : 'هیچ کاری نیست. با ＋ اولین کار را بسازید.')]));
}

function row(c) {
  const done = isDone(c), col = S.columns.find(x => x.id === c.column_id), nC = count(c.comments);
  const tick = h('button', { class: 'tick', role: 'checkbox', 'aria-checked': String(done), 'aria-label': done ? 'برگرداندن به کارهای باز' : 'انجام شد',
    onclick: e => { e.stopPropagation(); toggleDone(c, e.currentTarget.closest('.lrow')); } });
  return h('div', { class: 'lrow' + (done ? ' done' : ''), style: vt(c), 'data-id': c.id, tabindex: '0', onclick: () => openCard(c.id), onkeydown: e => e.key === 'Enter' && e.target === e.currentTarget && openCard(c.id) },
    tick,
    h('div', { class: 'lmain' }, h('p', {}, c.priority ? h('span', { class: 'pri-tag', 'data-p': c.priority }, PRI[c.priority]) : null, c.title, c.project ? h('span', { class: 'proj-tag' }, projectTag(c.project)) : null),
      h('small', {}, col ? h('span', { class: 'colname' }, col.title) : null,
        c.due_date ? h('span', { class: 'due ' + dueState(c.due_date, done) }, jDay.format(parseISO(c.due_date))) : null,
        c.notes ? h('span', { title: 'یادداشت جلسه دارد' }, '📝') : null,
        nC ? h('span', { class: unread(c) ? 'new' : null }, '💬' + fa(nC)) : null)),
    faces(c.card_assignees.map(a => a.email)));
}

const toggleDone = act(async (c, el) => {
  const to = isDone(c) ? S.columns[0].id : doneCol(); if (!to || to === c.column_id) return;
  const last = S.cards.filter(x => x.column_id === to).at(-1);
  const patch = { column_id: to, position: between(last?.position, null) };
  el?.classList.add('finishing');
  await q(sb.from('cards').update(patch).eq('id', c.id));
  Object.assign(c, patch, { updated_at: new Date().toISOString() });
  setTimeout(() => animate(render), calm.matches ? 0 : 420);
});

function renderNewCol() {
  return h('div', { class: 'newcol' }, h('button', { class: 'add glass col', onclick: async () => {
    const title = await ask('نام ستون جدید'); if (!title) return;
    await q(sb.from('columns').insert({ team_id: S.team.id, title: title.slice(0, 60), position: between(S.columns.at(-1)?.position, null) }));
    runLoad();
  } }, '＋ ستون'));
}

// ---------- actions ----------

const renameCol = act(async col => {
  const title = await ask('نام ستون', col.title); if (!title || title === col.title) return;
  await q(sb.from('columns').update({ title: title.slice(0, 60) }).eq('id', col.id)); runLoad();
});

const delCol = act(async (col, n) => {
  if (n) return toast('اول کارهای این ستون را جابه‌جا یا حذف کنید.');
  if (S.columns.length <= 1) return toast('حداقل یک ستون لازم است.');
  await q(sb.from('columns').delete().eq('id', col.id)); runLoad();
});

const addCard = openNew;
const quickAdd = () => S.columns[0] && addCard(S.columns[0]);
const newFlow = () => S.columns[0] && openNew(S.columns[0], { process: true });

// ---------- Linear-style keyboard: Ctrl+K menu, C new, / search, S P A D on the task under the mouse ----------
const KEYS = [['Ctrl K', 'منوی فرمان و جستجو'], ['C', 'کار جدید'], ['/', 'جستجو در کارها'], ['S', 'تغییر وضعیت کار'], ['P', 'اولویت کار'],
  ['A', 'مسئول کار'], ['D', 'موعد کار'], ['Enter', 'باز کردن کار'], ['Ctrl Enter', 'ثبت فرم یا ارسال پیام'], ['?', 'همین فهرست']];
const showKeys = () => openPalette(KEYS.map(([k, t]) => ({ label: t, hint: k })), 'میانبرهای صفحه‌کلید');

let hovered = null;
document.addEventListener('mouseover', e => { hovered = e.target.closest('[data-id]')?.dataset.id ?? null; });
const target = () => S.cards.find(c => c.id === (document.activeElement?.closest?.('[data-id]')?.dataset.id || hovered));
const upd = (c, patch) => saveCard(c, patch).catch(e => toast(e.message));

function pickStatus(c) {
  openPalette(S.columns.map(col => ({ label: col.title, hint: col.id === c.column_id ? '✓' : '',
    run: () => col.id !== c.column_id && upd(c, { column_id: col.id, position: between(S.cards.filter(x => x.column_id === col.id).at(-1)?.position, null) }) })),
    `وضعیت «${c.title}»`);
}
const pickPriority = c => openPalette([3, 2, 1, 0].map(n => ({ label: PRI[n] || 'بدون اولویت', hint: n === c.priority ? '✓' : '', run: () => upd(c, { priority: n }) })), `اولویت «${c.title}»`);
function pickPeople(c) {
  const on = new Set(c.card_assignees.map(a => a.email));
  openPalette(teamEmails().map(email => ({ label: nameOf(email), hint: on.has(email) ? '✓' : '', run: act(async () => {
    c.card_assignees = on.has(email) ? c.card_assignees.filter(a => a.email !== email) : [...c.card_assignees, { email }]; render();
    await q(on.has(email) ? sb.from('card_assignees').delete().match({ card_id: c.id, email }) : sb.from('card_assignees').insert({ card_id: c.id, email }));
  }) })), `مسئول «${c.title}»`);
}
function pickDue(c) {
  const t = parseISO(todayISO()), opt = [['امروز', 0], ['فردا', 1], ['پس‌فردا', 2], ['هفته بعد', 7], ['دو هفته بعد', 14]];
  openPalette([...opt.map(([label, n]) => ({ label, hint: jDay.format(addDays(t, n)), run: () => upd(c, { due_date: isoDate(addDays(t, n)) }) })),
    { label: 'بدون موعد', run: () => upd(c, { due_date: null }) }], `موعد «${c.title}»`);
}

function commandMenu() {
  const f = S.filter, view = (label, m) => ({ group: 'نما', label, run: () => setMode(m) });
  openPalette([
    { group: 'فرمان‌ها', label: 'کار جدید', hint: 'C', run: quickAdd },
    { group: 'فرمان‌ها', label: 'فرایند جدید (کار چندمرحله‌ای)', run: newFlow },
    { group: 'فرمان‌ها', label: 'یادداشت جدید', run: addNote },
    { group: 'فرمان‌ها', label: 'میانبرهای صفحه‌کلید', hint: '?', run: showKeys },
    view('نمای تخته', 'board'), view('نمای فهرست', 'list'), view('نمای تقویم', 'cal'), view('نمای فرایندها', 'flow'), view('نمای یادداشت‌ها', 'notes'), view('مشتریان', 'contacts'),
    { group: 'فیلتر', label: 'کارهای من', hint: f.me ? '✓' : '', run: () => setF({ me: !f.me, who: null }) },
    { group: 'فیلتر', label: 'کارهای فوری', hint: f.urgent ? '✓' : '', run: () => setF({ urgent: !f.urgent }) },
    { group: 'فیلتر', label: 'کارهای امروز', run: () => setF({ due: 'today' }) },
    { group: 'فیلتر', label: 'کارهای عقب‌افتاده', run: () => setF({ due: 'late' }) },
    ...(filtering() ? [{ group: 'فیلتر', label: 'پاک کردن فیلترها', run: () => { search.value = ''; setF({ q: '', me: false, who: null, due: null, urgent: false }); } }] : []),
    ...S.teams.filter(t => t !== S.team).map(t => ({ group: 'تیم', label: 'رفتن به تیم ' + t.name, run: () => openTeam(t).catch(e => toast(e.message)) })),
    ...S.cards.map(c => ({ group: 'کارها', label: c.title, hint: c.kind === 'meeting' ? 'جلسه' : c.kind === 'note' ? 'یادداشت' : S.columns.find(x => x.id === c.column_id)?.title, run: () => openCard(c.id) })),
  ]);
}
$('#cmdBtn').onclick = commandMenu;

document.addEventListener('keydown', e => {
  if ($('#app').hidden) return;
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') { e.preventDefault(); return commandMenu(); }
  if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  // e.code = physical key, so shortcuts work on a Persian layout too
  const c = target(), task = c?.kind === 'task';
  const run = fn => { e.preventDefault(); fn(); };
  if (e.code === 'Slash' && e.shiftKey) run(showKeys);
  else if (e.code === 'Slash') run(() => search.focus());
  else if (e.code === 'KeyC' || e.code === 'KeyN') run(quickAdd);
  else if (e.code === 'KeyS' && task) run(() => pickStatus(c));
  else if (e.code === 'KeyP' && task) run(() => pickPriority(c));
  else if (e.code === 'KeyA' && c) run(() => pickPeople(c));
  else if (e.code === 'KeyD' && c) run(() => pickDue(c));
});

const drop = act(async (e, col, list) => {
  e.preventDefault(); list.classList.remove('over');
  const id = e.dataTransfer.getData('text/card'); if (!id) return;
  const els = [...list.children].filter(x => x.dataset.id !== id);
  let i = els.findIndex(x => e.clientY < x.getBoundingClientRect().top + x.offsetHeight / 2);
  if (i < 0) i = els.length;
  const pos = id => S.cards.find(c => c.id === id)?.position;
  const position = between(i > 0 ? pos(els[i - 1].dataset.id) : null, i < els.length ? pos(els[i].dataset.id) : null);
  const card = S.cards.find(c => c.id === id);
  Object.assign(card, { column_id: col.id, position });
  animate(() => { S.cards.sort((a, b) => a.position - b.position); render(); });
  await q(sb.from('cards').update({ column_id: col.id, position }).eq('id', id));
});

$('#tgLink').onclick = act(async () => {
  const code = crypto.randomUUID().replaceAll('-', '').slice(0, 20);
  await q(sb.from('telegram_codes').insert({ code }));
  window.open(`https://t.me/${BOT}?start=${code}`, '_blank', 'noopener');
});
