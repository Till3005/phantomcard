# PhantomCard — Implementation Tasks

**Project:** PhantomCard  
**Date:** 2026-11-21

Tasks are ordered by dependency. Each task lists its direct prerequisites.

---

## Phase 0 — Project Scaffold

### T-001 · Repo scaffold
- Create `index.html` with `<script type="module" src="src/main.js">` and a `<div id="app">` root.
- Create `styles/base.css`, `styles/card.css`, `styles/editor.css`, `styles/dialogs.css` as empty files.
- Create all `src/` subdirectories.
- Commit `vendor/lz-string.js` (copy MIT source verbatim).
- Add `README.md` with one-liner launch instructions and GitHub Pages setup.
- **Prereqs:** none

### T-002 · CSS variables and reset (`styles/base.css`)
- Define CSS custom properties: `--black`, `--white`, `--card-width: 512px`, `--card-height: 342px`, `--font-chicago`, `--font-mono`.
- Apply a minimal reset (box-sizing, margin 0).
- **Prereqs:** T-001

---

## Phase 1 — Data Layer

### T-003 · Stack data model types (`src/types.js`)
- Define JSDoc `@typedef` for Stack, Card, Background, ButtonObject, FieldObject, LabelObject, ResourceMap.
- Export factory functions: `makeStack()`, `makeCard()`, `makeButton()`, `makeField()`, `makeLabel()`.
- **Prereqs:** T-001

### T-004 · State store (`src/store.js`)
- Implement `dispatch`, `getState`, `subscribe` with shallow-copy state updates.
- Handle all action types listed in the design doc.
- Call `serializer.saveToLocalStorage` after every dispatch.
- **Prereqs:** T-003

### T-005 · Serializer — JSON and localStorage (`src/serializer.js`)
- Implement `stackToJSON`, `jsonToStack`, `saveToLocalStorage`, `loadFromLocalStorage`.
- Validate the parsed object has `version: "1.0"` before accepting it.
- **Prereqs:** T-003

### T-006 · Serializer — URL hash (`src/serializer.js`)
- Implement `stackToHash`, `hashToStack`, `writeHash`, `readHash` using `vendor/lz-string.js`.
- **Prereqs:** T-005

---

## Phase 2 — Card Renderer

### T-007 · Card canvas shell (`src/renderer.js`)
- Render the 512×342 `<div class="card-canvas">` inside `<div id="app">`.
- Apply CSS integer scaling based on `window.devicePixelRatio` (clamp to 1 or 2).
- Handle window resize events to re-apply scaling.
- **Prereqs:** T-002, T-004

### T-008 · Object DOM factories (`src/renderer.js`)
- Implement `renderButton(obj, mode)`, `renderField(obj, mode)`, `renderLabel(obj, mode)`.
- Apply correct CSS classes for each button/field style.
- In Browse mode, wire `click` → dispatch HyperTalk `mouseUp` via interpreter (stub interpreter call for now).
- **Prereqs:** T-007

### T-009 · Full card render (`src/renderer.js`)
- Implement `renderCard(card, background, mode)`: clear canvas, render background objects, then card objects.
- Subscribe to store; re-render on `SET_CARD`, `UPDATE_OBJECT`, `ADD_OBJECT`, `DELETE_OBJECT`, `SET_MODE`.
- **Prereqs:** T-008

### T-010 · Button styles CSS (`styles/card.css`)
- Implement monochrome System 7 visual styles for all seven button styles.
- rectangle: 1 px black border, white fill, square corners.
- roundRect: 1 px black border, 4 px border-radius.
- shadow: rectangle + 2 px offset black shadow (bottom-right).
- transparent: no border, no fill, `cursor: pointer`.
- oval: `border-radius: 50%`.
- checkbox / radio: native `<input>` elements forced monochrome via CSS appearance override.
- **Prereqs:** T-008

### T-011 · Field and label styles CSS (`styles/card.css`)
- rectangle / shadow fields: styled similarly to buttons.
- opaque field: white background, no border.
- transparent field: no background, no border.
- scrolling field: `overflow-y: scroll`, System 7 scrollbar appearance via CSS.
- Labels: no background, no border, pointer-events none.
- **Prereqs:** T-008

### T-012 · Card transition animation
- Implement 300 ms dissolve transition between cards using CSS opacity keyframes.
- Triggered by `SET_CARD` dispatch.
- **Prereqs:** T-009

---

## Phase 3 — Navigation and Toolbar

### T-013 · Toolbar component (`src/ui/toolbar.js`)
- Render the toolbar above the card canvas.
- Mode toggle (Browse/Edit), nav buttons (⏮ ◀ ▶ ⏭), stack name, card counter, Share button, Menu.
- Wire nav buttons to dispatch `SET_CARD`.
- Wire mode toggle to dispatch `SET_MODE`.
- Share button: call `serializer.writeHash` then `navigator.clipboard.writeText(location.href)`.
- **Prereqs:** T-004, T-006

### T-014 · Menu dropdown
- New Card → dispatch `ADD_CARD`.
- Delete Card → `showConfirm` → dispatch `DELETE_CARD`.
- Import → `<input type="file">` → `serializer.jsonToStack` → `dispatch LOAD_STACK`.
- Export → `stackToJSON` → Blob download.
- Demo Stacks → submenu listing three demos → `dispatch LOAD_STACK`.
- **Prereqs:** T-013

---

## Phase 4 — HyperTalk

### T-015 · Lexer (`src/hypertalk/lexer.js`)
- Tokenize a HyperTalk source string into the token types listed in the design doc.
- Handle quoted strings (escape `\"`), integers, floats, identifiers, operators.
- Keywords are case-insensitive; normalize to lowercase in the token stream.
- Treat `--` to end-of-line as comments (emit no token).
- Emit `NEWLINE` for `\n`; skip other whitespace.
- **Prereqs:** T-001

### T-016 · Parser (`src/hypertalk/parser.js`)
- Implement recursive-descent parser producing the AST nodes listed in the design doc.
- Entry points: `parseScript(tokens) → Program` (list of `HandlerDef` nodes), `parseExpr(tokens) → Expr`.
- Throw descriptive `ParseError` with line number for syntax errors.
- **Prereqs:** T-015

### T-017 · Interpreter — core commands (`src/hypertalk/interpreter.js`)
- Implement `Interpreter` class with `execute(script, context)` and `executeHandler(name, context)`.
- Implement `go`, `put`, `get`, `set`, `show`, `hide`, `enable`, `disable`.
- Implement arithmetic, comparison, logical, and string concatenation expressions.
- Implement `if/then/else` and all four `repeat` forms.
- **Prereqs:** T-016, T-004

### T-018 · Interpreter — `ask`/`answer`/`play`
- Implement `ask` and `answer` using `dialogs.showAsk` / `dialogs.showAnswer`.
- Implement `play` using `audio.playSound`.
- **Prereqs:** T-017, T-023 (dialogs), T-022 (audio)

### T-019 · Message passing
- Implement the button → card → background → stack handler lookup chain.
- Wire renderer button click handler to `interpreter.executeHandler('mouseUp', context)`.
- Wire card navigation to fire `openCard`/`closeCard` handlers before/after `SET_CARD`.
- Wire `LOAD_STACK` to fire `openStack` on the new stack.
- **Prereqs:** T-017, T-009

---

## Phase 5 — Editor

### T-020 · Selection (`src/editor.js`)
- In Edit mode, `click` on an object dispatches `SELECT_OBJECT`.
- Render `.selection-frame` overlay with 8 handles (7×7 px black squares at corners + midpoints).
- Clicking the canvas background deselects.
- **Prereqs:** T-009

### T-021 · Drag and resize (`src/editor.js`)
- Drag: `pointerdown` on object body → track delta → snap to 8 px grid → dispatch `UPDATE_OBJECT` on `pointerup`.
- Resize: `pointerdown` on bottom-right handle → track delta, minimum 20×16 px → dispatch `UPDATE_OBJECT` on `pointerup`.
- **Prereqs:** T-020

### T-022 · Script Inspector (`src/ui/script-inspector.js`)
- 280 px side panel; slides in from the right on object double-click.
- `<textarea>` with mirrored `<pre>` for syntax highlighting (bold keywords, italic strings).
- Save on button click or Cmd/Ctrl+S: parse script via `parser.parseScript`; show errors inline; dispatch `UPDATE_SCRIPT` on success.
- **Prereqs:** T-016, T-020

### T-023 · Property Inspector (`src/ui/property-inspector.js`)
- Side panel showing editable fields for selected object properties.
- Rendered dynamically based on `object.kind`.
- Each input dispatches `UPDATE_OBJECT` on `change`.
- **Prereqs:** T-020

### T-024 · Object creation toolbar controls
- "New Button" and "New Field" icons in Edit mode toolbar.
- Setting a pending intent; next canvas click places object at snapped position.
- Dispatch `ADD_OBJECT`; open Property Inspector for the new object.
- **Prereqs:** T-021, T-023

### T-025 · Delete object
- `keydown` Delete/Backspace in Edit mode with a selected object → dispatch `DELETE_OBJECT`.
- **Prereqs:** T-020

---

## Phase 6 — Dialogs and Audio

### T-026 · Dialogs (`src/ui/dialogs.js`)
- Implement `showAsk`, `showAnswer`, `showConfirm` using `<dialog>.showModal()`.
- System 7 visual styling: shadow border, Chicago font, default button with 3 px border.
- Enter confirms, Escape cancels.
- **Prereqs:** T-002

### T-027 · Audio library (`src/audio.js`)
- Implement `playSound(name)` with the six named sounds synthesized via WebAudio.
- Lazy-initialize `AudioContext` on first call (required for browsers that block autoplay).
- **Prereqs:** T-001

---

## Phase 7 — Demo Stacks

### T-028 · Welcome stack (`src/stacks/demo-welcome.js`)
- Five cards covering: welcome, the stack model, Browse mode, Edit mode, sharing.
- Background layer navigation buttons on all cards.
- **Prereqs:** T-003

### T-029 · Séance Deck (`src/stacks/demo-ouija.js`)
- Title card, Ouija Board card, Oracle Response card.
- Planchette button with animation script using `repeat` + `set the left of button`.
- Oracle answers drawn from a fixed array via `repeat with i = 1 to …`.
- **Prereqs:** T-003, T-018

### T-030 · Haunted House (`src/stacks/demo-haunted-house.js`)
- Six room cards with atmospheric scripts.
- Crypt card: `on openCard play "thunder" … play "creeak"` and `answer` puzzle.
- **Prereqs:** T-003, T-018

---

## Phase 8 — Bootstrap and Persistence

### T-031 · main.js bootstrap
- On load: check URL hash → `serializer.readHash()` → if present, `dispatch LOAD_STACK`.
- Else: `serializer.loadFromLocalStorage()` → if present, `dispatch LOAD_STACK`.
- Else: render welcome/demo selector screen.
- Initialize renderer, toolbar, editor, audio (register modules).
- **Prereqs:** T-005, T-006, T-009, T-013

### T-032 · Welcome / demo selector screen
- Render if no saved stack found.
- Shows PhantomCard title motif (SVG ghost + card, monochrome).
- Lists three demo stacks with descriptions; clicking one loads it.
- "New Stack" button creates a blank stack.
- **Prereqs:** T-028, T-029, T-030

---

## Phase 9 — Polish and Spooky Extras

### T-033 · Kiroween Easter egg
- Define a secret script sequence (e.g., navigating to a card named "void" triggers a spooky overlay).
- Implement as a hidden card in one of the demo stacks with an `on openCard` handler.
- **Prereqs:** T-019

### T-034 · README and GitHub Pages config
- Complete `README.md` with launch instructions, feature list, and attribution.
- Verify `index.html` works as GitHub Pages root (no path rewriting needed for hash routing).
- Add `_config.yml` for Jekyll bypass (`theme:` omitted, just `include: [vendor]` etc.) or a `.nojekyll` file.
- **Prereqs:** T-031

### T-035 · Cross-browser QA
- Test in current Chrome, Firefox, Safari.
- Verify integer scaling, audio synthesis, dialog behavior, and localStorage persistence in each.
- **Prereqs:** all prior tasks

---

## Task Dependency Graph (summarized)

```
T-001 → T-002 → T-010/T-011
T-001 → T-003 → T-004 → T-005 → T-006
T-003 → T-007 → T-008 → T-009
T-009 → T-012
T-004 + T-006 → T-013 → T-014
T-001 → T-015 → T-016 → T-017 → T-018 → T-019
T-009 + T-019 → T-020 → T-021 → T-022/T-023/T-024/T-025
T-002 → T-026
T-001 → T-027
T-003 + T-018 → T-028/T-029/T-030
T-005 + T-006 + T-009 + T-013 → T-031 → T-032
T-019 → T-033
T-031 → T-034 → T-035
```
