// PhantomCard — pulldown menus (steering §7)
const menuHost = () => document.getElementById('menu-host');

let openMenu = null;

function closeMenus() {
  if (openMenu) { openMenu.remove(); openMenu = null; }
  document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open'));
  document.removeEventListener('mousedown', onDocDown, true);
}

function onDocDown(e) {
  if (!e.target.closest('.hc-menu') && !e.target.closest('.menu')) closeMenus();
}

// items: [{label, shortcut?, action?, checked?, disabled?, sep?}]
export function showMenu(anchor, items) {
  closeMenus();
  anchor.classList.add('open');
  const rect = anchor.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'hc-menu';
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.bottom}px`;
  for (const item of items) {
    if (item.sep) {
      const s = document.createElement('div');
      s.className = 'hc-menu-sep';
      el.appendChild(s);
      continue;
    }
    const it = document.createElement('div');
    it.className = 'hc-menu-item';
    if (item.disabled) it.classList.add('disabled');
    if (item.checked) it.classList.add('checked');
    const lbl = document.createElement('span');
    lbl.textContent = item.label;
    it.appendChild(lbl);
    if (item.shortcut) {
      const sc = document.createElement('span');
      sc.className = 'shortcut';
      sc.textContent = item.shortcut;
      it.appendChild(sc);
    }
    if (!item.disabled) {
      it.addEventListener('click', () => {
        closeMenus();
        item.action && item.action();
      });
    }
    el.appendChild(it);
  }
  menuHost().appendChild(el);
  openMenu = el;
  document.addEventListener('mousedown', onDocDown, true);
}

export function initMenus(defs) {
  for (const btn of document.querySelectorAll('.menu')) {
    btn.addEventListener('mousedown', e => {
      e.preventDefault();
      const name = btn.dataset.menu;
      if (openMenu && btn.classList.contains('open')) { closeMenus(); return; }
      const items = defs[name] ? defs[name]() : [];
      if (items.length) showMenu(btn, items);
    });
    // hover to switch menus while one is open
    btn.addEventListener('mouseenter', () => {
      if (openMenu && !btn.classList.contains('open')) {
        const items = defs[btn.dataset.menu] ? defs[btn.dataset.menu]() : [];
        if (items.length) showMenu(btn, items);
      }
    });
  }
  document.getElementById('apple-menu').addEventListener('click', () => defs.apple && defs.apple());
}
