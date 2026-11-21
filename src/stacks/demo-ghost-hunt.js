// PhantomCard — bundled demo stack: Ghost Hunt (a working HyperTalk mini-game)
// 9 haunted windows; ghosts pop up one at a time — click them before the hunt
// ends. Score and ghosts-left are real card fields driven by HyperTalk.
export function ghostHuntStack() {
  const objects = {};
  const order = [];
  const add = (o) => { objects[o.id] = o; order.push(o.id); };

  add({
    id: 'title', kind: 'label', name: 'title',
    text: '👻  G H O S T   H U N T  👻',
    left: 96, top: 12, width: 320, height: 26, visible: true,
    size: 16, textAlign: 'center', bold: true,
  });
  add({
    id: 'sub', kind: 'label', name: 'sub',
    text: 'press Start, then zap the ghosts — 15 are hiding in the manor',
    left: 76, top: 38, width: 360, height: 16, visible: true,
    size: 10, textAlign: 'center', italic: true,
  });
  add({
    id: 'scoreLabel', kind: 'label', name: 'scoreLabel', text: 'Score:',
    left: 60, top: 62, width: 50, height: 18, visible: true, size: 12, textAlign: 'right',
  });
  add({
    id: 'score', kind: 'field', name: 'score', text: '0',
    left: 114, top: 60, width: 50, height: 20, visible: true,
    style: 'transparent', lockText: true, size: 13, bold: true, textAlign: 'left',
  });
  add({
    id: 'leftLabel', kind: 'label', name: 'leftLabel', text: 'Left:',
    left: 340, top: 62, width: 45, height: 18, visible: true, size: 12, textAlign: 'right',
  });
  add({
    id: 'left', kind: 'field', name: 'left', text: '15',
    left: 389, top: 60, width: 40, height: 20, visible: true,
    style: 'transparent', lockText: true, size: 13, bold: true, textAlign: 'left',
  });

  // 3×3 haunted windows + a ghost button hiding inside each one.
  // Ghost i, when clicked, scores and summons ghost next[i] (a fixed
  // permutation — the chain feels random while staying pure HyperTalk).
  const winW = 90, winH = 62, x0 = 105, y0 = 92, gap = 12;
  const next = { 1: 5, 2: 9, 3: 7, 4: 6, 5: 8, 6: 1, 7: 2, 8: 4, 9: 3 };
  for (let i = 1; i <= 9; i++) {
    const col = (i - 1) % 3, row = Math.floor((i - 1) / 3);
    const wx = x0 + col * (winW + gap), wy = y0 + row * (winH + gap);
    add({
      id: `w${i}`, kind: 'button', name: '',
      left: wx, top: wy, width: winW, height: winH,
      visible: true, style: 'shadow', showName: false, enabled: true,
      script: `on mouseUp\n  miss\nend mouseUp`,
    });
    add({
      id: `ghost${i}`, kind: 'button', name: '👻',
      left: wx + 22, top: wy + 14, width: 46, height: 40,
      visible: false, style: 'transparent', showName: true, enabled: true,
      size: 26, textAlign: 'center',
      script: `on mouseUp
  hide me
  put card field "score" + 1 into card field "score"
  put card field "left" - 1 into card field "left"
  if card field "left" <= 0 then
    answer "The hunt is over! You zapped " & card field "score" & " of 15 ghosts." with "Well hunted"
  else
    show card button ${2 * next[i]}
  end if
end mouseUp`,
    });
  }

  add({
    id: 'start', kind: 'button', name: 'Start the hunt', left: 196, top: 300, width: 120, height: 28,
    visible: true, style: 'roundrect', showName: true, enabled: true,
    script: `on mouseUp
  put 0 into card field "score"
  put 15 into card field "left"
  hide card button 2
  hide card button 4
  hide card button 6
  hide card button 8
  hide card button 10
  hide card button 12
  hide card button 14
  hide card button 16
  hide card button 18
  show card button 10
end mouseUp`,
  });

  return {
    version: '1.0',
    id: 'stack_ghosthunt',
    name: 'Ghost Hunt',
    script: `on miss
  -- clicking a window with no ghost costs a point
  put card field "score" - 1 into card field "score"
  play "creeak"
end miss`,
    cardOrder: ['g1'],
    cards: {
      g1: {
        id: 'g1', name: 'The Hunt', fill: 'white', script: '',
        objects, objectOrder: order,
      },
    },
    background: { script: '', objects: {}, objectOrder: [] },
    resources: { icons: {} },
  };
}
