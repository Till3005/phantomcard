// PhantomCard — edit mode: selection, drag, resize, create (steering §8)
import { store, currentCard, uid } from './store.js';
import { openPropertyInspector, openScriptInspector } from './ui/inspectors.js';

const canvas = () => document.getElementById('card-canvas');

let selFrame = null;
let handles = [];

export function clearSelection() {
  if (selFrame) { selFrame.remove(); selFrame = null; }
  handles.forEach(h => h.remove());
  handles = [];
}

export function drawSelection(obj, cardId) {
  clearSelection();
  const c = canvas();
  selFrame = document.createElement('div');
  selFrame.className = 'sel-frame';
  selFrame.style.left = `${obj.left - 2}px`;
  selFrame.style.top = `${obj.top - 2}px`;
  selFrame.style.width = `${obj.width + 4}px`;
  selFrame.style.height = `${obj.height + 4}px`;
  c.appendChild(selFrame);
  for (const [name, dx, dy] of [
    ['nw', -4, -4], ['n', obj.width / 2 - 3, -4], ['ne', obj.width - 3, -4],
    ['e', obj.width - 3, obj.height / 2 - 3],
    ['se', obj.width - 3, obj.height - 3], ['s', obj.width / 2 - 3, obj.height - 3],
    ['sw', -4, obj.height - 3], ['w', -4, obj.height / 2 - 3],
  ]) {
    const h = document.createElement('div');
    h.className = `sel-handle ${name}`;
    h.style.left = `${obj.left + dx - 1}px`;
    h.style.top = `${obj.top + dy - 1}px`;
    h.addEventListener('mousedown', e => startResize(e, obj, cardId, name));
    c.appendChild(h);
    handles.push(h);
  }
}

function refreshHandles(obj) {
  if (selFrame) {
    selFrame.style.left = `${obj.left - 2}px`;
    selFrame.style.top = `${obj.top - 2}px`;
    selFrame.style.width = `${obj.width + 4}px`;
    selFrame.style.height = `${obj.height + 4}px`;
  }
  const offs = {
    nw: [-4, -4], n: [obj.width / 2 - 3, -4], ne: [obj.width - 3, -4],
    e: [obj.width - 3, obj.height / 2 - 3],
    se: [obj.width - 3, obj.height - 3], s: [obj.width / 2 - 3, obj.height - 3],
    sw: [-4, obj.height - 3], w: [-4, obj.height / 2 - 3],
  };
  for (const h of handles) {
    const name = h.className.match(/sel-handle (\w+)/)[1];
    const [dx, dy] = offs[name];
    h.style.left = `${obj.left + dx - 1}px`;
    h.style.top = `${obj.top + dy - 1}px`;
  }
}

function startResize(e, obj, cardId, edge) {
  e.stopPropagation();
  e.preventDefault();
  const start = { x: e.clientX, y: e.clientY, ...{ left: obj.left, top: obj.top, width: obj.width, height: obj.height } };
  const scale = getScale();
  const el = canvas().querySelector(`[data-oid="${obj.id}"]`);
  const move = ev => {
    const dx = (ev.clientX - start.x) / scale;
    const dy = (ev.clientY - start.y) / scale;
    const p = {};
    if (edge.includes('e')) p.width = Math.max(16, start.width + dx);
    if (edge.includes('s')) p.height = Math.max(12, start.height + dy);
    if (edge.includes('w')) { p.left = Math.min(start.left + start.width - 16, start.left + dx); p.width = start.width + (start.left - p.left); }
    if (edge.includes('n')) { p.top = Math.min(start.top + start.height - 12, start.top + dy); p.height = start.height + (start.top - p.top); }
    Object.assign(obj, p);
    if (el) { el.style.left = `${obj.left}px`; el.style.top = `${obj.top}px`; el.style.width = `${obj.width}px`; el.style.height = `${obj.height}px`; }
    refreshHandles(obj);
  };
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    store.dispatch({ type: 'UPDATE_OBJECT', cardId, objectId: obj.id, patch: { left: obj.left, top: obj.top, width: obj.width, height: obj.height } });
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function getScale() {
  const c = canvas();
  return c.getBoundingClientRect().width / 512;
}

export function onObjectEditMouseDown(obj, e, rerender) {
  e.stopPropagation();
  e.preventDefault();
  const { selectedObjectId } = store.getState();
  if (selectedObjectId !== obj.id) {
    store.dispatch({ type: 'SELECT_OBJECT', id: obj.id });
    drawSelection(obj, obj.cardId);
  }
  // drag to move
  const start = { x: e.clientX, y: e.clientY, left: obj.left, top: obj.top };
  const scale = getScale();
  const el = canvas().querySelector(`[data-oid="${obj.id}"]`);
  let moved = false;
  const move = ev => {
    const dx = (ev.clientX - start.x) / scale;
    const dy = (ev.clientY - start.y) / scale;
    if (!moved && Math.hypot(dx, dy) < 2) return;
    moved = true;
    obj.left = Math.round(start.left + dx);
    obj.top = Math.round(start.top + dy);
    if (el) { el.style.left = `${obj.left}px`; el.style.top = `${obj.top}px`; }
    refreshHandles(obj);
  };
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    if (moved) {
      store.dispatch({ type: 'UPDATE_OBJECT', cardId: obj.cardId, objectId: obj.id, patch: { left: obj.left, top: obj.top } });
    }
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

export function onCanvasEditClick(x, y, e) {
  const { createTool, selectedObjectId } = store.getState();
  if (!createTool) {
    // click empty canvas deselects
    if (selectedObjectId) {
      clearSelection();
      store.dispatch({ type: 'SELECT_OBJECT', id: null });
    }
    return;
  }
  // drag to create object
  const scale = getScale();
  const ghost = document.createElement('div');
  ghost.className = 'create-ghost';
  const c = canvas();
  c.appendChild(ghost);
  const startX = x, startY = y;
  const draw = (cx, cy) => {
    const l = Math.min(startX, cx), t = Math.min(startY, cy);
    const w = Math.abs(cx - startX), h = Math.abs(cy - startY);
    ghost.style.left = `${l}px`; ghost.style.top = `${t}px`;
    ghost.style.width = `${w}px`; ghost.style.height = `${h}px`;
  };
  draw(x, y);
  const move = ev => {
    const r = c.getBoundingClientRect();
    draw((ev.clientX - r.left) / scale, (ev.clientY - r.top) / scale);
  };
  const up = ev => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    ghost.remove();
    const r = c.getBoundingClientRect();
    const cx = (ev.clientX - r.left) / scale, cy = (ev.clientY - r.top) / scale;
    const left = Math.round(Math.min(startX, cx)), top = Math.round(Math.min(startY, cy));
    const width = Math.max(20, Math.round(Math.abs(cx - startX)));
    const height = Math.max(14, Math.round(Math.abs(cy - startY)));
    const card = currentCard();
    const base = { id: uid(createTool), name: defaultName(createTool), left, top, width, height, visible: true, layer: 'card' };
    const obj = createTool === 'button'
      ? { ...base, kind: 'button', style: 'roundRect', showName: true, enabled: true, hilite: false, icon: null, script: 'on mouseUp\n  \nend mouseUp' }
      : createTool === 'field'
        ? { ...base, kind: 'field', style: 'rectangle', text: '', font: 'geneva', size: 12, textAlign: 'left', lockText: false, script: '' }
        : { ...base, kind: 'label', text: 'Label', font: 'geneva', size: 12, textAlign: 'left' };
    store.dispatch({ type: 'ADD_OBJECT', cardId: card.id, object: obj });
    store.dispatch({ type: 'SET_CREATE_TOOL', tool: null });
    store.dispatch({ type: 'SELECT_OBJECT', id: obj.id });
    openPropertyInspector({ ...obj, cardId: card.id }, card.id);
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

function defaultName(kind) {
  return { button: 'New Button', field: 'New Field', label: 'New Label' }[kind] || 'Object';
}

export function deleteSelected() {
  const { selectedObjectId, stack } = store.getState();
  if (!selectedObjectId) return;
  const card = currentCard();
  const cardId = stack.background.objects[selectedObjectId] ? '__bg__' : card.id;
  clearSelection();
  store.dispatch({ type: 'DELETE_OBJECT', cardId, objectId: selectedObjectId });
}

export function openSelectedProps() {
  const { selectedObjectId } = store.getState();
  if (!selectedObjectId) return;
  const card = currentCard();
  const { stack } = store.getState();
  const inBg = !!stack.background.objects[selectedObjectId];
  const obj = inBg ? stack.background.objects[selectedObjectId] : card.objects[selectedObjectId];
  if (obj) openPropertyInspector({ ...obj, cardId: inBg ? '__bg__' : card.id }, inBg ? '__bg__' : card.id);
}
