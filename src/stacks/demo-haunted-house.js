// PhantomCard — bundled demo stack: The Haunted House (tiny adventure)
export function hauntedHouseStack() {
  return {
    version: '1.0',
    id: 'stack_haunted',
    name: 'The Haunted House',
    script: `on openStack\n  play "thunder"\nend openStack`,
    cardOrder: ['gate', 'hall', 'attic', 'cellar', 'escape'],
    cards: {
      gate: {
        id: 'gate', name: 'The Gate', fill: 'black',
        script: `on openCard\n  play "creeak"\nend openCard`,
        objects: {
          house: { id: 'house', kind: 'label', name: 'house', text: '⛧\n🏚', left: 216, top: 60, width: 80, height: 80, visible: true, size: 24, textAlign: 'center' },
          msg: { id: 'msg', kind: 'label', name: 'msg', text: 'The gate swings open by itself.\nThe house has been waiting.', left: 96, top: 190, width: 320, height: 44, visible: true, size: 14, textAlign: 'center' },
          enter: {
            id: 'enter', kind: 'button', name: 'Enter… if you dare', left: 171, top: 260, width: 170, height: 28,
            visible: true, style: 'shadow', showName: true, enabled: true, hilite: false,
            script: `on mouseUp\n  play "creeak"\n  go to card "The Hall"\nend mouseUp`,
          },
        },
        objectOrder: ['house', 'msg', 'enter'],
      },
      hall: {
        id: 'hall', name: 'The Hall', fill: 'black',
        script: `on openCard\n  play "whisper"\nend openCard`,
        objects: {
          msg: { id: 'msg', kind: 'label', name: 'msg', text: 'Two stairs climb into dark.\nOne door breathes cold air below.', left: 76, top: 40, width: 360, height: 44, visible: true, size: 14, textAlign: 'center' },
          portrait: { id: 'portrait', kind: 'label', name: 'portrait', text: '🖼', left: 230, top: 110, width: 52, height: 52, visible: true, size: 24, textAlign: 'center', anim: 'blink' },
          up: {
            id: 'up', kind: 'button', name: '↑ Attic', left: 86, top: 210, width: 120, height: 28,
            visible: true, style: 'shadow', showName: true, enabled: true, hilite: false,
            script: `on mouseUp\n  play "click"\n  go to card "The Attic"\nend mouseUp`,
          },
          down: {
            id: 'down', kind: 'button', name: '↓ Cellar', left: 306, top: 210, width: 120, height: 28,
            visible: true, style: 'shadow', showName: true, enabled: true, hilite: false,
            script: `on mouseUp\n  play "creeak"\n  go to card "The Cellar"\nend mouseUp`,
          },
          back: {
            id: 'back', kind: 'button', name: '← Flee', left: 16, top: 300, width: 90, height: 22,
            visible: true, style: 'roundRect', showName: true, enabled: true, hilite: false,
            script: `on mouseUp\n  go to card "The Gate"\nend mouseUp`,
          },
        },
        objectOrder: ['msg', 'portrait', 'up', 'down', 'back'],
      },
      attic: {
        id: 'attic', name: 'The Attic', fill: 'white',
        script: '',
        objects: {
          msg: { id: 'msg', kind: 'label', name: 'msg', text: 'Dust and sheet-shrouds.\nA rocking chair moves on its own.', left: 76, top: 40, width: 360, height: 44, visible: true, size: 14, textAlign: 'center' },
          chair: { id: 'chair', kind: 'label', name: 'chair', text: '🪑', left: 230, top: 120, width: 52, height: 52, visible: true, size: 24, textAlign: 'center', anim: 'float' },
          chest: {
            id: 'chest', kind: 'button', name: 'Open the trunk', left: 176, top: 200, width: 160, height: 28,
            visible: true, style: 'shadow', showName: true, enabled: true, hilite: false,
            script: `on mouseUp
  ask "Inside: a stack of floppy disks, labeled in pencil — 'HyperCard'. Open one?"
  put it into whisper
  play "whisper"
  answer "A ghost leans over your shoulder and whispers: " & whisper & "… it means you should build one." with "Unsettling"
end mouseUp`,
          },
          back: {
            id: 'back', kind: 'button', name: '↓ Back to the Hall', left: 16, top: 300, width: 140, height: 22,
            visible: true, style: 'roundRect', showName: true, enabled: true, hilite: false,
            script: `on mouseUp\n  go to card "The Hall"\nend mouseUp`,
          },
        },
        objectOrder: ['msg', 'chair', 'chest', 'back'],
      },
      cellar: {
        id: 'cellar', name: 'The Cellar', fill: 'black',
        script: `on openCard\n  play "ghost"\nend openCard`,
        objects: {
          msg: { id: 'msg', kind: 'label', name: 'msg', text: 'Something lives down here.\nIt has been compiling since 1989.', left: 76, top: 40, width: 360, height: 44, visible: true, size: 14, textAlign: 'center' },
          eyes: { id: 'eyes', kind: 'label', name: 'eyes', text: '👀', left: 230, top: 120, width: 52, height: 52, visible: true, size: 24, textAlign: 'center', anim: 'blink' },
          feed: {
            id: 'feed', kind: 'button', name: 'Offer it a punch card', left: 166, top: 200, width: 180, height: 28,
            visible: true, style: 'shadow', showName: true, enabled: true, hilite: false,
            script: `on mouseUp
  play "ghost"
  answer "It accepts the card, whirs, and spells on its terminal: B U I L D  W I T H  K I R O" with "Understood"
  go to card "Escape"
end mouseUp`,
          },
          back: {
            id: 'back', kind: 'button', name: '↑ Back to the Hall', left: 16, top: 300, width: 140, height: 22,
            visible: true, style: 'roundRect', showName: true, enabled: true, hilite: false,
            script: `on mouseUp\n  go to card "The Hall"\nend mouseUp`,
          },
        },
        objectOrder: ['msg', 'eyes', 'feed', 'back'],
      },
      escape: {
        id: 'escape', name: 'Escape', fill: 'white',
        script: `on openCard\n  play "harpsichord"\nend openCard`,
        objects: {
          msg: { id: 'msg', kind: 'label', name: 'msg', text: 'You escaped the Haunted House!\nThis whole adventure is just 5 cards,\n12 objects and a page of HyperTalk.', left: 66, top: 90, width: 380, height: 70, visible: true, size: 14, textAlign: 'center' },
          make: {
            id: 'make', kind: 'button', name: 'Make your own', left: 176, top: 200, width: 160, height: 30,
            visible: true, style: 'shadow', showName: true, enabled: true, hilite: false,
            script: `on mouseUp
  answer "Press + Card on the toolbar, draw buttons and fields, double-click to script. File → New Stack for a blank deck." with "Let's haunt"
end mouseUp`,
          },
          back: {
            id: 'back', kind: 'button', name: '← Start over', left: 16, top: 300, width: 110, height: 22,
            visible: true, style: 'roundRect', showName: true, enabled: true, hilite: false,
            script: `on mouseUp\n  go to card "The Gate"\nend mouseUp`,
          },
        },
        objectOrder: ['msg', 'make', 'back'],
      },
    },
    background: {
      script: `on scaryNight\n  play "thunder"\nend scaryNight`,
      objects: {}, objectOrder: [],
    },
    resources: { icons: {} },
  };
}
