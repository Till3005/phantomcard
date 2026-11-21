# 👻 PhantomCard

**HyperCard, resurrected — in your browser.**

PhantomCard is a faithful resurrection of Apple's HyperCard (1987–2000): stacks of cards,
buttons and fields, scripted with **HyperTalk** — rebuilt from the grave as a pure
client-side web app. No build step, no server, no frameworks: the way HyperCard would
have wanted it.

Built with **Kiro** for [Kiroween 2026](https://kiroween.devpost.com/) — *Resurrection* category.

## Try it

Open the live app → **[till3005.github.io/phantomcard](https://till3005.github.io/phantomcard/)**

Or serve locally (any static server works):

```sh
python3 -m http.server 8080
# → http://localhost:8080
```

## What it does

- **Stacks & cards** — a stack is a deck of cards; navigate with ◀ ▶, arrow keys or ⌘1-4
- **HyperTalk, for real** — a working interpreter (`src/hypertalk/`): `on mouseUp`,
  `ask`/`answer`, `put … into`, `if/then/else`, `repeat`, `go to card`, `play`,
  field references, chunk expressions, message hierarchy (button → card → background → stack)
- **Authoring mode** — Button / Field / Label tools draw new objects on the card;
  drag to move, handles to resize, double-click to write a script, live syntax checking
- **Card properties** — white or black fill, per-object styles (rectangle, roundRect,
  shadow, oval, transparent, checkbox, radio), 9–24 px type, alignment
- **Persistence** — autosaves to localStorage; the entire stack travels in the URL
  hash (`#s=…`) so a share link *is* the stack
- **Import / export** — `.stack.json` round-trip
- **System 7 chrome** — pinstripe title bar, menu bar, dithered desktop, the bundled
  Silkscreen pixel font, and a CRT flicker you can toggle

## Bundled stacks

| Stack | What it is |
|---|---|
| Welcome to PhantomCard | A three-card tour of cards, objects and HyperTalk |
| The Séance Deck | A working Ouija board — ask, and the planchette answers |
| The Haunted House | A five-card mini adventure built from 12 objects and a page of script |
| Ghost Hunt | A playable mini-game — 9 haunted windows, 15 ghosts, real HyperTalk game logic |

Find them in the **Stacks** menu, or close the window for the séance parlour.

## A taste of HyperTalk

```hypertalk
on mouseUp
  ask "What do the spirits call you?"
  put "Welcome back, " & it & "." into card field "greeting"
  play "harpsichord"
end mouseUp
```

## Built with Kiro

Every layer of PhantomCard was designed and written with **Kiro**:

- `.kiro/specs/phantomcard/` — requirements (100+ EARS-style statements), the 9-section
  design document, and the implementation task list, all authored in a Kiro spec session
- `.kiro/steering/` — Kiro-authored steering docs: the System 7 visual bible and the
  HyperTalk language reference that constrained every later generation
- `src/hypertalk/` — the ~2,000-line lexer, parser and tree-walking interpreter was
  written by `kiro-cli`, including its own self-check suite (29 assertions)

See the write-up in the project submission for how agent hooks, specs and steering
shaped the build.

## Tech

Vanilla ES modules · zero dependencies at runtime · LZ-string for URL hashing ·
Silkscreen typeface (OFL) · MIT license.
