import { db, tg, env, lastColumns, tehranToday, addDaysISO } from './_lib.js';
import { digestByChat } from './_bot.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${env('CRON_SECRET')}`) return res.status(401).end();
  if (!process.env.TELEGRAM_TOKEN) return res.status(200).json({ skipped: 'telegram not set up' });
  try {
    const today = tehranToday(), tomorrow = addDaysISO(today, 1);
    const rows = await db(`card_assignees?select=email,members(telegram_chat_id),cards!inner(id,title,due_date,team_id,column_id,kind)&cards.due_date=lte.${tomorrow}&cards.kind=eq.task`);
    const msgs = digestByChat(rows, await lastColumns(), today, tomorrow);
    for (const [chat_id, text] of msgs) await tg('sendMessage', { chat_id, text });
    res.status(200).json({ sent: msgs.size });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
}
