import { db, tg, env, enc, openBtn } from './_lib.js';

export default async function handler(req, res) {
  if (req.headers['x-webhook-secret'] !== env('WEBHOOK_SECRET')) return res.status(401).end();
  const { table, record: r } = req.body || {};
  try {
    const [card] = await db(`cards?id=eq.${r.card_id}&select=id,title`);
    if (!card) return res.status(200).json({ skipped: 'no card' });
    if (table === 'card_assignees') {
      const [m] = await db(`members?email=eq.${enc(r.email)}&select=telegram_chat_id`);
      const [by] = await db(`members?email=eq.${enc(r.added_by)}&select=name`);
      if (m?.telegram_chat_id) await tg('sendMessage', { chat_id: m.telegram_chat_id,
        text: r.email === r.added_by ? `📌 «${card.title}» به کارهای شما اضافه شد.` : `📌 ${by?.name || r.added_by} شما را به «${card.title}» اضافه کرد.`, reply_markup: openBtn(card.id) });
    }
    if (table === 'comments') {
      const [author] = await db(`members?email=eq.${enc(r.author)}&select=name`);
      const from = author?.name || r.author.split('@')[0];
      const people = await db(`card_assignees?card_id=eq.${r.card_id}&select=email,members(telegram_chat_id)`);
      for (const p of people) if (p.email !== r.author && p.members?.telegram_chat_id)
        await tg('sendMessage', { chat_id: p.members.telegram_chat_id,
          text: `💬 پیام جدید از ${from} در «${card.title}»:\n${r.body.slice(0, 500)}`, reply_markup: openBtn(card.id) });
    }
    if (table === 'card_steps') {
      const steps = await db(`card_steps?card_id=eq.${r.card_id}&done=eq.false&order=position&limit=1&select=title,email,members(telegram_chat_id)`);
      const [by] = await db(`members?email=eq.${enc(r.done_by || '')}&select=name`);
      const next = steps[0], who = by?.name || r.done_by?.split('@')[0] || '';
      if (next?.members?.telegram_chat_id && next.email !== r.done_by)
        await tg('sendMessage', { chat_id: next.members.telegram_chat_id,
          text: `🪜 «${r.title}» در «${card.title}» توسط ${who} انجام شد.\nحالا نوبت شماست: «${next.title}»`, reply_markup: openBtn(card.id) });
    }
    res.status(200).json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
}
