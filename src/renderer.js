// PhantomCard — card renderer (design §5)
import { store, currentCard } from './store.js';

const SIZE_CLASSES = [9, 10, 12, 14, 18, 24];

function nearestSize(px) {
  return SIZE_CLASSES.reduce((a, b) => Math.abs(b - px) < Math.abs(a - px) ? b : a, 12);
}

function applyCommon(el, obj, card) {
  el.className += ` hc-obj size-${nearestSize(obj.size || 12)}`;
  el.style.left = `${obj.left}px`;
  el.style.top = `${obj.top}px`;
  el.style.width = `${obj.width}px`;
  el.style.height = `${obj.height}px`;
  el.dataset.oid = obj.id;
  if (obj.visible === false) el.classList.add('hidden');
  if (card.fill === 'black' && obj.kind === 'label') el.classList.add('invert');
  if (obj.bold) el.classList.add('bold');
  if (obj.italic) el.classList.add('italic');
  if (obj.underline) el.classList.add('underline');
  if (obj.anim === 'float') el.classList.add('anim-float');
  if (obj.anim === 'blink') el.classList.add('anim-blink');
}

function renderButton(obj, card, mode, events) {
  const el = document.createElement('button');
  el.className = `hc-obj hc-button style-${obj.style || 'roundRect'}`;
  applyCommon(el, obj, card);
  if (obj.showName !== false) el.textContent = obj.name;
  if (obj.enabled === false) { el.classList.add('disabled'); el.disabled = true; }
  if (obj.hilite) el.classList.add('hilite');
  if (mode === 'browse') {
    el.addEventListener('click', e => {
      e.stopPropagation();
      events.onButtonClick(obj);
    });
    // checkbox/radio toggle locally too
    if ((obj.style === 'checkbox' || obj.style === 'radio') && obj.enabled !== false) {
      el.addEventListener('click', () => {
        store.dispatch({
          type: 'UPDATE_OBJECT',
          cardId: obj.cardId,
          objectId: obj.id,
          patch: { hilite: !obj.hilite },
        });
      });
    }
  }
  return el;
}

function renderField(obj, card, mode, events) {
  const el = document.createElement(obj.lockText === false && mode === 'browse' ? 'textarea' : 'div');
  el.className = `hc-obj hc-field style-${obj.style || 'rectangle'} align-${obj.textAlign || 'left'}`;
  applyCommon(el, obj, card);
  if (el.tagName === 'TEXTAREA') {
    el.value = obj.text || '';
    el.classList.add('editable');
    el.spellcheck = false;
    el.addEventListener('input', () => {
      store.dispatch({
        type: 'UPDATE_OBJECT',
        cardId: obj.cardId,
        objectId: obj.id,
        patch: { text: el.value },
      });
    });
    el.addEventListener('click', e => e.stopPropagation());
  } else {
    el.textContent = obj.text || '';
  }
  if (mode === 'browse' && obj.script && obj.script.trim()) {
    el.addEventListener('click', e => {
      e.stopPropagation();
      events.onButtonClick(obj);
    });
  }
  return el;
}

function renderLabel(obj, card) {
  const el = document.createElement('div');
  el.className = `hc-obj hc-label align-${obj.textAlign || 'left'}`;
  applyCommon(el, obj, card);
  el.textContent = obj.text || '';
  return el;
}

// events: { onButtonClick(obj), onCanvasClick(x,y), onObjectEditMouseDown(obj, e) }
export function renderCard(canvas, events) {
  const { stack, mode, currentCardIndex } = store.getState();
  const card = currentCard();
  if (!card) return;

  canvas.className = mode;
  canvas.classList.toggle('black', card.fill === 'black');
  canvas.innerHTML = '';

  // background objects first (behind), then card objects
  const renderOne = (obj, layer) => {
    obj.cardId = layer === 'background' ? '__bg__' : card.id;
    let el;
    if (obj.kind === 'button') el = renderButton(obj, card, mode, events);
    else if (obj.kind === 'field') el = renderField(obj, card, mode, events);
    else el = renderLabel(obj, card);
    if (mode === 'edit') {
      el.addEventListener('mousedown', e => events.onObjectEditMouseDown(obj, e));
      el.addEventListener('dblclick', e => {
        e.stopPropagation();
        events.onObjectDblClick(obj);
      });
    }
    return el;
  };

  for (const oid of stack.background.objectOrder) {
    const obj = stack.background.objects[oid];
    if (obj) canvas.appendChild(renderOne(obj, 'background'));
  }
  for (const oid of card.objectOrder) {
    const obj = card.objects[oid];
    if (obj) canvas.appendChild(renderOne(obj, 'card'));
  }

  // dissolve transition animation
  canvas.classList.remove('dissolve');
  void canvas.offsetWidth;
  if (!canvas.dataset.noAnim && currentCardIndex != null) canvas.classList.add('dissolve');
}
