// PhantomCard — System 7 dialogs: answer/ask/confirm/toast (steering §6)

const host = () => document.getElementById('dialog-host');

const ICONS = {
  note: `<svg viewBox="0 0 32 32"><rect x="13" y="3" width="6" height="26" fill="#000"/><rect x="11" y="5" width="2" height="6" fill="#000"/><rect x="19" y="5" width="2" height="6" fill="#000"/><rect x="8" y="12" width="16" height="14" fill="none" stroke="#000"/><circle cx="16" cy="19" r="3" fill="none" stroke="#000" stroke-width="1.4"/><line x1="16" y1="14" x2="16" y2="17" stroke="#000"/><line x1="16" y1="21" x2="16" y2="23" stroke="#000"/></svg>`,
  caution: `<svg viewBox="0 0 32 32"><polygon points="16,3 30,29 2,29" fill="none" stroke="#000" stroke-width="1.5"/><line x1="16" y1="12" x2="16" y2="20" stroke="#000" stroke-width="2"/><rect x="15" y="23" width="2" height="2" fill="#000"/></svg>`,
  ghost: `<svg viewBox="0 0 32 32"><path d="M6 28 L6 12 Q6 4 16 4 Q26 4 26 12 L26 28 L22 24 L18 28 L16 25 L14 28 L10 24 Z" fill="none" stroke="#000" stroke-width="1.5"/><circle cx="12" cy="13" r="1.6" fill="#000"/><circle cx="20" cy="13" r="1.6" fill="#000"/><path d="M13 19 Q16 22 19 19" fill="none" stroke="#000" stroke-width="1.2"/></svg>`,
};

function open({ text, input = null, defaultValue = '', buttons = ['OK'], icon = 'note' }) {
  return new Promise(resolve => {
    const h = host();
    h.classList.add('has-modal');
    const wrap = document.createElement('div');
    wrap.className = 'hc-dialog-wrap';
    wrap.innerHTML = `
      <div class="hc-dialog" role="dialog" aria-modal="true">
        <div class="hc-dialog-icon">${ICONS[icon] || ICONS.note}</div>
        <div class="hc-dialog-main">
          <div class="hc-dialog-text"></div>
          ${input ? '<input class="hc-dialog-input" type="text">' : ''}
          <div class="hc-dialog-btns"></div>
        </div>
      </div>`;
    wrap.querySelector('.hc-dialog-text').textContent = text;
    const btnRow = wrap.querySelector('.hc-dialog-btns');
    const inputEl = wrap.querySelector('.hc-dialog-input');
    if (inputEl) inputEl.value = defaultValue;

    buttons.forEach((label, i) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (i === buttons.length - 1) b.classList.add('default'); // last = default
      b.addEventListener('click', () => close(input ? inputEl.value : label, label));
      btnRow.appendChild(b);
    });

    function close(value, label) {
      wrap.remove();
      h.classList.remove('has-modal');
      document.removeEventListener('keydown', onKey, true);
      resolve(input ? value : label);
    }
    function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); close(input ? inputEl.value : buttons[buttons.length - 1], buttons[buttons.length - 1]); }
      if (e.key === 'Escape') { e.preventDefault(); close(input ? '' : buttons[0], buttons[0]); }
    }
    document.addEventListener('keydown', onKey, true);
    h.appendChild(wrap);
    (inputEl || btnRow.lastElementChild).focus();
  });
}

export const dialogs = {
  answer: (text, buttons = ['OK'], icon = 'note') => open({ text, buttons, icon }),
  ask: (text, defaultValue = '') => open({ text, input: true, defaultValue, buttons: ['Cancel', 'OK'], icon: 'note' }),
  confirm: (text) => open({ text, buttons: ['Cancel', 'OK'], icon: 'caution' }),
  spooky: (text, buttons = ['OK']) => open({ text, buttons, icon: 'ghost' }),
  toast(msg, ms = 1600) {
    const t = document.createElement('div');
    t.className = 'hc-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  },
};
