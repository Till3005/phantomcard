// PhantomCard — JSON ↔ stack, hash codec, localStorage (design §7)
import LZString from './vendor/lz-string.js';

const LS_KEY = 'phantomcard.stack.v1';
const LS_RECENT = 'phantomcard.recent.v1';

export function stackToJSON(stack) {
  return JSON.stringify(stack, null, 2);
}

export function jsonToStack(json) {
  const stack = typeof json === 'string' ? JSON.parse(json) : json;
  return normalizeStack(stack);
}

// Fill in any fields missing from older/partial stacks so the renderer never crashes.
export function normalizeStack(stack) {
  stack.version ||= '1.0';
  stack.id ||= `stack_${Date.now().toString(36)}`;
  stack.name ||= 'Untitled Stack';
  stack.script ||= '';
  stack.cardOrder ||= [];
  stack.cards ||= {};
  stack.background ||= { script: '', objects: {}, objectOrder: [] };
  stack.background.objects ||= {};
  stack.background.objectOrder ||= [];
  stack.resources ||= { icons: {} };
  for (const id of Object.keys(stack.cards)) {
    const c = stack.cards[id];
    c.id = id;
    c.name ||= id;
    c.script ||= '';
    c.fill ||= 'white';
    c.objects ||= {};
    c.objectOrder ||= [];
  }
  stack.cardOrder = stack.cardOrder.filter(id => stack.cards[id]);
  if (!stack.cardOrder.length) {
    const id = 'card_home';
    stack.cards[id] = { id, name: 'Home', script: '', fill: 'white', objects: {}, objectOrder: [] };
    stack.cardOrder = [id];
  }
  return stack;
}

export function saveToLocalStorage(stack) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(stack));
    const recent = JSON.parse(localStorage.getItem(LS_RECENT) || '[]');
    const entry = { id: stack.id, name: stack.name, at: Date.now() };
    const next = [entry, ...recent.filter(r => r.id !== stack.id)].slice(0, 10);
    localStorage.setItem(LS_RECENT, JSON.stringify(next));
  } catch { /* quota or privacy mode — fine */ }
}

export function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? jsonToStack(raw) : null;
  } catch { return null; }
}

export function stackToHash(stack) {
  return '#s=' + LZString.compressToEncodedURIComponent(JSON.stringify(stack));
}

export function hashToStack(hash) {
  const m = /^#s=(.+)$/.exec(hash || '');
  if (!m) return null;
  try {
    const json = LZString.decompressFromEncodedURIComponent(m[1]);
    return json ? jsonToStack(json) : null;
  } catch { return null; }
}

export function writeHash(stack) {
  history.replaceState(null, '', stackToHash(stack));
}

export function readHash() {
  return hashToStack(location.hash);
}
