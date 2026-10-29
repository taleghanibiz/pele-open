const fmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', timeZone: 'UTC' });
export const faDate = iso => fmt.format(new Date(iso + 'T12:00:00Z'));

export function parse(text = '') {
  const m = text.trim().match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/);
  return m ? { cmd: m[1].toLowerCase(), arg: m[2].trim() } : { cmd: '', arg: text.trim() };
}

const dueKey = c => c.due_date ?? '9999-12-31';
export function openList(rows, lastCols) {
  return rows.map(r => r.cards).filter(c => c && c.kind === 'task' && c.column_id !== lastCols[c.team_id])
    .sort((a, b) => dueKey(a).localeCompare(dueKey(b)) || a.title.localeCompare(b.title, 'fa') || a.id.localeCompare(b.id));
}

export const listText = cards => cards.length
  ? cards.map((c, i) => `${i + 1}. ${c.title}${c.due_date ? ' — ' + faDate(c.due_date) : ''}`).join('\n')
  : 'کار بازی ندارید 🎉';

export function digestByChat(rows, lastCols, today, tomorrow) {
  const per = new Map();
  for (const r of rows) {
    const chat = r.members?.telegram_chat_id, c = r.cards;
    if (!chat || !c || c.kind !== 'task' || !c.due_date || c.column_id === lastCols[c.team_id]) continue;
    const bucket = c.due_date < today ? 'late' : c.due_date === tomorrow ? 'soon' : null;
    if (!bucket) continue;
    const p = per.get(chat) ?? { late: [], soon: [] };
    p[bucket].push(c); per.set(chat, p);
  }
  const out = new Map();
  for (const [chat, { late, soon }] of per) {
    const lines = ['⏰ یادآوری کارها'];
    if (late.length) lines.push('', 'عقب‌افتاده:', ...late.map(c => `• ${c.title} — ${faDate(c.due_date)}`));
    if (soon.length) lines.push('', 'موعد فردا:', ...soon.map(c => `• ${c.title}`));
    out.set(chat, lines.join('\n'));
  }
  return out;
}
