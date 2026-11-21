// PhantomCard — bundled demo stack: Welcome to PhantomCard
export function welcomeStack() {
  return {
    version: '1.0',
    id: 'stack_welcome',
    name: 'Welcome to PhantomCard',
    script: `on openStack
  play "harpsichord"
end openStack`,
    cardOrder: ['c1', 'c2', 'c3'],
    cards: {
      c1: {
        id: 'c1', name: 'Welcome', fill: 'white',
        script: `on openCard
  play "click"
end openCard`,
        objects: {
          t1: { id: 't1', kind: 'label', name: 'title', text: 'PhantomCard', left: 156, top: 40, width: 200, height: 30, visible: true, size: 24, textAlign: 'center', bold: true },
          g1: { id: 'g1', kind: 'label', name: 'ghost', text: '👻', left: 220, top: 78, width: 72, height: 60, visible: true, size: 24, textAlign: 'center', anim: 'float' },
          t2: { id: 't2', kind: 'label', name: 'subtitle', text: 'HyperCard, resurrected\nfrom the floppy-disk afterlife', left: 96, top: 150, width: 320, height: 40, visible: true, size: 14, textAlign: 'center' },
          t3: { id: 't3', kind: 'label', name: 'hint', text: 'a stack is a deck of cards — cards hold buttons, fields and scripts', left: 76, top: 205, width: 360, height: 30, visible: true, size: 10, textAlign: 'center', italic: true },
          b1: {
            id: 'b1', kind: 'button', name: 'Take the Tour →', left: 186, top: 250, width: 140, height: 26, visible: true,
            style: 'shadow', showName: true, enabled: true, hilite: false, icon: null,
            script: `on mouseUp
  play "click"
  go to next card
end mouseUp`
          },
          b2: {
            id: 'b2', kind: 'button', name: 'The Séance', left: 186, top: 286, width: 140, height: 24, visible: true,
            style: 'roundRect', showName: true, enabled: true, hilite: false, icon: null,
            script: `on mouseUp
  answer "The spirits call you to the Séance Deck — find it in the Stacks menu." with "Enter" 
end mouseUp`
          },
        },
        objectOrder: ['t1', 'g1', 't2', 't3', 'b1', 'b2'],
      },
      c2: {
        id: 'c2', name: 'Cards & Objects', fill: 'white',
        script: '',
        objects: {
          h: { id: 'h', kind: 'label', name: 'head', text: 'A card is a page. Objects live on it.', left: 60, top: 30, width: 400, height: 22, visible: true, size: 14, bold: true },
          f1: { id: 'f1', kind: 'field', name: 'scratch', left: 60, top: 70, width: 250, height: 60, visible: true, style: 'rectangle', text: 'This is a field — click into it and type. Fields hold text.', lockText: false, script: '', size: 12, textAlign: 'left' },
          cb: { id: 'cb', kind: 'button', name: 'a checkbox', left: 60, top: 150, width: 110, height: 20, visible: true, style: 'checkbox', showName: true, enabled: true, hilite: false, script: `on mouseUp\nend mouseUp` },
          rb: { id: 'rb', kind: 'button', name: 'a radio', left: 60, top: 176, width: 110, height: 20, visible: true, style: 'radio', showName: true, enabled: true, hilite: true, script: `on mouseUp\nend mouseUp` },
          ov: { id: 'ov', kind: 'button', name: 'oval', left: 60, top: 205, width: 60, height: 40, visible: true, style: 'oval', showName: true, enabled: true, hilite: false, script: `on mouseUp\n  play "boing"\nend mouseUp` },
          sh: { id: 'sh', kind: 'button', name: 'shadow', left: 140, top: 212, width: 80, height: 24, visible: true, style: 'shadow', showName: true, enabled: true, hilite: false, script: `on mouseUp\n  play "click"\nend mouseUp` },
          tr: {
            id: 'tr', kind: 'button', name: 'transparent button — click me', left: 60, top: 268, width: 220, height: 24, visible: true,
            style: 'transparent', showName: true, enabled: true, hilite: false,
            script: `on mouseUp
  answer "Transparent buttons hide over art. Sneaky." with "Spooky" 
end mouseUp`
          },
          nxt: { id: 'nxt', kind: 'button', name: 'Scripts →', left: 396, top: 296, width: 100, height: 24, visible: true, style: 'roundRect', showName: true, enabled: true, hilite: false, script: `on mouseUp\n  go to next card\nend mouseUp` },
          prv: { id: 'prv', kind: 'button', name: '← Back', left: 16, top: 296, width: 80, height: 24, visible: true, style: 'roundRect', showName: true, enabled: true, hilite: false, script: `on mouseUp\n  go to prev card\nend mouseUp` },
        },
        objectOrder: ['h', 'f1', 'cb', 'rb', 'ov', 'sh', 'tr', 'nxt', 'prv'],
      },
      c3: {
        id: 'c3', name: 'HyperTalk', fill: 'black',
        script: '',
        objects: {
          h: { id: 'h', kind: 'label', name: 'head', text: 'HyperTalk makes cards alive.', left: 60, top: 30, width: 400, height: 22, visible: true, size: 14, bold: true },
          f1: { id: 'f1', kind: 'field', name: 'greeting', left: 60, top: 80, width: 392, height: 40, visible: true, style: 'rectangle', text: '…ask the button below, and I will greet you.', lockText: true, script: '', size: 12, textAlign: 'center' },
          b1: {
            id: 'b1', kind: 'button', name: 'Greet me, ghost', left: 171, top: 160, width: 170, height: 28, visible: true,
            style: 'shadow', showName: true, enabled: true, hilite: false,
            script: `on mouseUp
  ask "What do the spirits call you?"
  put "Welcome back, " & it & "." into card field "greeting"
  play "harpsichord"
end mouseUp`
          },
          b2: {
            id: 'b2', kind: 'button', name: 'Summon thunder', left: 171, top: 200, width: 170, height: 26, visible: true,
            style: 'roundRect', showName: true, enabled: true, hilite: false,
            script: `on mouseUp
  play "thunder"
end mouseUp`
          },
          note: { id: 'note', kind: 'label', name: 'note', text: 'Edit → Button tool draws new objects. Double-click one to write its script.', left: 60, top: 262, width: 400, height: 30, visible: true, size: 10, textAlign: 'center', italic: true },
          prv: { id: 'prv', kind: 'button', name: '← Back to start', left: 16, top: 296, width: 120, height: 24, visible: true, style: 'roundRect', showName: true, enabled: true, hilite: false, script: `on mouseUp\n  go to card "Welcome"\nend mouseUp` },
        },
        objectOrder: ['h', 'f1', 'b1', 'b2', 'note', 'prv'],
      },
    },
    background: {
      script: '',
      objects: {},
      objectOrder: [],
    },
    resources: { icons: {} },
  };
}
