import { $, h, fa, jDay, parseISO, toast, normPhone } from './lib.js';
import { sb, S, q, runLoad, nameOf, isDone } from './state.js';
import { openCard } from './card.js';

// «مشتریان»: companies → people → everything done with them (tasks, notes, files via linked cards).
// S.companies / S.contacts / S.cardContacts are loaded with the board (app.js load()).
const KIND = { note: 'یادداشت', meeting: 'جلسه', task: 'کار' };
const companyOf = p => S.companies.find(c => c.id === p.company_id);
const cardsOf = ids => {
  const set = new Set(S.cardContacts.filter(x => ids.includes(x.contact_id)).map(x => x.card_id));
  return S.cards.filter(c => set.has(c.id)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
};
const peopleOf = co => S.contacts.filter(p => p.company_id === co.id);
const tel = p => p.phone ? h('a', { class: 'tel', href: 'tel:' + p.phone, onclick: e => e.stopPropagation() }, p.phone) : null;
// project names already in use (cards' 📁 tags and other customers) — suggested in «نام پروژه» fields
const projectList = () => h('datalist', { id: 'projList' },
  [...new Set([...S.cards.map(c => c.project), ...S.companies.map(c => c.project), ...S.contacts.map(p => p.project)].filter(Boolean))].sort()
    .map(v => h('option', { value: v })));
const projTag = v => v ? h('span', { class: 'proj-tag' }, '📁 ' + v) : null;
const go = (type, id) => { S.cust = id ? { type, id } : null; renderContacts(); };

export function renderContacts() {
  const v = $('#view'); v.className = 'list-view glass';
  if (S.cust?.type === 'company') return companyPage(S.companies.find(c => c.id === S.cust.id));
  if (S.cust?.type === 'person') return personPage(S.contacts.find(p => p.id === S.cust.id));
  const f = S.filter.q.trim(), hit = s => !f || (s || '').includes(f);
  const pMatch = p => hit(p.name) || hit(p.role) || hit(p.phone) || hit(p.notes) || hit(p.project) || hit(companyOf(p)?.name);
  const cos = S.companies.filter(co => hit(co.name) || hit(co.industry) || hit(co.city) || hit(co.project) || peopleOf(co).some(pMatch))
    .sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  const loose = S.contacts.filter(p => !p.company_id && pMatch(p));
  v.replaceChildren(
    h('div', { class: 'notes-top' }, h('h3', {}, '👥 اطلاعات تماس مشتریان'),
      h('small', { class: 'muted' }, `${fa(S.companies.length)} شرکت · ${fa(S.contacts.length)} نفر`),
      h('span', { style: 'flex:1' }),
      h('button', { class: 'btn', onclick: () => editCompany() }, '＋ شرکت'),
      h('button', { class: 'btn primary', onclick: () => editPerson() }, '＋ شخص')),
    ...(cos.length || loose.length ? [
      ...cos.map(co => h('div', { class: 'lrow cust', tabindex: '0', onclick: () => go('company', co.id), onkeydown: e => e.key === 'Enter' && go('company', co.id) },
        h('div', { class: 'lmain' }, h('p', {}, '🏢 ', co.name, ' ', projTag(co.project)),
          h('small', {}, co.industry ? h('span', {}, co.industry) : null, co.city ? h('span', {}, co.city) : null,
            h('span', {}, `${fa(peopleOf(co).length)} نفر`), h('span', {}, `${fa(cardsOf(peopleOf(co).map(p => p.id)).length)} کار و یادداشت`)),
          h('div', { class: 'people-mini' }, peopleOf(co).map(p => h('span', {}, p.name, p.role ? ` (${p.role})` : '', ' ', tel(p))))))),
      loose.length ? h('h4', { class: 'muted', style: 'margin:14px 4px 4px' }, 'بدون شرکت') : null,
      ...loose.map(personRow)]
      : [h('p', { class: 'empty big' }, f ? 'مشتری‌ای با این جستجو پیدا نشد.' : 'هنوز مشتری‌ای ثبت نشده. با «＋ شرکت» یا «＋ شخص» شروع کنید.')]));
}

const personRow = p => h('div', { class: 'lrow cust', tabindex: '0', onclick: () => go('person', p.id), onkeydown: e => e.key === 'Enter' && go('person', p.id) },
  h('div', { class: 'lmain' }, h('p', {}, '👤 ', p.name, p.role ? h('small', { class: 'muted' }, ` · ${p.role}`) : null, ' ', projTag(p.project || companyOf(p)?.project)),
    h('small', {}, tel(p), p.email ? h('span', { class: 'ltr' }, p.email) : null, h('span', {}, `${fa(cardsOf([p.id]).length)} کار و یادداشت`))));

function timeline(cards) {
  if (!cards.length) return h('p', { class: 'empty' }, 'هنوز کار، جلسه یا یادداشتی به این مشتری وصل نشده. از داخل کارت، در بخش «مشتری» وصلش کنید.');
  return h('div', { class: 'timeline' }, cards.map(c => {
    const col = S.columns.find(x => x.id === c.column_id)?.title;
    const nA = c.attachments?.[0]?.count || 0;
    return h('div', { class: 'lrow', tabindex: '0', onclick: () => openCard(c.id), onkeydown: e => e.key === 'Enter' && openCard(c.id) },
      h('div', { class: 'lmain' }, h('p', {}, c.title),
        h('small', {}, h('span', {}, KIND[c.kind]), col ? h('span', { class: isDone(c) ? 'ok' : null }, col) : null,
          h('span', {}, jDay.format(new Date(c.updated_at))), c.due_date ? h('span', {}, '📅 ' + jDay.format(parseISO(c.due_date))) : null,
          nA ? h('span', {}, '📎' + fa(nA)) : null, c.card_assignees.length ? h('span', {}, c.card_assignees.map(a => nameOf(a.email)).join('، ')) : null),
        c.notes ? h('div', { class: 'snip' }, c.notes.slice(0, 220)) : null));
  }));
}

const back = () => h('button', { class: 'btn', onclick: () => go() }, '→ همه مشتریان');
const field = (label, value, onsave, attrs = {}) => h('label', { class: 'cfield' }, h('span', { class: 'lbl' }, label),
  h(attrs.multiline ? 'textarea' : 'input', { class: 'field', value: value || '', ...attrs, multiline: null, onchange: e => onsave(e.target.value.trim()) }));

function companyPage(co) {
  if (!co) return go();
  const save = patch => q(sb.from('companies').update(patch).eq('id', co.id)).then(() => { Object.assign(co, patch); renderContacts(); }, e => toast(e.message));
  const people = peopleOf(co);
  $('#view').replaceChildren(
    h('div', { class: 'notes-top' }, back(), h('h3', {}, '🏢 ', co.name), h('span', { style: 'flex:1' }),
      h('button', { class: 'btn primary', onclick: () => editPerson({ company_id: co.id }) }, '＋ شخص در این شرکت')),
    h('div', { class: 'cgrid' },
      field('نام شرکت', co.name, v => v && save({ name: v })), field('حوزه', co.industry, v => save({ industry: v })),
      field('شهر', co.city, v => save({ city: v })),
      field('نام پروژه', co.project, v => save({ project: v }), { list: 'projList', class: 'field ltr', placeholder: 'مثلاً sanatgar-salam' }),
      field('یادداشت', co.notes, v => save({ notes: v }), { multiline: true })),
    projectList(),
    h('h4', {}, `افراد (${fa(people.length)})`), ...people.map(personRow),
    h('h4', {}, 'هر کاری که با این شرکت شده'), timeline(cardsOf(people.map(p => p.id))));
}

function personPage(p) {
  if (!p) return go();
  const save = patch => q(sb.from('contacts').update(patch).eq('id', p.id)).then(() => { Object.assign(p, patch); renderContacts(); }, e => toast(e.message));
  const co = companyOf(p);
  $('#view').replaceChildren(
    h('div', { class: 'notes-top' }, back(), h('h3', {}, '👤 ', p.name),
      co ? h('button', { class: 'chip', onclick: () => go('company', co.id) }, '🏢 ' + co.name) : null, h('span', { style: 'flex:1' }),
      h('button', { class: 'btn primary', onclick: () => newCardFor(p) }, '＋ کار برای این مشتری')),
    h('div', { class: 'cgrid' },
      field('نام', p.name, v => v && save({ name: v })), field('سمت', p.role, v => save({ role: v })),
      field('تلفن', p.phone, v => { const n = normPhone(v); if (v && !n) return toast('شماره تلفن نامعتبر است'); save({ phone: n }); }, { inputmode: 'tel', class: 'field ltr' }),
      field('ایمیل', p.email, v => save({ email: v }), { type: 'email', class: 'field ltr' }),
      h('label', { class: 'cfield' }, h('span', { class: 'lbl' }, 'شرکت'), companySelect(p.company_id, id => save({ company_id: id }))),
      field('نام پروژه', p.project, v => save({ project: v }), { list: 'projList', class: 'field ltr', placeholder: co?.project || 'مثلاً sanatgar-salam' }),
      field('یادداشت', p.notes, v => save({ notes: v }), { multiline: true })),
    projectList(),
    h('h4', {}, 'هر کاری که با این شخص شده'), timeline(cardsOf([p.id])),
    h('button', { class: 'btn danger', style: 'margin-top:18px', onclick: async e => {
      if (e.target.dataset.armed !== '1') { e.target.dataset.armed = '1'; e.target.textContent = 'مطمئنید؟ حذف این شخص'; return; }
      try { await q(sb.from('contacts').delete().eq('id', p.id)); await reloadContacts(); go(); } catch (err) { toast(err.message); }
    } }, 'حذف این شخص'));
}

const companySelect = (value, onchange) => h('select', { class: 'field', onchange: e => onchange(e.target.value || null) },
  h('option', { value: '' }, 'بدون شرکت'), S.companies.map(c => h('option', { value: c.id, selected: c.id === value }, c.name)));

// small in-app form (no window.prompt): resolves {field: value} or null
function form(title, fields, extra = null) {
  return new Promise(resolve => {
    const d = h('dialog', { class: 'ask glass' }), inputs = {};
    const done = v => { d.close(); d.remove(); resolve(v); };
    d.append(h('form', { method: 'dialog', onsubmit: e => { e.preventDefault(); done(Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value.trim()]))); } },
      h('label', {}, title),
      ...fields.map(([k, label, el]) => { inputs[k] = el || h('input', { class: 'field', 'aria-label': label, placeholder: label }); return inputs[k]; }),
      extra, h('div', { class: 'row' }, h('button', { class: 'btn primary' }, 'ذخیره'), h('button', { type: 'button', class: 'btn', onclick: () => done(null) }, 'انصراف'))));
    d.addEventListener('cancel', () => done(null));
    document.body.append(d); d.showModal(); Object.values(inputs)[0].focus();
  });
}

async function editCompany() {
  const v = await form('شرکت جدید', [['name', 'نام شرکت'], ['industry', 'حوزه (مثلاً صنایع غذایی)'], ['city', 'شهر'],
    ['project', 'نام پروژه', h('input', { class: 'field ltr', list: 'projList', placeholder: 'نام پروژه', 'aria-label': 'نام پروژه' })]], projectList());
  if (!v?.name) return;
  try {
    const co = await q(sb.from('companies').insert({ team_id: S.team.id, ...v }).select().single());
    S.companies.push(co); go('company', co.id);
  } catch (e) { toast(e.message); }
}

async function editPerson(pre = {}) {
  const sel = companySelect(pre.company_id || null, () => {});
  const v = await form('شخص جدید', [['name', 'نام و نام خانوادگی'], ['role', 'سمت'], ['phone', 'تلفن'], ['email', 'ایمیل'], ['company_id', 'شرکت', sel],
    ['project', 'نام پروژه', h('input', { class: 'field ltr', list: 'projList', placeholder: 'نام پروژه', 'aria-label': 'نام پروژه' })]], projectList());
  if (!v?.name) return null;
  const phone = normPhone(v.phone);
  if (v.phone && !phone) { toast('شماره تلفن نامعتبر است'); return null; }
  try {
    const p = await q(sb.from('contacts').insert({ team_id: S.team.id, name: v.name, role: v.role, phone, email: v.email, company_id: v.company_id || null, project: v.project }).select().single());
    S.contacts.push(p);
    if (S.mode === 'contacts') go('person', p.id);
    return p;
  } catch (e) { toast(e.message); return null; }
}

async function newCardFor(p) {
  const col = S.columns[0]; if (!col) return;
  try {
    const c = await q(sb.from('cards').insert({ team_id: S.team.id, column_id: col.id, title: `پیگیری ${p.name}` })
      .select('*, card_assignees(email), comments(count), attachments(count), card_steps(*)').single());
    await q(sb.from('card_contacts').insert({ card_id: c.id, contact_id: p.id }));
    S.cards.push(c); S.cardContacts.push({ card_id: c.id, contact_id: p.id }); runLoad(); openCard(c.id);
  } catch (e) { toast(e.message); }
}

export async function reloadContacts() {
  const t = S.team;
  const [cos, ppl, links] = await Promise.all([
    q(sb.from('companies').select('*').eq('team_id', t.id)),
    q(sb.from('contacts').select('*').eq('team_id', t.id)),
    q(sb.from('card_contacts').select('card_id, contact_id, contacts!inner(team_id)').eq('contacts.team_id', t.id)),
  ]);
  if (t !== S.team) return;
  S.companies = cos; S.contacts = ppl; S.cardContacts = links.map(({ card_id, contact_id }) => ({ card_id, contact_id }));
}

// the «مشتری» row inside a card: who this task/note is about
export function drawCardCustomers(c) {
  const box = $('#custs'); if (!box || !c) return;
  const linked = S.cardContacts.filter(x => x.card_id === c.id).map(x => S.contacts.find(p => p.id === x.contact_id)).filter(Boolean);
  const unlink = async p => {
    S.cardContacts = S.cardContacts.filter(x => !(x.card_id === c.id && x.contact_id === p.id)); drawCardCustomers(c);
    try { await q(sb.from('card_contacts').delete().match({ card_id: c.id, contact_id: p.id })); } catch (e) { toast(e.message); }
  };
  const link = async p => {
    if (!p || linked.some(x => x.id === p.id)) return;
    S.cardContacts.push({ card_id: c.id, contact_id: p.id }); drawCardCustomers(c);
    try { await q(sb.from('card_contacts').insert({ card_id: c.id, contact_id: p.id })); } catch (e) { toast(e.message); }
  };
  const pick = h('select', { class: 'field', 'aria-label': 'افزودن مشتری', onchange: async e => {
    const v = e.target.value; e.target.value = '';
    if (v === 'new') return link(await editPerson());
    link(S.contacts.find(p => p.id === v));
  } }, h('option', { value: '' }, '＋ مشتری'), h('option', { value: 'new' }, '＋ شخص جدید…'),
    S.contacts.filter(p => !linked.some(x => x.id === p.id)).sort((a, b) => a.name.localeCompare(b.name, 'fa'))
      .map(p => h('option', { value: p.id }, p.name + (companyOf(p) ? ' — ' + companyOf(p).name : ''))));
  box.replaceChildren(...linked.map(p => h('span', { class: 'chip', 'aria-pressed': 'true' },
    h('button', { type: 'button', class: 'linkish', onclick: () => { $('dialog[open]')?.close(); S.mode = 'contacts'; go('person', p.id); document.dispatchEvent(new Event('pele:mode')); } },
      '👤 ' + p.name + (companyOf(p) ? ' · ' + companyOf(p).name : '')),
    h('button', { type: 'button', class: 'icon', 'aria-label': 'برداشتن ' + p.name, onclick: () => unlink(p) }, '×'))), pick);
}
