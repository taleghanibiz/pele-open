import { $, h, fa, jDay, parseISO, ask, toast } from './lib.js';
import { sb, S, q, runLoad, nameOf } from './state.js';
import { openCard } from './card.js';

const when = c => c.due_date ? '📅 ' + jDay.format(parseISO(c.due_date)) + (c.meet_time ? ' · ' + fa(c.meet_time.slice(0, 5)) : '') : 'بدون تاریخ';
const KIND = { note: 'یادداشت', meeting: 'جلسه', task: 'کار' };

// every note in the team: standalone notes plus meetings/tasks that have notes, newest first
export function renderNotes() {
  const v = $('#view'); v.className = 'list-view glass';
  const f = S.filter.q, list = S.cards.filter(c => (c.kind === 'note' || c.notes) && (!f || c.title.includes(f) || c.notes.includes(f)))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  v.replaceChildren(
    h('div', { class: 'notes-top' }, h('h3', {}, '📝 یادداشت‌ها'), h('button', { class: 'btn primary', onclick: addNote }, '＋ یادداشت جدید')),
    ...(list.length ? list.map(c => h('div', { class: 'lrow', tabindex: '0', onclick: () => openCard(c.id), onkeydown: e => e.key === 'Enter' && openCard(c.id) },
      h('div', { class: 'lmain' }, h('p', {}, c.title),
        h('small', {}, h('span', {}, KIND[c.kind]), h('span', {}, when(c)), c.notes_by ? h('span', {}, nameOf(c.notes_by)) : null),
        c.notes ? h('div', { class: 'snip' }, c.notes.slice(0, 160)) : null)))
      : [h('p', { class: 'empty big' }, 'هنوز یادداشتی نیست. با «یادداشت جدید» شروع کنید.')]));
}

export async function addNote() {
  const title = await ask('عنوان یادداشت (موضوع بحث)'); if (!title) return;
  try {
    const c = await q(sb.from('cards').insert({ team_id: S.team.id, kind: 'note', column_id: null, title: title.slice(0, 200) })
      .select('*, card_assignees(email), comments(count), attachments(count), card_steps(*)').single());
    S.cards.push(c); runLoad();
    await openCard(c.id); $('#notes')?.focus();
  } catch (e) { toast(e.message); }
}
