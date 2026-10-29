import { $, h, fa, toast, datePicker, priPicker, parseISO, isoDate, between, faceColor, projectTag } from './lib.js';
import { drawCardCustomers } from './contacts.js';
import { sb, S, q, runLoad, isDone, nameOf, teamEmails, markSeen, PRI, saveCard, rerender, stepsOf, doneCol } from './state.js';

const MAX = 50 * 1024 * 1024;
const dlg = $('#dlg'), body = $('#dlgBody');
let cur = null;
const tf = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('close', () => { flushNotes(); cur = null; });
// Ctrl/⌘+Enter: send the comment you're typing, otherwise press the dialog's main button
dlg.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
  e.preventDefault();
  (e.target.closest('#cmts') ? $('#cmts .send') : body.querySelector('.main'))?.click();
});

export async function openCard(id) {
  cur = id;
  if (!S.cards.some(c => c.id === id)) { toast('این کارت پیدا نشد یا به آن دسترسی ندارید.'); return; }
  draw(); markSeen(card());
  if (!dlg.open) dlg.showModal();
}

// owner picker for a step: team members + nobody
const ownerSel = (email, onchange) => h('select', { class: 'field owner', 'aria-label': 'مسئول مرحله', onchange: e => onchange(e.target.value || null) },
  h('option', { value: '' }, 'بدون مسئول'), teamEmails().map(e => h('option', { value: e, selected: e === email }, nameOf(e))));
// a step's owner also becomes a card assignee, so it shows under «کارهای من» and gets the Telegram ping
const addAssignee = (card_id, email) => email && q(sb.from('card_assignees').upsert({ card_id, email }, { ignoreDuplicates: true }));

// new task: pick people, deadline, opinion and files before it's created. process: start with a steps list
export function openNew(col, { process = false, title: t0 = '', note: n0 = '' } = {}) {
  cur = null;
  const steps = process ? [{ title: '', email: null }] : [];
  const stepBox = h('div', { class: 'steps' });
  const drawSteps = focus => {
    stepBox.replaceChildren(...steps.map((s, i) => h('div', { class: 'step' },
      h('span', { class: 'num' }, fa(i + 1)),
      h('input', { class: 'field', value: s.title, placeholder: 'عنوان مرحله', maxlength: 200, 'aria-label': `مرحلهٔ ${fa(i + 1)}`,
        oninput: e => { s.title = e.target.value; },
        onkeydown: e => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); steps.splice(i + 1, 0, { title: '', email: null }); drawSteps(i + 1); } } }),
      ownerSel(s.email, v => { s.email = v; }),
      h('button', { type: 'button', class: 'icon', 'aria-label': 'حذف مرحله', onclick: () => { steps.splice(i, 1); drawSteps(); } }, '×'))),
      h('button', { type: 'button', class: 'chip', onclick: () => { steps.push({ title: '', email: null }); drawSteps(steps.length - 1); } }, '＋ مرحله'));
    if (focus != null) stepBox.children[focus]?.querySelector('input').focus();
  };
  drawSteps();
  const who = new Set([S.me.email]), files = [];
  let due = null, priority = 0;
  const title = h('input', { class: 'field', placeholder: process ? 'عنوان فرایند، مثلاً گرفتن مدرک دانش‌بنیان' : 'عنوان کار', 'aria-label': 'عنوان', maxlength: 200, value: t0.slice(0, 200) });
  const note = h('textarea', { class: 'field', placeholder: 'نظر یا توضیح خود را بنویسید…', maxlength: 4000, value: n0 });
  const people = h('div', { class: 'chips' }, teamEmails().map(email => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(who.has(email)),
    onclick: e => { who.has(email) ? who.delete(email) : who.add(email); e.target.setAttribute('aria-pressed', String(who.has(email))); } },
    nameOf(email))));
  const list = h('div', { class: 'att' });
  const input = h('input', { type: 'file', multiple: true, hidden: true, onchange: e => { files.push(...e.target.files); drawFiles(); e.target.value = ''; } });
  const drawFiles = () => list.replaceChildren(...files.map((f, i) => h('div', { class: 'row' }, '📄 ', f.name,
    h('button', { type: 'button', class: 'icon', 'aria-label': 'حذف ' + f.name, onclick: () => { files.splice(i, 1); drawFiles(); } }, '×'))),
    h('button', { type: 'button', class: 'chip', onclick: () => input.click() }, '📎 افزودن فایل'), input);
  drawFiles();
  const go = h('button', { class: 'btn primary main', title: 'Ctrl+Enter', onclick: async () => {
    const t = title.value.trim(); if (!t) { title.focus(); return toast('عنوان کار را بنویسید.'); }
    go.disabled = true;
    try {
      const last = S.cards.filter(c => c.column_id === col.id).at(-1);
      const c = await q(sb.from('cards').insert({ team_id: S.team.id, column_id: col.id, title: t, position: between(last?.position, null),
        due_date: due ? isoDate(due) : null, priority }).select().single());
      dlg.close();
      const st = steps.filter(s => s.title.trim());
      if (st.length) await q(sb.from('card_steps').insert(st.map((s, i) => ({ card_id: c.id, title: s.title.trim(), email: s.email, position: (i + 1) * 1024 }))));
      for (const s of st) if (s.email) who.add(s.email);
      if (who.size) await q(sb.from('card_assignees').insert([...who].map(email => ({ card_id: c.id, email }))));
      if (note.value.trim()) await q(sb.from('comments').insert({ card_id: c.id, body: note.value.trim() }));
      if (files.length) await upload(files, c); else runLoad();
    } catch (e) { toast(e.message); go.disabled = false; runLoad(); }
  } }, process ? 'ساخت فرایند' : 'ساخت کار');
  body.replaceChildren(
    h('div', { class: 'dhead' }, h('b', {}, process ? 'فرایند جدید' : `کار جدید در «${col.title}»`),
      h('button', { class: 'icon', 'aria-label': 'بستن', onclick: () => dlg.close() }, '×')),
    title,
    process ? h('div', {}, h('span', { class: 'lbl' }, 'مراحل (به ترتیب؛ Enter = مرحلهٔ بعد)'), stepBox) : null,
    h('div', {}, h('span', { class: 'lbl' }, process ? 'افراد دیگر' : 'مسئول'), people),
    h('div', {}, h('span', { class: 'lbl' }, 'موعد'), datePicker(null, d => { due = d; })),
    h('div', {}, h('span', { class: 'lbl' }, 'اولویت'), priPicker(0, PRI, n => { priority = n; })),
    h('div', {}, h('span', { class: 'lbl' }, 'نظر'), note),
    h('div', {}, h('span', { class: 'lbl' }, 'پیوست‌ها (حداکثر ۵۰ مگابایت)'), list),
    h('div', { class: 'row' }, go, h('button', { class: 'btn', onclick: () => dlg.close() }, 'انصراف')));
  if (!dlg.open) dlg.showModal();
  title.focus();
}

// realtime: keep text fields the user may be typing in; refresh the rest
export function refreshOpenCard() {
  if (!dlg.open || !cur) return;
  if (!S.cards.some(c => c.id === cur)) { dlg.close(); toast('این کارت حذف شد.'); return; }
  drawPeople(); drawCardCustomers(card()); drawSteps(); drawAtts(); drawComments(); drawNotesBy(); markSeen(card());
  const ta = $('#notes'); if (ta && document.activeElement !== ta && !pending) ta.value = card().notes;
}

const card = () => S.cards.find(c => c.id === cur);
const save = patch => saveCard(card(), patch).catch(e => toast(e.message));

function draw() {
  const c = card(), meeting = c.kind !== 'task', note = c.kind === 'note';
  let armed = false;
  const del = h('button', { class: 'btn danger', onclick: async () => {
    if (!armed) { armed = true; del.textContent = 'برای حذف دوباره بزنید'; return; }
    try {
      const files = await q(sb.from('attachments').select('path').eq('card_id', c.id));
      if (files.length) await q(sb.storage.from('attachments').remove(files.map(f => f.path)));
      await q(sb.from('cards').delete().eq('id', c.id));
      dlg.close(); runLoad();
    } catch (e) { toast(e.message); }
  } }, note ? 'حذف یادداشت' : meeting ? 'حذف جلسه' : 'حذف کار');

  body.replaceChildren(
    h('div', { class: 'dhead' },
      h('input', { class: 'field', value: c.title, 'aria-label': 'عنوان', maxlength: 200,
        onchange: e => e.target.value.trim() && save({ title: e.target.value.trim() }) }),
      c.project ? h('span', { class: 'proj-tag' }, projectTag(c.project)) : null,
      h('button', { class: 'icon', 'aria-label': 'بستن', onclick: () => dlg.close() }, '×')),
    h('div', { class: 'grid2' },
      meeting ? null : h('div', { class: 'span2' }, h('span', { class: 'lbl' }, 'وضعیت'),
        h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'وضعیت' }, S.columns.map(col => h('button', {
          role: 'radio', 'aria-checked': String(col.id === c.column_id),
          onclick: e => {
            if (col.id === card().column_id) return;
            for (const b of e.currentTarget.parentNode.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
            const last = S.cards.filter(x => x.column_id === col.id).at(-1);
            save({ column_id: col.id, position: between(last?.position, null) });
          } }, col.title)))),
      h('div', {}, h('span', { class: 'lbl' }, note ? 'روز در تقویم (اختیاری)' : meeting ? 'تاریخ جلسه' : 'موعد'),
        datePicker(c.due_date ? parseISO(c.due_date) : null, d => save({ due_date: d ? isoDate(d) : null }))),
      meeting ? h('div', {}, h('span', { class: 'lbl' }, note ? 'ساعت (اختیاری)' : 'ساعت جلسه'),
        h('input', { type: 'time', class: 'field', value: c.meet_time?.slice(0, 5) || '', 'aria-label': 'ساعت جلسه',
          onchange: e => save({ meet_time: e.target.value || null }) })) : null,
      meeting ? null : h('div', { class: 'span2' }, h('span', { class: 'lbl' }, 'اولویت'), priPicker(c.priority, PRI, n => save({ priority: n }))),
      meeting ? null : h('div', {}, h('span', { class: 'lbl', id: 'progLbl' }, `پیشرفت: ${fa(isDone(c) ? 100 : c.progress)}٪`),
        h('input', { type: 'range', min: 0, max: 100, step: 10, value: c.progress, 'aria-labelledby': 'progLbl',
          oninput: e => $('#progLbl').textContent = `پیشرفت: ${fa(e.target.value)}٪`,
          onchange: e => save({ progress: +e.target.value }) }))),
    meeting ? null : h('div', {}, h('span', { class: 'lbl' }, 'مراحل'), h('div', { class: 'steps', id: 'steps' })),
    h('div', {}, h('span', { class: 'lbl' }, 'افراد'), h('div', { class: 'chips', id: 'people' })),
    h('div', {}, h('span', { class: 'lbl' }, 'مشتری'), h('div', { class: 'chips', id: 'custs' })),
    h('div', {}, h('div', { class: 'lbl notes-head' }, h('span', {}, note ? '📝 یادداشت' : '📝 یادداشت جلسه'), h('small', { id: 'notesBy' }),
        h('button', { type: 'button', class: 'chip', title: 'ساعت الان را در یادداشت بگذار', onclick: stamp }, '⏱ ساعت'),
        h('button', { type: 'button', class: 'chip', title: 'متن انتخاب‌شده یا خط فعلی را تسک کن', onclick: noteToTask }, '＋ تسک')),
      h('textarea', { id: 'notes', class: 'field notes', value: c.notes, maxlength: 20000,
        placeholder: 'حین جلسه (حضوری یا آنلاین) بنویسید؛ خودکار ذخیره می‌شود و همه می‌بینند…',
        oninput: e => queueNotes(e.target.value), onblur: flushNotes })),
    note ? null : h('div', {}, h('span', { class: 'lbl' }, 'توضیحات'),
      h('textarea', { class: 'field', value: c.description, onchange: e => save({ description: e.target.value }) })),
    h('div', {}, h('span', { class: 'lbl' }, 'پیوست‌ها (حداکثر ۵۰ مگابایت)'), h('div', { class: 'att', id: 'atts' })),
    h('div', {}, h('span', { class: 'lbl' }, 'گفتگو'), h('div', { id: 'cmts', style: 'display:grid;gap:8px' })),
    h('div', { class: 'row' }, h('button', { class: 'btn primary main', title: 'Ctrl+Enter', onclick: () => {
      // fields save on change; just flush a typed comment and close
      if ($('#cmts textarea')?.value.trim()) $('#cmts .send').click();
      dlg.close();
    } }, note ? 'ثبت یادداشت' : meeting ? 'ثبت جلسه' : 'ثبت تسک'), del));
  drawPeople(); drawCardCustomers(card()); drawSteps(); drawAtts(); drawComments(); drawNotesBy();
}

// meeting notes: save ~1s after typing stops, and on blur/close
// ponytail: last write wins if two people type at once; per-line merge if that bites
let pending = null, timer = 0;
function queueNotes(text) { pending = { c: card(), text }; clearTimeout(timer); timer = setTimeout(flushNotes, 900); }
function flushNotes() {
  clearTimeout(timer); if (!pending) return;
  const { c, text } = pending; pending = null;
  if (text !== c.notes) saveCard(c, { notes: text, notes_by: S.me.email }).then(drawNotesBy, e => toast(e.message));
}
function drawNotesBy() {
  const c = card(), el = $('#notesBy'); if (!el || !c) return;
  el.textContent = c.notes_by && c.notes ? `آخرین ویرایش: ${nameOf(c.notes_by)}` : '';
}
// put "HH:MM — " on a new line at the cursor, handy for minute-by-minute notes
function stamp() {
  const ta = $('#notes'), t = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  const at = ta.selectionStart ?? ta.value.length, before = ta.value.slice(0, at);
  const ins = (before && !before.endsWith('\n') ? '\n' : '') + t + ' — ';
  ta.setRangeText(ins, at, ta.selectionEnd ?? at, 'end'); ta.focus(); queueNotes(ta.value);
}

// action item from the notes: selected text (or the cursor's line) becomes a new task in the first column
function noteToTask() {
  const ta = $('#notes'), c = card(), v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
  let t = v.slice(a, b).trim();
  if (!t) t = v.slice(v.lastIndexOf('\n', a - 1) + 1, (v.indexOf('\n', a) + 1 || v.length + 1) - 1).trim();
  t = t.replace(/^[\d۰-۹]{1,2}:[\d۰-۹]{2}\s*—\s*/, ''); // drop a ⏱ stamp
  if (!S.columns[0]) return toast('ستونی برای تسک نیست.');
  flushNotes();
  openNew(S.columns[0], { title: t, note: `از ${{ meeting: 'جلسهٔ', note: 'یادداشت' }[c.kind] || 'کار'} «${c.title}»` });
}

// step edits: show now, write in the background (used by the card dialog and the process tabs)
const putStep = (s, patch) => { Object.assign(s, patch); drawSteps(); rerender(); return q(sb.from('card_steps').update(patch).eq('id', s.id)).catch(e => { toast(e.message); runLoad(); }); };
// tick/untick a step; progress follows the steps and the card moves to done when all are ticked
export async function toggleStep(c, s) {
  await putStep(s, { done: !s.done, done_by: s.done ? null : S.me.email });
  const st = stepsOf(c), n = st.filter(x => x.done).length, patch = { progress: Math.round(n / st.length * 10) * 10 };
  if (n === st.length && doneCol() && c.column_id !== doneCol()) Object.assign(patch, { column_id: doneCol(), position: between(S.cards.filter(x => x.column_id === doneCol()).at(-1)?.position, null) });
  saveCard(c, patch).catch(e => toast(e.message));
}

// steps of an open card: tick, rename, change owner, add, remove
function drawSteps() {
  const c = card(), box = $('#steps'); if (!box) return;
  if (box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return; // don't wipe typing on realtime refresh
  const st = stepsOf(c), cur = st.find(s => !s.done);
  const put = putStep, tick = s => toggleStep(c, s);
  const add = h('input', { class: 'field', placeholder: '＋ مرحلهٔ جدید (Enter)', maxlength: 200, 'aria-label': 'مرحلهٔ جدید',
    onkeydown: async e => {
      if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return;
      e.preventDefault(); const t = add.value.trim(); if (!t) return;
      add.value = '';
      try { await q(sb.from('card_steps').insert({ card_id: c.id, title: t, position: between(st.at(-1)?.position, null) })); runLoad(); } catch (err) { toast(err.message); }
    } });
  box.replaceChildren(...st.map((s, i) => h('div', { class: 'step' + (s.done ? ' ok' : s === cur ? ' now' : '') },
    h('button', { type: 'button', class: 'tick', role: 'checkbox', 'aria-checked': String(s.done), 'aria-label': `مرحلهٔ ${fa(i + 1)} انجام شد`, onclick: () => tick(s) }),
    h('input', { class: 'field', value: s.title, maxlength: 200, 'aria-label': `مرحلهٔ ${fa(i + 1)}`,
      onchange: e => e.target.value.trim() && put(s, { title: e.target.value.trim() }) }),
    ownerSel(s.email, v => { put(s, { email: v }); addAssignee(c.id, v)?.then(runLoad, e => toast(e.message)); }),
    h('button', { type: 'button', class: 'icon', 'aria-label': 'حذف مرحله', onclick: async () => {
      try { await q(sb.from('card_steps').delete().eq('id', s.id)); runLoad(); } catch (e) { toast(e.message); } } }, '×'))), add);
}

function drawPeople() {
  const c = card(), on = new Set(c.card_assignees.map(a => a.email));
  $('#people')?.replaceChildren(...teamEmails().map(email => h('button', {
    class: 'chip', 'aria-pressed': String(on.has(email)),
    onclick: async () => {
      const had = on.has(email);
      c.card_assignees = had ? c.card_assignees.filter(a => a.email !== email) : [...c.card_assignees, { email }];
      drawPeople(); rerender(); // show it now, sync after
      try {
        if (had) await q(sb.from('card_assignees').delete().match({ card_id: c.id, email }));
        else await q(sb.from('card_assignees').insert({ card_id: c.id, email }));
      } catch (e) { toast(e.message); }
      runLoad();
    } }, nameOf(email))));
}

async function drawAtts() {
  const c = card(), box = $('#atts'); if (!box) return;
  try {
    const rows = await q(sb.from('attachments').select('*').eq('card_id', c.id).order('created_at'));
    const items = await Promise.all(rows.map(async r => {
      const img = r.mime.startsWith('image/');
      const { data } = await sb.storage.from('attachments').createSignedUrl(r.path, 3600, img ? {} : { download: r.name });
      const link = img
        ? h('a', { class: 'thumb', href: data?.signedUrl, target: '_blank', rel: 'noopener', title: r.name }, h('img', { src: data?.signedUrl, alt: r.name, loading: 'lazy' }))
        : h('a', { href: data?.signedUrl, title: r.source || r.name }, '📄 ', r.name.length > 28 ? r.name.slice(0, 26) + '…' : r.name, h('small', {}, ` ${fa((r.size / 1048576).toFixed(1))}MB`));
      return h('div', { class: 'row' }, link, h('button', { class: 'icon', 'aria-label': 'حذف پیوست ' + r.name, onclick: () => removeAtt(r) }, '×'));
    }));
    const input = h('input', { type: 'file', multiple: true, hidden: true, onchange: e => upload([...e.target.files]) });
    box.replaceChildren(...items, h('button', { class: 'chip', onclick: () => input.click() }, '📎 افزودن فایل'), input);
    box.ondragover = e => e.preventDefault();
    box.ondrop = e => { e.preventDefault(); upload([...e.dataTransfer.files]); };
  } catch (e) { toast(e.message); }
}

async function upload(files, c = card()) {
  for (const f of files) {
    if (f.size > MAX) { toast(`«${f.name}» بزرگ‌تر از ۵۰ مگابایت است.`); continue; }
    const ext = (f.name.match(/\.[\w]{1,8}$/) || [''])[0].toLowerCase();
    const path = `${c.team_id}/${c.id}/${crypto.randomUUID()}${ext}`;
    toast(`در حال بارگذاری «${f.name}»…`);
    try {
      await q(sb.storage.from('attachments').upload(path, f, { contentType: f.type || 'application/octet-stream' }));
      const { error } = await sb.from('attachments').insert({ card_id: c.id, path, name: f.name, size: f.size, mime: f.type || '' });
      if (error) { await sb.storage.from('attachments').remove([path]); throw new Error(error.message); }
    } catch (e) { toast(`بارگذاری «${f.name}» نشد: ${e.message}`); }
  }
  runLoad();
}

async function removeAtt(r) {
  try {
    await q(sb.storage.from('attachments').remove([r.path]));
    await q(sb.from('attachments').delete().eq('id', r.id));
    runLoad();
  } catch (e) { toast(e.message); }
}

async function drawComments() {
  const c = card(), box = $('#cmts'); if (!box) return;
  try {
    const rows = await q(sb.from('comments').select('*').eq('card_id', c.id).order('created_at'));
    // keep the comment box across realtime refreshes so a draft isn't wiped
    const ta = box.querySelector('textarea') || h('textarea', { class: 'field', placeholder: 'نظر خود را بنویسید…', maxlength: 4000 });
    const send = box.querySelector('.send') || h('button', { class: 'btn primary send', onclick: async () => {
      const text = ta.value.trim(); if (!text) return;
      send.disabled = true;
      try { await q(sb.from('comments').insert({ card_id: c.id, body: text })); ta.value = ''; runLoad(); }
      catch (e) { toast(e.message); } finally { send.disabled = false; }
    } }, 'ارسال نظر');
    box.replaceChildren(...rows.map(r => h('div', { class: 'cmt' + (r.author === S.me.email ? ' mine' : '') },
      h('span', { class: 'face', style: `background:${faceColor(r.author)}`, 'aria-hidden': 'true' }, nameOf(r.author).slice(0, 1)),
      h('div', { class: 'bub' },
      h('small', {}, h('span', {}, h('b', {}, nameOf(r.author)), ` · ${tf.format(new Date(r.created_at))}`),
        r.author === S.me.email ? h('button', { class: 'icon', 'aria-label': 'حذف نظر', onclick: async () => {
          try { await q(sb.from('comments').delete().eq('id', r.id)); runLoad(); } catch (e) { toast(e.message); }
        } }, '×') : null),
      r.body))), ta, h('div', { class: 'row' }, send));
  } catch (e) { toast(e.message); }
}
