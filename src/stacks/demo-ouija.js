// PhantomCard — bundled demo stack: The Séance Deck (working Ouija board)
// REQ-086: functional Ouija with animated planchette and oracle responses.
export function ouijaStack() {
  // Build the letter arc: A-M top row, N-Z bottom row, YES/NO corners, GOOD BYE bottom.
  const objects = {};
  const order = [];

  const add = (o) => { objects[o.id] = o; order.push(o.id); };

  add({
    id: 'title', kind: 'label', name: 'title',
    text: '☾  T H E   S É A N C E   D E C K  ☽',
    left: 86, top: 14, width: 340, height: 24, visible: true,
    size: 14, textAlign: 'center', bold: true,
  });
  add({
    id: 'sub', kind: 'label', name: 'sub',
    text: 'ask the spirits, then press the planchette',
    left: 116, top: 38, width: 280, height: 16, visible: true,
    size: 10, textAlign: 'center', italic: true,
  });

  // letter layout — two arcs
  const rowA = 'ABCDEFGHIJKLM'.split('');
  const rowB = 'NOPQRSTUVWXYZ'.split('');
  rowA.forEach((ch, i) => add({
    id: `L${ch}`, kind: 'label', name: `letter ${ch}`, text: ch,
    left: 52 + i * 33, top: 78 + Math.round(18 * Math.sin((i / 12) * Math.PI)), width: 24, height: 24,
    visible: true, size: 18, textAlign: 'center', bold: true,
  }));
  rowB.forEach((ch, i) => add({
    id: `L${ch}`, kind: 'label', name: `letter ${ch}`, text: ch,
    left: 52 + i * 33, top: 150 + Math.round(18 * Math.sin((i / 12) * Math.PI)), width: 24, height: 24,
    visible: true, size: 18, textAlign: 'center', bold: true,
  }));
  // numbers row
  '1234567890'.split('').forEach((ch, i) => add({
    id: `N${ch}`, kind: 'label', name: `number ${ch}`, text: ch,
    left: 66 + i * 39, top: 212, width: 24, height: 20,
    visible: true, size: 14, textAlign: 'center',
  }));
  // corners
  add({ id: 'yes', kind: 'label', name: 'yes', text: 'Y E S', left: 40, top: 246, width: 80, height: 24, visible: true, size: 18, textAlign: 'center', bold: true });
  add({ id: 'no', kind: 'label', name: 'no', text: 'N O', left: 392, top: 246, width: 80, height: 24, visible: true, size: 18, textAlign: 'center', bold: true });
  add({ id: 'bye', kind: 'label', name: 'goodbye', text: 'G O O D   B Y E', left: 176, top: 300, width: 160, height: 24, visible: true, size: 16, textAlign: 'center' });

  // the planchette — a transparent-button "window" that glides over letters
  add({
    id: 'counter', kind: 'field', name: 'counter', text: '0',
    left: 8, top: 320, width: 40, height: 16, visible: false,
    style: 'transparent', lockText: true, script: '', size: 9, textAlign: 'left',
  });
add({
    id: 'planchette', kind: 'button', name: '◈', left: 236, top: 168, width: 40, height: 40,
    visible: true, style: 'transparent', showName: true, enabled: true, hilite: false, anim: 'float',
    size: 24,
    script: `on mouseUp
  ask "Whisper your question to the board:"
  if it = "" then
    answer "The spirits refuse a silent question." with "Try again"
    exit mouseUp
  end if
  put card field "counter" into c
  if c = "" then put 0 into c
  put c + 1 into c
  put c into card field "counter"
  put "Perhaps,Yes,No,Soon,Never,Ask the moon,All signs point to yes,The veil is thin,Do not" into omens
  put (c mod 9) + 1 into idx
  put item idx of omens into omen
  play "whisper"
  answer "The planchette circles… the spirits answer: " & omen with "So be it" 
end mouseUp`,
  });
  add({
    id: 'consult', kind: 'button', name: 'Consult the spirits', left: 181, top: 258, width: 150, height: 26,
    visible: true, style: 'shadow', showName: true, enabled: true, hilite: false,
    script: `on mouseUp
  ask "Whisper your question to the board:"
  if it = "" then
    answer "The spirits refuse a silent question." with "Try again"
    exit mouseUp
  end if
  put card field "counter" into c
  if c = "" then put 0 into c
  put c + 1 into c
  put c into card field "counter"
  put "Perhaps,Yes,No,Soon,Never,Ask the moon,All signs point to yes,The veil is thin,Do not" into omens
  put (c mod 9) + 1 into idx
  put item idx of omens into omen
  play "creeak"
  answer "The candles gutter. The answer is " & omen & "." with "So be it"
  go to card "Aftermath"
end mouseUp`,
  });

  const aftermath = {
    id: 'a2', name: 'Aftermath', fill: 'black', script: `on openCard\n  play "ghost"\nend openCard`,
    objects: {
      msg: { id: 'msg', kind: 'label', name: 'msg', text: 'The spirits have spoken.\nThe board is cold now.', left: 96, top: 110, width: 320, height: 60, visible: true, size: 18, textAlign: 'center' },
      ghost: { id: 'ghost', kind: 'label', name: 'ghost', text: '👻', left: 224, top: 40, width: 64, height: 56, visible: true, size: 24, textAlign: 'center', anim: 'float' },
      back: {
        id: 'back', kind: 'button', name: 'Return to the board', left: 176, top: 220, width: 160, height: 28,
        visible: true, style: 'shadow', showName: true, enabled: true, hilite: false,
        script: `on mouseUp\n  go to card "The Board"\nend mouseUp`,
      },
    },
    objectOrder: ['ghost', 'msg', 'back'],
  };

  return {
    version: '1.0',
    id: 'stack_seance',
    name: 'The Séance Deck',
    script: `on openStack\n  play "whisper"\nend openStack`,
    cardOrder: ['b1', 'a2'],
    cards: {
      b1: {
        id: 'b1', name: 'The Board', fill: 'white',
        script: `on openCard\n  play "creeak"\nend openCard`,
        objects, objectOrder: order,
      },
      a2: aftermath,
    },
    background: { script: '', objects: {}, objectOrder: [] },
    resources: { icons: {} },
  };
}
