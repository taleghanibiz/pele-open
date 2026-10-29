import { $, h, fa, WD, addDays, monthStart, monthLen, shiftMonth, satIndex, sameDay, jMonth, isoDate, ask, toast } from './lib.js';
import { sb, S, q, runLoad, isDone } from './state.js';
import { openCard } from './card.js';

let shown = monthStart(new Date());

export function renderCal() {
  const v = $('#view'); v.className = 'cal glass';
  const n = monthLen(shown), today = new Date();
  const byDay = {};
  for (const c of S.cards) if (c.due_date) (byDay[c.due_date] ??= []).push(c);
  v.replaceChildren(
    h('div', { class: 'cal-head' },
      h('button', { class: 'icon', 'aria-label': 'ماه قبل', onclick: () => { shown = shiftMonth(shown, -1); renderCal(); } }, '›'),
      h('b', {}, jMonth.format(shown)),
      h('button', { class: 'icon', 'aria-label': 'ماه بعد', onclick: () => { shown = shiftMonth(shown, 1); renderCal(); } }, '‹')),
    h('div', { class: 'cal-grid' },
      WD.map(w => h('span', { class: 'wd' }, w)),
      Array.from({ length: satIndex(shown) }, () => h('span')),
      Array.from({ length: n }, (_, i) => {
        const d = addDays(shown, i), iso = isoDate(d);
        return h('div', { class: 'day' + (sameDay(d, today) ? ' today' : ''), title: 'برای افزودن جلسه بزنید',
          onclick: e => e.target === e.currentTarget && addMeeting(iso) },
          h('b', {}, fa(i + 1)),
          (byDay[iso] || []).map(c => h('button', { class: 'ev ' + c.kind, title: c.notes ? c.title + '\n\n' + c.notes.slice(0, 400) : c.title, onclick: () => openCard(c.id) },
            (c.kind === 'note' ? '📝 ' : (c.notes ? '📝 ' : '') + (c.kind === 'meeting' ? '🗓 ' : isDone(c) ? '✓ ' : '')) + (c.kind !== 'task' && c.meet_time ? fa(c.meet_time.slice(0, 5)) + ' ' : '') + c.title)));
      })));
}

async function addMeeting(iso) {
  const title = await ask('عنوان جلسه'); if (!title) return;
  try {
    const c = await q(sb.from('cards').insert({ team_id: S.team.id, kind: 'meeting', column_id: null, title: title.slice(0, 200), due_date: iso }).select('*, card_assignees(email), comments(count), attachments(count)').single());
    S.cards.push(c); runLoad();
    openCard(c.id); // set time + people right away
  } catch (e) { toast(e.message); }
}
