import { h } from './lib.js';

// Persian-friendly match: unify ي/ی ك/ک, drop ZWNJ and case
const norm = s => s.toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ');

// Linear-style command menu. items: [{ label, hint?, group?, run }]
export function openPalette(items, placeholder = 'دنبال چه می‌گردید؟ کار، نما، تیم، فیلتر…') {
  document.querySelector('dialog.palette')?.close();
  const d = h('dialog', { class: 'palette glass' });
  const input = h('input', { class: 'pal-in', placeholder, 'aria-label': placeholder, role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'pal-list' });
  const list = h('div', { class: 'pal-list', id: 'pal-list', role: 'listbox' });
  let shown = [], at = 0;
  const done = () => { d.close(); d.remove(); };
  const pick = i => { const it = shown[i]; if (!it) return; done(); it.run?.(); };
  function draw() {
    const qs = norm(input.value.trim()).split(/\s+/).filter(Boolean);
    shown = items.filter(it => qs.every(w => norm(it.label + ' ' + (it.group || '')).includes(w))).slice(0, 60);
    at = Math.min(at, Math.max(shown.length - 1, 0));
    let last = null;
    list.replaceChildren(...shown.flatMap((it, i) => {
      const head = it.group && it.group !== last ? h('div', { class: 'pal-group' }, it.group) : null;
      last = it.group;
      return [head, h('div', { class: 'pal-item', role: 'option', id: 'pal-' + i, 'aria-selected': String(i === at),
        onmousemove: () => { if (at !== i) { at = i; mark(); } }, onclick: () => pick(i) },
        h('span', {}, it.label), it.hint ? h('kbd', {}, it.hint) : null)];
    }).filter(Boolean));
    if (!shown.length) list.append(h('div', { class: 'pal-empty' }, 'چیزی پیدا نشد'));
    mark();
  }
  function mark() {
    list.querySelectorAll('.pal-item').forEach(el => el.setAttribute('aria-selected', String(el.id === 'pal-' + at)));
    input.setAttribute('aria-activedescendant', 'pal-' + at);
    list.querySelector(`#pal-${at}`)?.scrollIntoView({ block: 'nearest' });
  }
  input.oninput = () => { at = 0; draw(); };
  input.onkeydown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); at = (at + 1) % (shown.length || 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); at = (at - 1 + shown.length) % (shown.length || 1); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(at); }
  };
  d.addEventListener('cancel', e => { e.preventDefault(); done(); });
  d.addEventListener('click', e => { if (e.target === d) done(); });
  d.append(input, list);
  document.body.append(d); d.showModal(); input.focus(); draw();
}
