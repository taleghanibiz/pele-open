import { db, tg, env, openBtn, tehranToday, addDaysISO, meetingAt, reminderStage } from './_lib.js';

const when = h => h === 1 ? 'یک ساعت دیگر' : h === 12 ? '۱۲ ساعت دیگر' : '۲۴ ساعت دیگر';
const faTime = t => t.slice(0, 5).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

export default async function handler(req, res) {
  if (req.headers['x-webhook-secret'] !== env('WEBHOOK_SECRET')) return res.status(401).end();
  try {
    const today = tehranToday();
    const meetings = await db(`cards?kind=eq.meeting&meet_time=not.is.null&due_date=gte.${today}&due_date=lte.${addDaysISO(today, 2)}&select=id,title,team_id,due_date,meet_time,reminded_h,card_assignees(email)`);
    let sent = 0;
    for (const m of meetings) {
      const stage = reminderStage(meetingAt(m.due_date, m.meet_time), m.reminded_h);
      if (!stage) continue;
      // claim the stage first so overlapping ticks never double-send
      const won = await db(`cards?id=eq.${m.id}&or=(reminded_h.is.null,reminded_h.gt.${stage})`, { method: 'PATCH', body: { reminded_h: stage }, prefer: 'return=representation' });
      if (!won.length) continue;
      let emails = m.card_assignees.map(a => a.email);
      if (!emails.length) emails = (await db(`team_members?team_id=eq.${m.team_id}&select=email`)).map(t => t.email);
      if (!emails.length) continue;
      const chats = await db(`members?email=in.(${emails.map(e => `"${e}"`).join(',')})&telegram_chat_id=not.is.null&select=telegram_chat_id`);
      const day = m.due_date === today ? 'امروز' : m.due_date === addDaysISO(today, 1) ? 'فردا' : 'پس‌فردا';
      for (const c of chats) {
        await tg('sendMessage', { chat_id: c.telegram_chat_id, reply_markup: openBtn(m.id),
          text: `⏰ یادآوری جلسه — ${when(stage)}\n«${m.title}»\n${day} ساعت ${faTime(m.meet_time)}` });
        sent++;
      }
    }
    res.status(200).json({ sent });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
}
