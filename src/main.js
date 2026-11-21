// PhantomCard — bootstrap, routing, event wiring (design §1)
import { store, currentCard, uid } from './store.js';
import { renderCard } from './renderer.js';
import { audio } from './audio.js';
import { dialogs } from './ui/dialogs.js';
import { initMenus, showMenu } from './ui/menus.js';
import { openPropertyInspector, openScriptInspector, openCardInfo } from './ui/inspectors.js';
import { onObjectEditMouseDown, onCanvasEditClick, drawSelection, clearSelection, deleteSelected, openSelectedProps } from './editor.js';
import { readHash, writeHash, loadFromLocalStorage, stackToJSON, jsonToStack } from './serializer.js';
import { Interpreter } from './hypertalk/interpreter.js';
import { welcomeStack } from './stacks/demo-welcome.js';
import { ouijaStack } from './stacks/demo-ouija.js';
import { hauntedHouseStack } from './stacks/demo-haunted-house.js';

const canvas = document.getElementById('card-canvas');
const titleEl = document.getElementById('stack-title');
const cardInd = document.getElementById('card-indicator');

// ── interpreter runtime ──────────────────────────────────────────────────────
const interp = new Interpreter({
  get stack() { return store.getState().stack; },
  getCurrentCard: () => currentCard(),
  getCurrentCardIndex: () => store.getState().currentCardIndex,
  dispatch: a => store.dispatch(a),
  audio: { playSound: n => audio.play(n) },
  dialogs: {
    showAsk: (p, d) => dialogs.ask(p, d ?? ''),
    showAnswer: (p, btns) => dialogs.answer(p, btns?.length ? btns : ['OK'], 'ghost'),
  },
});

async function fire(handlerName, obj) {
  const { running } = store.getState();
  store.dispatch({ type: 'SET_RUNNING', running: true });
  try {
    await interp.executeHandler(handlerName, { currentObject: obj });
  } finally {
    store.dispatch({ type: 'SET_RUNNING', running: false });
  }
}

// ── rendering ────────────────────────────────────────────────────────────────
const events = {
  onButtonClick: obj => fire('mouseUp', obj),
  onCanvasClick: (x, y, e) => {
    const { mode } = store.getState();
    if (mode === 'edit') onCanvasEditClick(x, y, e);
  },
  onObjectEditMouseDown: (obj, e) => onObjectEditMouseDown(obj, e),
  onObjectDblClick: obj => openScriptInspector('object', obj.id, obj.cardId),
};

function render() {
  const { stack, mode, createTool, currentCardIndex, selectedObjectId } = store.getState();
  renderCard(canvas, events);
  titleEl.textContent = stack ? stack.name : 'PhantomCard';
  const n = stack ? stack.cardOrder.length : 0;
  cardInd.textContent = n ? `Card ${currentCardIndex + 1} of ${n}` : '';
  document.getElementById('toolbar').classList.toggle('edit-mode', mode === 'edit');
  canvas.classList.toggle('edit', mode === 'edit');
  canvas.classList.toggle('browse', mode !== 'edit');
  canvas.classList.toggle('create', !!createTool);
  document.getElementById('tb-browse').classList.toggle('active', mode === 'browse');
  document.getElementById('tb-button').classList.toggle('active', mode === 'edit' && createTool === 'button');
  document.getElementById('tb-field').classList.toggle('active', mode === 'edit' && createTool === 'field');
  document.getElementById('tb-label').classList.toggle('active', mode === 'edit' && createTool === 'label');
  // keep selection frame in sync after re-render
  if (mode === 'edit' && selectedObjectId) {
    const card = currentCard();
    const inBg = !!stack.background.objects[selectedObjectId];
    const obj = inBg ? stack.background.objects[selectedObjectId] : card.objects[selectedObjectId];
    if (obj) drawSelection(obj, inBg ? '__bg__' : card.id);
  } else if (mode !== 'edit') clearSelection();
}
store.subscribe(render);

function goTo(index, fireClose = true) {
  const card = currentCard();
  if (fireClose && card) fire('closeCard', card);
  document.getElementById('inspector-host').innerHTML = '';
  store.dispatch({ type: 'SET_CARD', index });
  writeHash(store.getState().stack);
  fire('openCard', currentCard());
}

// ── toolbar ──────────────────────────────────────────────────────────────────
document.getElementById('tb-first').addEventListener('click', () => goTo(0));
document.getElementById('tb-prev').addEventListener('click', () => goTo(store.getState().currentCardIndex - 1));
document.getElementById('tb-next').addEventListener('click', () => goTo(store.getState().currentCardIndex + 1));
document.getElementById('tb-last').addEventListener('click', () => goTo(store.getState().stack.cardOrder.length - 1));

document.getElementById('tb-browse').addEventListener('click', () =>
  store.dispatch({ type: 'SET_MODE', mode: 'browse' }));
for (const [id, tool] of [['tb-button', 'button'], ['tb-field', 'field'], ['tb-label', 'label']]) {
  document.getElementById(id).addEventListener('click', () => {
    store.dispatch({ type: 'SET_MODE', mode: 'edit' });
    store.dispatch({ type: 'SET_CREATE_TOOL', tool });
  });
}
document.getElementById('tb-newcard').addEventListener('click', () => {
  const { stack, currentCardIndex } = store.getState();
  const id = uid('card');
  store.dispatch({
    type: 'ADD_CARD',
    afterIndex: currentCardIndex,
    card: { id, name: `Card ${stack.cardOrder.length + 1}`, script: '', fill: 'white', objects: {}, objectOrder: [] },
  });
});
document.getElementById('tb-delcard').addEventListener('click', async () => {
  const { stack, currentCardIndex } = store.getState();
  if (stack.cardOrder.length <= 1) { dialogs.toast('A stack needs at least one card.'); return; }
  if (await dialogs.confirm(`Delete "${currentCard().name}"?`) === 'OK') {
    store.dispatch({ type: 'DELETE_CARD', cardId: stack.cardOrder[currentCardIndex] });
  }
});
document.getElementById('tb-share').addEventListener('click', async () => {
  writeHash(store.getState().stack);
  try { await navigator.clipboard.writeText(location.href); } catch { }
  dialogs.toast('Share link copied — the whole stack travels in the URL.');
});
document.getElementById('tb-export').addEventListener('click', () => {
  const { stack } = store.getState();
  const blob = new Blob([stackToJSON(stack)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${stack.name.replace(/\W+/g, '-').toLowerCase()}.stack.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById('tb-import').addEventListener('click', () =>
  document.getElementById('import-input').click());
document.getElementById('import-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const stack = jsonToStack(await file.text());
    if (await dialogs.confirm(`Open stack "${stack.name}"? Unsaved changes to the current stack will be lost.`) === 'OK') {
      loadStack(stack);
    }
  } catch { dialogs.answer('That file is not a PhantomCard stack.', ['OK'], 'caution'); }
  e.target.value = '';
});
document.getElementById('tb-zoom').addEventListener('click', () => {
  const v = document.getElementById('card-viewport');
  const z = v.dataset.zoom === '2' ? '1' : '2';
  v.dataset.zoom = z;
  canvas.style.transform = z === '2' ? 'scale(2)' : '';
  canvas.style.transformOrigin = 'top left';
  v.style.width = z === '2' ? '1024px' : '';
  v.style.height = z === '2' ? '684px' : '';
  v.style.overflow = z === '2' ? 'auto' : 'hidden';
});
document.getElementById('tb-close').addEventListener('click', () => showSplash());
document.getElementById('flicker-toggle').addEventListener('click', () =>
  document.getElementById('desktop').classList.toggle('flicker'));

canvas.addEventListener('mousedown', e => {
  if (e.target === canvas) events.onCanvasClick(e.offsetX, e.offsetY, e);
});

// ── menus ────────────────────────────────────────────────────────────────────
initMenus({
  file: () => [
    { label: 'New Stack…', action: newStack },
    { label: 'Import Stack…', action: () => document.getElementById('import-input').click() },
    { label: 'Export Stack', action: () => document.getElementById('tb-export').click() },
    { sep: true },
    { label: 'Copy Share Link', action: () => document.getElementById('tb-share').click() },
    { sep: true },
    { label: 'Stack Picker…', action: showSplash },
  ],
  edit: () => [
    { label: 'Browse', shortcut: 'B', action: () => store.dispatch({ type: 'SET_MODE', mode: 'browse' }) },
    { sep: true },
    { label: 'Button Tool', action: () => document.getElementById('tb-button').click() },
    { label: 'Field Tool', action: () => document.getElementById('tb-field').click() },
    { label: 'Label Tool', action: () => document.getElementById('tb-label').click() },
    { sep: true },
    { label: 'Object Info…', action: openSelectedProps },
    { label: 'Delete Object', shortcut: '⌫', action: deleteSelected },
    { sep: true },
    { label: 'Bring to Front', action: () => reorder('front') },
    { label: 'Send to Back', action: () => reorder('back') },
  ],
  go: () => [
    { label: 'First', shortcut: '⌘1', action: () => goTo(0) },
    { label: 'Prev', shortcut: '⌘2', action: () => goTo(store.getState().currentCardIndex - 1) },
    { label: 'Next', shortcut: '⌘3', action: () => goTo(store.getState().currentCardIndex + 1) },
    { label: 'Last', shortcut: '⌘4', action: () => goTo(store.getState().stack.cardOrder.length - 1) },
    { sep: true },
    { label: 'Back to Home', action: () => goTo(0) },
  ],
  tools: () => [
    { label: 'Card Info…', action: openCardInfo },
    { label: 'Card Script…', action: () => openScriptInspector('card', currentCard().id) },
    { label: 'Background Script…', action: () => openScriptInspector('background', null) },
    { label: 'Stack Script…', action: () => openScriptInspector('stack', null) },
    { sep: true },
    { label: 'New Card', action: () => document.getElementById('tb-newcard').click() },
    { label: 'Delete Card…', action: () => document.getElementById('tb-delcard').click() },
  ],
  stacks: () => [
    { label: 'Welcome to PhantomCard', action: () => loadStack(welcomeStack(), false) },
    { label: 'The Séance Deck', action: () => loadStack(ouijaStack(), false) },
    { label: 'The Haunted House', action: () => loadStack(hauntedHouseStack(), false) },
    { sep: true },
    { label: 'New Stack…', action: newStack },
  ],
  apple: () => dialogs.spooky(
    'PhantomCard\n\nA resurrection of Apple HyperCard (1987–2000), summoned for Kiroween 2026.\n\nCards, buttons, fields — and HyperTalk, alive again.\n\nBuilt with Kiro.', ['Boo!']),
});

function reorder(to) {
  const { selectedObjectId, stack } = store.getState();
  if (!selectedObjectId) return;
  const card = currentCard();
  const cardId = stack.background.objects[selectedObjectId] ? '__bg__' : card.id;
  store.dispatch({ type: 'REORDER_OBJECT', cardId, objectId: selectedObjectId, to });
}

async function newStack() {
  const name = await dialogs.ask('Name your new stack:', 'My Haunted Stack');
  if (!name) return;
  const cardId = uid('card');
  loadStack({
    version: '1.0', id: uid('stack'), name, script: '',
    cardOrder: [cardId],
    cards: { [cardId]: { id: cardId, name: 'Home', script: '', fill: 'white', objects: {}, objectOrder: [] } },
    background: { script: '', objects: {}, objectOrder: [] },
    resources: { icons: {} },
  });
}

// ── splash screen ────────────────────────────────────────────────────────────
function showSplash() {
  const vp = document.getElementById('card-viewport');
  let splash = vp.querySelector('.splash');
  if (splash) return;
  splash = document.createElement('div');
  splash.className = 'splash';
  splash.innerHTML = `
    <div class="ghost">👻</div>
    <h1>PhantomCard</h1>
    <div class="tagline">HyperCard, resurrected — pick a stack to begin</div>
    <div class="splash-stacks"></div>`;
  const row = splash.querySelector('.splash-stacks');
  for (const [label, make] of [
    ['Welcome', welcomeStack],
    ['The Séance Deck', ouijaStack],
    ['The Haunted House', hauntedHouseStack],
    ['New Stack…', null],
  ]) {
    const b = document.createElement('button');
    b.className = 'hc-button style-shadow';
    b.style.width = '130px';
    b.style.height = '36px';
    b.textContent = label;
    b.addEventListener('click', () => { splash.remove(); make ? loadStack(make(), false) : newStack(); });
    row.appendChild(b);
  }
  const { stack } = store.getState();
  if (stack) {
    const back = document.createElement('button');
    back.className = 'hc-button style-roundRect';
    back.style.width = '130px';
    back.style.height = '24px';
    back.textContent = '↩ Back to stack';
    back.addEventListener('click', () => splash.remove());
    splash.appendChild(back);
  }
  vp.appendChild(splash);
}

// ── keyboard ─────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const { mode } = store.getState();
  if (e.target.matches('input, textarea, select')) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (mode === 'edit') { e.preventDefault(); deleteSelected(); }
    return;
  }
  if (e.metaKey || e.ctrlKey) {
    const map = { 1: () => goTo(0), 2: () => goTo(store.getState().currentCardIndex - 1), 3: () => goTo(store.getState().currentCardIndex + 1), 4: () => goTo(store.getState().stack.cardOrder.length - 1) };
    if (map[e.key]) { e.preventDefault(); map[e.key](); }
    return;
  }
  if (e.key === 'ArrowRight' && mode === 'browse') goTo(store.getState().currentCardIndex + 1);
  if (e.key === 'ArrowLeft' && mode === 'browse') goTo(store.getState().currentCardIndex - 1);
  if (e.key === 'Escape' && mode === 'edit') store.dispatch({ type: 'SET_MODE', mode: 'browse' });
});

// ── boot ─────────────────────────────────────────────────────────────────────
function loadStack(stack, useHash = false) {
  document.getElementById('inspector-host').innerHTML = '';
  store.dispatch({ type: 'LOAD_STACK', stack, cardIndex: 0 });
  writeHash(stack);
  fire('openStack', stack);
  fire('openCard', currentCard());
}

const fromHash = readHash();
const fromLS = !fromHash && loadFromLocalStorage();
if (fromHash || fromLS) {
  loadStack(fromHash || fromLS);
} else {
  // first visit: land on the Welcome stack so people immediately see the thing work
  loadStack(welcomeStack(), false);
}
render();
