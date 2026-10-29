import test from 'node:test';
import assert from 'node:assert/strict';
import { meetingAt, reminderStage } from '../api/_lib.js';

test('meetingAt is Tehran time', () => assert.equal(new Date(meetingAt('2026-10-20', '10:00:00')).toISOString(), '2026-10-20T06:30:00.000Z'));
test('reminderStage picks each window once', () => {
  const at = meetingAt('2026-10-20', '10:00'), H = 36e5;
  assert.equal(reminderStage(at, null, at - 30 * H), null);   // too early
  assert.equal(reminderStage(at, null, at - 23 * H), 24);
  assert.equal(reminderStage(at, 24, at - 20 * H), null);     // already sent
  assert.equal(reminderStage(at, 24, at - 11 * H), 12);
  assert.equal(reminderStage(at, 12, at - 0.5 * H), 1);
  assert.equal(reminderStage(at, null, at - 5 * H), 12);      // created late: jump to current window
  assert.equal(reminderStage(at, 1, at - 0.2 * H), null);
  assert.equal(reminderStage(at, null, at + H), null);        // past
});
