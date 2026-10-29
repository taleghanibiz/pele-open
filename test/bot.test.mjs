import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, openList, listText, digestByChat } from '../api/_bot.js';
import { tehranToday, addDaysISO } from '../api/_lib.js';

const lastCols = { 1: 'done1' };
const card = (id, title, due, column_id = 'c1') => ({ id, title, due_date: due, team_id: 1, column_id, kind: 'task' });

test('parse', () => {
  assert.deepEqual(parse('/new  تماس با کارفرما '), { cmd: 'new', arg: 'تماس با کارفرما' });
  assert.deepEqual(parse('/done@MyPeleBot 2'), { cmd: 'done', arg: '2' });
  assert.deepEqual(parse('hello'), { cmd: '', arg: 'hello' });
});
test('openList drops done, sorts by due then title', () => {
  const rows = [{ cards: card('a', 'ب', null) }, { cards: card('b', 'الف', '2026-10-20') }, { cards: card('c', 'x', '2026-10-01', 'done1') }, { cards: null }];
  assert.deepEqual(openList(rows, lastCols).map(c => c.id), ['b', 'a']);
});
test('listText', () => {
  assert.match(listText([card('a', 'کار', null)]), /^1\. کار$/);
  assert.equal(listText([]), 'کار بازی ندارید 🎉');
});
test('digestByChat groups overdue and tomorrow, skips unlinked/done', () => {
  const rows = [
    { email: 'a', members: { telegram_chat_id: 7 }, cards: card('1', 'دیر', '2026-10-10') },
    { email: 'a', members: { telegram_chat_id: 7 }, cards: card('2', 'فردا', '2026-10-15') },
    { email: 'a', members: { telegram_chat_id: 7 }, cards: card('3', 'تمام', '2026-10-10', 'done1') },
    { email: 'b', members: { telegram_chat_id: null }, cards: card('4', 'x', '2026-10-10') },
  ];
  const m = digestByChat(rows, lastCols, '2026-10-14', '2026-10-15');
  assert.equal(m.size, 1);
  const t = m.get(7);
  assert.match(t, /عقب‌افتاده/); assert.match(t, /دیر/); assert.match(t, /فردا/); assert.doesNotMatch(t, /تمام/);
});
test('tehran dates', () => {
  assert.equal(tehranToday(Date.parse('2026-10-14T21:00:00Z')), '2026-10-15'); // 00:30 Tehran
  assert.equal(addDaysISO('2026-10-31', 1), '2026-11-01');
});
