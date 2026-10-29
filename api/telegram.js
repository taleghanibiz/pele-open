import { db, tg, env, enc, openBtn, lastColumns } from './_lib.js';
import { parse, openList, listText } from './_bot.js';

export const MY = '📋 کارهای من';
const KB = { keyboard: [[{ text: MY }]], resize_keyboard: true, is_persistent: true };
const HELP = '/tasks کارهای من\n/new عنوان — کار جدید\n/done شماره — انجام شد';

export default async function handler(req, res) {
  if (req.headers['x-telegram-bot-api-secret-token'] !== env('WEBHOOK_SECRET')) return res.status(401).end();
  const msg = req.body?.message;
  if (!msg?.text || msg.chat?.type !== 'private') return res.status(200).end();
  const chat = msg.chat.id, say = (text, extra = {}) => tg('sendMessage', { chat_id: chat, text, reply_markup: KB, ...extra });
  try {
    const { cmd, arg } = msg.text.trim() === MY ? { cmd: 'tasks', arg: '' } : parse(msg.text);
    if (cmd === 'start' && arg) {
      const [c] = await db(`telegram_codes?code=eq.${enc(arg)}&expires_at=gt.${enc(new Date().toISOString())}&select=email`);
      if (!c) await say('کد نامعتبر یا منقضی است. دوباره در تخته «اتصال تلگرام» را بزنید.');
      else {
        await db(`members?telegram_chat_id=eq.${chat}`, { method: 'PATCH', body: { telegram_chat_id: null } });
        await db(`members?email=eq.${enc(c.email)}`, { method: 'PATCH', body: { telegram_chat_id: chat } });
        await db(`telegram_codes?email=eq.${enc(c.email)}`, { method: 'DELETE' });
        await say('✅ متصل شد. اعلان‌ها از این به بعد اینجا می‌آید.\n\n' + HELP);
      }
      return res.status(200).end();
    }
    const [me] = await db(`members?telegram_chat_id=eq.${chat}&select=email`);
    if (!me) { await say('اول در تخته وظایف دکمه «اتصال تلگرام» را بزنید.'); return res.status(200).end(); }
    const lastCols = await lastColumns();
    const mine = async () => openList(await db(`card_assignees?email=eq.${enc(me.email)}&select=cards(id,title,due_date,team_id,column_id,kind)`), lastCols);

    if (cmd === 'tasks') await say(listText(await mine()));
    else if (cmd === 'new') {
      const [tm] = await db(`team_members?email=eq.${enc(me.email)}&select=team_id&order=team_id&limit=1`);
      if (!arg) await say('مثال: /new تماس با کارفرما');
      else if (!tm) await say('عضو هیچ تیمی نیستید.');
      else {
        const [col] = await db(`columns?team_id=eq.${tm.team_id}&select=id&order=position&limit=1`);
        const [card] = await db('cards', { method: 'POST', prefer: 'return=representation',
          body: { team_id: tm.team_id, column_id: col.id, title: arg.slice(0, 200), position: Date.now() / 1000, created_by: me.email } });
        await db('card_assignees', { method: 'POST', body: { card_id: card.id, email: me.email, added_by: me.email } });
        await say(`➕ «${card.title}» ساخته شد.`, { reply_markup: openBtn(card.id) });
      }
    } else if (cmd === 'done') {
      const c = (await mine())[Number(arg) - 1];
      if (!c) await say('شماره را از /tasks بردارید. مثال: /done 2');
      else {
        await db(`cards?id=eq.${c.id}`, { method: 'PATCH', body: { column_id: lastCols[c.team_id] } });
        await say(`✅ «${c.title}» انجام شد.`);
      }
    } else await say(HELP);
  } catch (e) { console.error(e); await say('خطایی رخ داد، کمی بعد دوباره امتحان کنید.'); }
  res.status(200).end();
}
