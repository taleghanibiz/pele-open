import { $, h, toast } from './lib.js';
import { sb, S, q } from './state.js';

const dlg = $('#dlg'), body = $('#dlgBody');

export async function openMembers() {
  await draw();
  if (!dlg.open) dlg.showModal();
}

async function reload() {
  [S.members, S.memberships] = await Promise.all([
    q(sb.from('members').select('email,name,is_admin').order('name')),
    q(sb.from('team_members').select('team_id,email'))]);
}

async function draw() {
  await reload();
  const inTeam = (e, t) => S.memberships.some(m => m.email === e && m.team_id === t);
  const run = fn => async () => { try { await fn(); await draw(); } catch (e) { toast(e.message); } };
  const email = h('input', { class: 'field', type: 'email', placeholder: 'name@gmail.com', dir: 'ltr', required: true });
  const name = h('input', { class: 'field', placeholder: 'نام نمایشی' });
  const teamBoxes = S.teams.filter(t => !t.personal).map(t => h('label', { class: 'chip' }, h('input', { type: 'checkbox', value: t.id, checked: true }), ' ', t.name));

  const board = h('input', { class: 'field', placeholder: 'نام بورد جدید', maxlength: 40, required: true });
  const color = h('input', { class: 'field', type: 'color', value: '#2F80ED', 'aria-label': 'رنگ بورد' });

  body.replaceChildren(
    h('div', { class: 'dhead' }, h('b', { style: 'flex:1;font-size:18px' }, 'اعضا'),
      h('button', { class: 'icon', 'aria-label': 'بستن', onclick: () => dlg.close() }, '×')),
    h('form', { class: 'grid2', onsubmit: e => { e.preventDefault(); run(async () => {
      await q(sb.rpc('create_team', { n: board.value, c: color.value }));
      location.reload(); // ponytail: full reload to pick up the new tab; fine for a rare admin action
    })(); } }, board, color, h('button', { class: 'btn' }, '＋ ساخت بورد')),
    h('form', { class: 'grid2', onsubmit: e => { e.preventDefault(); run(async () => {
      const em = email.value.trim().toLowerCase();
      await q(sb.from('members').insert({ email: em, name: name.value.trim() }));
      const teams = teamBoxes.map(l => l.querySelector('input')).filter(i => i.checked).map(i => +i.value);
      if (teams.length) await q(sb.from('team_members').insert(teams.map(team_id => ({ team_id, email: em }))));
      toast(`${em} اضافه شد. حالا می‌تواند با گوگل وارد شود.`);
    })(); } },
      email, name, h('div', { class: 'chips' }, teamBoxes), h('button', { class: 'btn primary' }, 'افزودن')),
    h('div', {}, S.members.map(m => h('div', { class: 'mrow' },
      h('div', {}, m.name || '—', h('small', {}, m.email)),
      h('div', { class: 'chips' }, S.teams.filter(t => !t.personal).map(t => h('button', { class: 'chip', 'aria-pressed': String(inTeam(m.email, t.id)),
        onclick: run(() => inTeam(m.email, t.id)
          ? q(sb.from('team_members').delete().match({ team_id: t.id, email: m.email }))
          : q(sb.from('team_members').insert({ team_id: t.id, email: m.email }))) }, t.name))),
      h('button', { class: 'chip', 'aria-pressed': String(m.is_admin), disabled: m.email === S.me.email,
        onclick: run(() => q(sb.from('members').update({ is_admin: !m.is_admin }).eq('email', m.email))) }, 'مدیر'),
      m.email === S.me.email ? h('span') : h('button', { class: 'icon', 'aria-label': 'حذف ' + m.email,
        onclick: run(() => q(sb.from('members').delete().eq('email', m.email))) }, '×')))));
}
