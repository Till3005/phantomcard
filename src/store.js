// PhantomCard — tiny reactive store (design §3)
import { saveToLocalStorage } from './serializer.js';

const listeners = new Set();

const state = {
  stack: null,
  currentCardIndex: 0,
  mode: 'browse',            // 'browse' | 'edit'
  createTool: null,          // null | 'button' | 'field' | 'label'
  selectedObjectId: null,
  running: false,            // a script handler is executing
};

let autosaveTimer = 0;

function notify() {
  for (const fn of listeners) fn(state);
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    if (state.stack) saveToLocalStorage(state.stack);
  }, 400);
}

export const store = {
  getState() { return state; },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  dispatch(action) {
    switch (action.type) {
      case 'LOAD_STACK': {
        state.stack = action.stack;
        state.currentCardIndex = Math.min(
          action.cardIndex ?? 0,
          Math.max(0, action.stack.cardOrder.length - 1)
        );
        state.selectedObjectId = null;
        break;
      }
      case 'SET_CARD': {
        const n = state.stack ? state.stack.cardOrder.length : 0;
        state.currentCardIndex = ((action.index % n) + n) % n;
        state.selectedObjectId = null;
        break;
      }
      case 'SET_MODE': {
        state.mode = action.mode;
        if (action.mode !== 'edit') {
          state.selectedObjectId = null;
          state.createTool = null;
        }
        break;
      }
      case 'SET_CREATE_TOOL': {
        state.createTool = action.tool;
        break;
      }
      case 'SELECT_OBJECT': {
        state.selectedObjectId = action.id;
        break;
      }
      case 'UPDATE_STACK': {
        Object.assign(state.stack, action.patch);
        break;
      }
      case 'UPDATE_CARD': {
        const card = state.stack.cards[action.cardId];
        if (card) Object.assign(card, action.patch);
        break;
      }
      case 'ADD_OBJECT': {
        const { cardId, object } = action;
        const host = cardId === '__bg__' ? state.stack.background : state.stack.cards[cardId];
        host.objects[object.id] = object;
        host.objectOrder.push(object.id);
        break;
      }
      case 'UPDATE_OBJECT': {
        const { cardId, objectId, patch } = action;
        const host = cardId === '__bg__' ? state.stack.background : state.stack.cards[cardId];
        const obj = host.objects[objectId];
        if (obj) Object.assign(obj, patch);
        break;
      }
      case 'DELETE_OBJECT': {
        const { cardId, objectId } = action;
        const host = cardId === '__bg__' ? state.stack.background : state.stack.cards[cardId];
        delete host.objects[objectId];
        host.objectOrder = host.objectOrder.filter(i => i !== objectId);
        if (state.selectedObjectId === objectId) state.selectedObjectId = null;
        break;
      }
      case 'REORDER_OBJECT': {
        const { cardId, objectId, to } = action; // to: 'front' | 'back'
        const host = cardId === '__bg__' ? state.stack.background : state.stack.cards[cardId];
        host.objectOrder = host.objectOrder.filter(i => i !== objectId);
        if (to === 'front') host.objectOrder.push(objectId);
        else host.objectOrder.unshift(objectId);
        break;
      }
      case 'ADD_CARD': {
        const { card } = action;
        state.stack.cards[card.id] = card;
        const at = action.afterIndex != null ? action.afterIndex + 1 : state.stack.cardOrder.length;
        state.stack.cardOrder.splice(at, 0, card.id);
        state.currentCardIndex = at;
        break;
      }
      case 'DELETE_CARD': {
        const { cardId } = action;
        if (state.stack.cardOrder.length <= 1) return; // never empty
        delete state.stack.cards[cardId];
        state.stack.cardOrder = state.stack.cardOrder.filter(i => i !== cardId);
        state.currentCardIndex = Math.min(state.currentCardIndex, state.stack.cardOrder.length - 1);
        break;
      }
      case 'UPDATE_SCRIPT': {
        const { target, id, script } = action; // target: 'object'|'card'|'background'|'stack'
        if (target === 'stack') state.stack.script = script;
        else if (target === 'background') state.stack.background.script = script;
        else if (target === 'card') state.stack.cards[id].script = script;
        else state.stack.cards[action.cardId].objects[id].script = script;
        break;
      }
      case 'SET_RUNNING': {
        state.running = action.running;
        break;
      }
      default:
        console.warn('unknown action', action.type);
        return;
    }
    notify();
  },
};

export function currentCard() {
  const { stack, currentCardIndex } = state;
  return stack ? stack.cards[stack.cardOrder[currentCardIndex]] : null;
}

export function uid(prefix = 'o') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
