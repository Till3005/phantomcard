// PhantomCard — property & script inspectors (floating System 7 panels)
import { store, currentCard } from '../store.js';
import { parse } from '../hypertalk/parser.js';
import { dialogs } from './dialogs.js';

const hostEl = () => document.getElementById('inspector-host');

function makeInspector(title, x = 60, y = 60) {
  const el = document.createElement('div');
  el.className = 'inspector mac-window';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.innerHTML = `
    <div class="title-bar">
      <span class="title-bar-close"></span>
      <span class="title-bar-title">${title}</span>
    </div>
    <div class="inspector-body"></div>`;
  el.querySelector('.title-bar-close').addEventListener('click', () => el.remove());
  // drag by title bar
  const bar = el.querySelector('.title-bar');
  bar.addEventListener('mousedown', e => {
    if (e.target.closest('.title-bar-close')) return;
    const sx = e.clientX - el.offsetLeft, sy = e.clientY - el.offsetTop;
    const move = ev => { el.style.left = `${ev.clientX - sx}px`; el.style.top = `${ev.clientY - sy}px`; };
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
    e.preventDefault();
  });
  hostEl().appendChild(el);
  return el;
}

function row(label, inner) {
  const r = document.createElement('div');
  r.className = 'inspector-row';
  const l = document.createElement('label');
  l.textContent = label;
  r.appendChild(l);
  r.appendChild(inner);
  return r;
}

function input(type, value, attrs = {}) {
  const i = document.createElement('input');
  i.type = type;
  i.value = value ?? '';
  Object.assign(i, attrs);
  return i;
}

function select(options, value) {
  const s = document.createElement('select');
  for (const o of options) {
    const op = document.createElement('option');
    op.value = op.textContent = o;
    if (o === value) op.selected = true;
    s.appendChild(op);
  }
  return s;
}

// Where an object lives: cardId '__bg__' for background objects.
function objHost(stack, cardId) {
  return cardId === '__bg__' ? stack.background : stack.cards[cardId];
}

export function openPropertyInspector(obj, cardId) {
  document.querySelectorAll('.inspector.prop').forEach(i => i.remove());
  const el = makeInspector(`${obj.kind} "${obj.name}"`, 120, 90);
  el.classList.add('prop');
  const body = el.querySelector('.inspector-body');
  const patch = {};
  const apply = () => {
    store.dispatch({ type: 'UPDATE_OBJECT', cardId, objectId: obj.id, patch });
    Object.assign(obj, patch);
  };

  const name = input('text', obj.name);
  name.addEventListener('change', () => { patch.name = name.value; apply(); });
  body.appendChild(row('Name', name));

  const pos = document.createElement('div');
  pos.style.display = 'flex'; pos.style.gap = '4px';
  for (const [k, v] of [['left', 'L'], ['top', 'T'], ['width', 'W'], ['height', 'H']]) {
    const f = input('number', obj[k], { min: 0, title: k });
    f.style.width = '52px';
    f.addEventListener('change', () => { patch[k] = Math.max(1, parseInt(f.value) || obj[k]); apply(); });
    const w = document.createElement('span');
    w.style.display = 'flex'; w.style.alignItems = 'center'; w.style.gap = '2px';
    w.append(v, f);
    pos.appendChild(w);
  }
  body.appendChild(row('Rect', pos));

  if (obj.kind === 'button') {
    const style = select(['rectangle', 'roundRect', 'shadow', 'transparent', 'oval', 'checkbox', 'radio'], obj.style || 'roundRect');
    style.addEventListener('change', () => { patch.style = style.value; apply(); });
    body.appendChild(row('Style', style));

    const showName = input('checkbox', null);
    showName.checked = obj.showName !== false;
    showName.addEventListener('change', () => { patch.showName = showName.checked; apply(); });
    body.appendChild(row('Show name', showName));

    const enabled = input('checkbox', null);
    enabled.checked = obj.enabled !== false;
    enabled.addEventListener('change', () => { patch.enabled = enabled.checked; apply(); });
    body.appendChild(row('Enabled', enabled));
  }
  if (obj.kind === 'field') {
    const style = select(['transparent', 'opaque', 'rectangle', 'shadow', 'scrolling'], obj.style || 'rectangle');
    style.addEventListener('change', () => { patch.style = style.value; apply(); });
    body.appendChild(row('Style', style));

    const lock = input('checkbox', null);
    lock.checked = obj.lockText !== false;
    lock.addEventListener('change', () => { patch.lockText = lock.checked; apply(); });
    body.appendChild(row('Lock text', lock));

    const align = select(['left', 'center', 'right'], obj.textAlign || 'left');
    align.addEventListener('change', () => { patch.textAlign = align.value; apply(); });
    body.appendChild(row('Align', align));
  }
  if (obj.kind === 'label') {
    const align = select(['left', 'center', 'right'], obj.textAlign || 'left');
    align.addEventListener('change', () => { patch.textAlign = align.value; apply(); });
    body.appendChild(row('Align', align));
  }
  if (obj.kind === 'field' || obj.kind === 'label') {
    const size = select(['9', '10', '12', '14', '18', '24'], String(obj.size || 12));
    size.addEventListener('change', () => { patch.size = parseInt(size.value); apply(); });
    body.appendChild(row('Size', size));
  }

  const vis = input('checkbox', null);
  vis.checked = obj.visible !== false;
  vis.addEventListener('change', () => { patch.visible = vis.checked; apply(); });
  body.appendChild(row('Visible', vis));

  const btns = document.createElement('div');
  btns.className = 'inspector-btns';
  const scriptBtn = document.createElement('button');
  scriptBtn.textContent = 'Script…';
  scriptBtn.className = 'default';
  scriptBtn.addEventListener('click', () => openScriptInspector('object', obj.id, cardId));
  btns.appendChild(scriptBtn);
  body.appendChild(btns);
}

export function openScriptInspector(target, id, cardId) {
  document.querySelectorAll('.inspector.script-inspector').forEach(i => i.remove());
  const { stack } = store.getState();
  let title, getScript, setScript;
  if (target === 'stack') {
    title = `Stack script — ${stack.name}`;
    getScript = () => stack.script;
    setScript = s => store.dispatch({ type: 'UPDATE_SCRIPT', target: 'stack', id: null, script: s });
  } else if (target === 'card') {
    const card = currentCard();
    title = `Card script — ${card.name}`;
    getScript = () => card.script;
    setScript = s => store.dispatch({ type: 'UPDATE_SCRIPT', target: 'card', id: card.id, script: s });
  } else if (target === 'background') {
    title = 'Background script';
    getScript = () => stack.background.script;
    setScript = s => store.dispatch({ type: 'UPDATE_SCRIPT', target: 'background', id: null, script: s });
  } else {
    const host = objHost(stack, cardId);
    const obj = host.objects[id];
    title = `Script — ${obj.kind} "${obj.name}"`;
    getScript = () => obj.script;
    setScript = s => store.dispatch({ type: 'UPDATE_SCRIPT', target: 'object', id, cardId, script: s });
  }

  const el = makeInspector(title, 90, 70);
  el.classList.add('script-inspector');
  const body = el.querySelector('.inspector-body');
  const ta = document.createElement('textarea');
  ta.value = getScript() || '';
  ta.spellcheck = false;
  ta.placeholder = 'on mouseUp\n  go to next card\nend mouseUp';
  body.appendChild(ta);

  const errs = document.createElement('div');
  errs.className = 'script-errors';
  body.appendChild(errs);

  const btns = document.createElement('div');
  btns.className = 'inspector-btns';
  const save = document.createElement('button');
  save.textContent = 'Save';
  save.className = 'default';
  save.addEventListener('click', () => {
    try {
      if (ta.value.trim()) parse(ta.value); // REQ-061: inline syntax check
      setScript(ta.value);
      errs.className = 'script-errors';
      errs.textContent = 'Saved.';
      setTimeout(() => { if (errs.textContent === 'Saved.') errs.textContent = ''; }, 1500);
    } catch (err) {
      errs.className = 'script-errors err';
      errs.textContent = `Line ${err.line ?? '?'}: ${err.message}`;
    }
  });
  btns.appendChild(save);
  body.appendChild(btns);
  ta.focus();
}

export function openCardInfo() {
  const card = currentCard();
  const el = makeInspector(`Card "${card.name}"`, 140, 100);
  el.classList.add('prop');
  const body = el.querySelector('.inspector-body');

  const name = input('text', card.name);
  name.addEventListener('change', () =>
    store.dispatch({ type: 'UPDATE_CARD', cardId: card.id, patch: { name: name.value } }));
  body.appendChild(row('Name', name));

  const fill = select(['white', 'black'], card.fill);
  fill.addEventListener('change', () =>
    store.dispatch({ type: 'UPDATE_CARD', cardId: card.id, patch: { fill: fill.value } }));
  body.appendChild(row('Fill', fill));

  const btns = document.createElement('div');
  btns.className = 'inspector-btns';
  const scriptBtn = document.createElement('button');
  scriptBtn.textContent = 'Script…';
  scriptBtn.addEventListener('click', () => openScriptInspector('card', card.id));
  const bgBtn = document.createElement('button');
  bgBtn.textContent = 'Bg Script…';
  bgBtn.addEventListener('click', () => openScriptInspector('background', null));
  btns.append(bgBtn, scriptBtn);
  body.appendChild(btns);
}
