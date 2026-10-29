import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
export const S = { me: null, members: [], teams: [], memberships: [], team: null, columns: [], cards: [], companies: [], contacts: [], cardContacts: [], cust: null, mode: 'board', filter: { q: '', me: false, who: null, due: null, urgent: false } };
export const PRI = ['', 'کم', 'متوسط', 'فوری']; // cards.priority 0..3

export async function q(p) { const { data, error } = await p; if (error) throw new Error(error.message); return data; }
export const doneCol = () => S.columns.at(-1)?.id;
export const isDone = c => c.kind === 'task' && c.column_id === doneCol();
export const nameOf = email => S.members.find(m => m.email === email)?.name || email.split('@')[0];
export const stepsOf = c => (c.card_steps || []).slice().sort((a, b) => a.position - b.position);
export const teamEmails = () => S.memberships.filter(m => m.team_id === S.team?.id).map(m => m.email);

let loader = null;
export const onLoad = fn => { loader = fn; };
export const runLoad = () => loader?.();

// board/list filters (search, mine, person, due)
export function matches(c, today) {
  const f = S.filter, who = c.card_assignees.map(a => a.email);
  if (f.q && !c.title.includes(f.q)) return false;
  if (f.me && !who.includes(S.me.email)) return false;
  if (f.who && !who.includes(f.who)) return false;
  if (f.urgent && c.priority !== 3) return false;
  if (f.due === 'today' && (isDone(c) || c.due_date !== today)) return false;
  if (f.due === 'late' && (isDone(c) || !c.due_date || c.due_date >= today)) return false;
  return true;
}
export const filtering = () => { const f = S.filter; return !!(f.q || f.me || f.who || f.due || f.urgent); };

// unread comments: per-browser count of comments seen on each card
const SEEN = 'seen';
let seen = null;
function loadSeen() { try { seen = JSON.parse(localStorage.getItem(SEEN)); } catch {} return seen; }
export const commentCount = c => c.comments?.[0]?.count || 0;
export function unread(c) {
  if (!seen && !loadSeen()) seen = {};
  // ponytail: a card first met here counts as read, so comments made while you were away on a card you've never seen aren't flagged
  if (!(c.id in seen)) { seen[c.id] = commentCount(c); saveSeen(); return false; }
  return commentCount(c) > seen[c.id];
}
export function markSeen(c) { if (!seen) loadSeen(); seen ??= {}; seen[c.id] = commentCount(c); saveSeen(); }
function saveSeen() { try { localStorage.setItem(SEEN, JSON.stringify(seen)); } catch {} }

let painter = null;
export const onRender = fn => { painter = fn; };
export const rerender = () => painter?.();

// optimistic card update: show it now, write in the background, refetch only if the write fails
export async function saveCard(c, patch) {
  Object.assign(c, patch, { updated_at: new Date().toISOString() });
  rerender();
  const { error } = await sb.from('cards').update(patch).eq('id', c.id);
  if (error) { runLoad(); throw new Error(error.message); }
}
