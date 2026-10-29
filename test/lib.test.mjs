import test from 'node:test';
import assert from 'node:assert/strict';
import { between, dueState, isoDate, jParts, monthStart, monthLen, faceColor, projectTag, normPhone } from '../js/lib.js';

test('between', () => {
  assert.equal(between(null, null), 1024);
  assert.equal(between(null, 1024), 0);
  assert.equal(between(1024, null), 2048);
  assert.equal(between(1024, 2048), 1536);
});
test('dueState', () => {
  assert.equal(dueState(null, false, '2026-10-14'), '');
  assert.equal(dueState('2026-10-10', true, '2026-10-14'), 'ok');
  assert.equal(dueState('2026-10-13', false, '2026-10-14'), 'late');
  assert.equal(dueState('2026-10-15', false, '2026-10-14'), 'soon');
  assert.equal(dueState('2026-10-20', false, '2026-10-14'), '');
});
test('jalali', () => {
  const d = new Date(2026, 9, 14);
  assert.equal(isoDate(d), '2026-10-14');
  assert.deepEqual(jParts(d), { year: 1405, month: 7, day: 22 });
  const s = monthStart(d);
  assert.equal(jParts(s).day, 1);
  assert.equal(monthLen(s), 30); // Mehr has 30 days
});
test('faceColor stable', () => assert.equal(faceColor('a@b.c'), faceColor('a@b.c')));
test('projectTag', () => {
  assert.equal(projectTag(null), '');
  assert.equal(projectTag(''), '');
  assert.equal(projectTag('sanatgar-salam'), '📁 sanatgar-salam');
});
test('normPhone: one canonical form so a future PBX can match callers', () => {
  assert.equal(normPhone('0912 345 6789'), '+989123456789');
  assert.equal(normPhone('۰۹۱۲-۳۴۵-۶۷۸۹'), '+989123456789');
  assert.equal(normPhone('+98 912 345 6789'), '+989123456789');
  assert.equal(normPhone('00989123456789'), '+989123456789');
  assert.equal(normPhone('9123456789'), '+989123456789');
  assert.equal(normPhone('021-8800 1234'), '+982188001234');
  assert.equal(normPhone('+61 412 345 678'), '+61412345678');
  assert.equal(normPhone(''), '');
  assert.equal(normPhone('abc'), '');
});
