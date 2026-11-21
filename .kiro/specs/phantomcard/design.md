# PhantomCard — Design

**Project:** PhantomCard  
**Date:** 2026-11-21  
**Status:** Draft

---

## 1. Architecture Overview

PhantomCard is a single-page application composed entirely of ES modules loaded directly by the browser. No bundler, no transpilation, no server-side code. Entry point: `index.html`.

### Module tree

```
index.html
└── src/
    ├── main.js                  # bootstrap, routing, top-level event wiring
    ├── store.js                 # reactive state store
    ├── renderer.js              # card canvas DOM rendering
    ├── editor.js                # Edit-mode selection / drag / resize
    ├── audio.js                 # WebAudio sound library
    ├── serializer.js            # JSON ↔ stack, LZ-string hash codec
    ├── hypertalk/
    │   ├── lexer.js
    │   ├── parser.js
    │   └── interpreter.js
    ├── ui/
    │   ├── toolbar.js
    │   ├── dialogs.js
    │   ├── script-inspector.js
    │   └── property-inspector.js
    └── stacks/
        ├── demo-welcome.js
        ├── demo-ouija.js
        └── demo-haunted-house.js
```

### Rendering strategy

The card canvas is a `<div class="card-canvas">` fixed at 512×342 px. Objects are absolutely positioned children. CSS integer-scale transform applied to the wrapper. No `<canvas>` is used so objects remain focusable DOM nodes.

Background objects render at z-index 10–99; card objects at 100–999.

---

## 2. Data Model

All data is plain JSON.

### Type definitions

```ts
interface Stack {
  version: "1.0";
  id: string;              // UUID v4
  name: string;
  script: string;
  cardOrder: string[];
  cards: Record<string, Card>;
  background: Background;
  resources: ResourceMap;
}

interface Background {
  script: string;
  objects: Record<string, BgObject>;
  objectOrder: string[];
}

interface Card {
  id: string;
  name: string;
  script: string;
  fill: "white" | "black";
  objects: Record<string, CardObject>;
  objectOrder: string[];
}

interface BaseObject {
  id: string;
  name: string;
  left: number;   // px from card top-left
  top: number;
  width: number;
  height: number;
  visible: boolean;
  layer: "card" | "background";
}

interface ButtonObject extends BaseObject {
  kind: "button";
  style: "rectangle" | "roundRect" | "shadow" | "transparent" | "oval"
       | "checkbox" | "radio";
  showName: boolean;
  enabled: boolean;
  hilite: boolean;
  icon: string | null;
  script: string;
}

interface FieldObject extends BaseObject {
  kind: "field";
  style: "transparent" | "opaque" | "rectangle" | "shadow" | "scrolling";
  text: string;
  font: string;
  size: number;
  textAlign: "left" | "center" | "right";
  lockText: boolean;
  script: string;
}

interface LabelObject extends BaseObject {
  kind: "label";
  text: string;
  font: string;
  size: number;
  textAlign: "left" | "center" | "right";
}

interface ResourceMap {
  icons: Record<string, string>;  // name → SVG string (monochrome)
}
```

---

## 3. State Store (`store.js`)

Lightweight reactive store; no library dependency.

```js
// API
store.getState()           // → { stack, currentCardIndex, mode, selectedObjectId }
store.dispatch(action)     // updates state, notifies subscribers, triggers autosave
store.subscribe(fn)        // → unsubscribe fn

// Action types
{ type: 'LOAD_STACK',      stack }
{ type: 'SET_CARD',        index }
{ type: 'SET_MODE',        mode }          // 'browse' | 'edit'
{ type: 'SELECT_OBJECT',   id }
{ type: 'UPDATE_OBJECT',   cardId, objectId, patch }
{ type: 'ADD_OBJECT',      cardId, object }
{ type: 'DELETE_OBJECT',   cardId, objectId }
{ type: 'ADD_CARD',        afterIndex }
{ type: 'DELETE_CARD',     index }
{ type: 'UPDATE_SCRIPT',   target, id, script }
{ type: 'UPDATE_CARD',     cardId, patch }
{ type: 'UPDATE_STACK',    patch }
```

---

## 4. HyperTalk Interpreter

### 4.1 Lexer (`hypertalk/lexer.js`)

Produces a flat token array. Token types: `KEYWORD`, `IDENTIFIER`, `STRING`, `NUMBER`, `OPERATOR`, `LPAREN`, `RPAREN`, `COMMA`, `NEWLINE`, `EOF`.

Keywords (case-insensitive): `on end go to card next prev previous first last put into before after get set of the if then else repeat while until with times exit pass return ask answer or play show hide enable disable me it true false and not mod div number cards background field button stack`.

### 4.2 Parser (`hypertalk/parser.js`)

Recursive-descent; produces an AST. Key node types:

```
HandlerDef   { name, params, body }
GoCmd        { target }
PutCmd       { expr, prep: 'into'|'before'|'after', dest }
GetCmd       { expr }
SetCmd       { prop, obj, value }
AskCmd       { prompt }
AnswerCmd    { prompt, buttons[] }
PlayCmd      { sound }
ShowCmd / HideCmd / EnableCmd / DisableCmd   { obj }
IfStmt       { condition, then, elseIfs[], else }
RepeatTimes  { count, body }
RepeatWhile  { condition, body }
RepeatUntil  { condition, body }
RepeatWith   { variable, start, end, body }
ExitRepeat / NextRepeat / ExitHandler
BinOp / UnaryOp / StringLit / NumberLit / BoolLit
Identifier / Container / PropertyRef / FunctionCall / ChunkExpr
```

### 4.3 Interpreter (`hypertalk/interpreter.js`)

```js
class Interpreter {
  constructor(runtime)
  // runtime: { stack, currentCard, currentObject, dispatch, audio, dialogs }
  async execute(script, context)
  async executeHandler(handlerName, context)
}
```

Fully `async` to support `ask`/`answer` awaiting modal dialogs.

**Variable scoping:** Each handler invocation gets a fresh `locals` Map. `it` is a pseudo-variable in `locals`. `me` resolves to `context.currentObject`.

**Message passing:** If a handler is not found on the current object, it passes to card → background → stack. Unhandled messages are silently dropped.

**`go` target resolution:**

| Token | Resolves to |
|-------|-------------|
| `next` | currentCardIndex + 1 (wraps) |
| `prev` / `previous` | currentCardIndex - 1 (wraps) |
| `first` | index 0 |
| `last` | cardOrder.length - 1 |
| integer n | n - 1 (HyperTalk is 1-based) |
| string s | card whose `name === s` |

---

## 5. Renderer (`renderer.js`)

```js
renderCard(card, background, mode) → void
```

1. Set canvas background color from `card.fill`.
2. Clear existing DOM children.
3. Render background objects (objectOrder), then card objects.

**Object → DOM mapping:**

| Kind | DOM element |
|------|-------------|
| button (rectangle/roundRect/shadow) | `<button>` with CSS class encoding style |
| button (transparent) | `<div role="button" tabindex="0">` |
| button (checkbox) | `<label><input type="checkbox"></label>` |
| button (radio) | `<label><input type="radio"></label>` |
| button (oval) | `<button class="oval">` |
| field (lockText=false) | `<textarea>` |
| field (lockText=true) | `<div class="field locked">` |
| label | `<div class="label">` (pointer-events: none) |

In Edit mode: each object element receives `data-object-id` and an overlaid `.selection-frame` when selected.

---

## 6. Audio (`audio.js`)

```js
export function playSound(name: string): void
```

All sounds synthesized via WebAudio. No files fetched. Unknown names fail silently.

| Name | Synthesis |
|------|-----------|
| `boing` | Sine osc, exponential freq decay 440→55 Hz, 0.5 s |
| `harpsichord` | Sawtooth osc → BiquadFilter bandpass, short decay |
| `click` | White noise burst, 20 ms, highpass at 2 kHz |
| `creeak` | Sawtooth sweep 60→40 Hz, 1.2 s, waveshaper distortion |
| `thunder` | Brown noise, 2 s, lowpass 300 Hz, slow gain envelope |
| `whisper` | White noise, 1 s, bandpass 1 kHz, very low gain |

---

## 7. Serializer (`serializer.js`)

```js
export function stackToJSON(stack): string
export function jsonToStack(json): Stack
export function saveToLocalStorage(stack): void
export function loadFromLocalStorage(): Stack | null
export function stackToHash(stack): string    // LZ-string + base64url
export function hashToStack(hash): Stack
export function writeHash(stack): void
export function readHash(): Stack | null
```

LZ-string is bundled as `src/vendor/lz-string.js` (MIT, no npm needed).

---

## 8. UI Components

### Toolbar (`ui/toolbar.js`)

20 px System 7 menu-bar strip above the canvas:

- Mode toggle (Browse / Edit, inset appearance for active)
- Navigation (⏮ ◀ ▶ ⏭)
- Stack name (inline editable, centered)
- Card number display (right-aligned)
- Share button (copies URL+hash to clipboard)
- Menu dropdown: New Card, Delete Card, Import, Export, Demo Stacks

### Dialogs (`ui/dialogs.js`)

`<dialog>` elements styled as System 7 modals (shadow border, Chicago font, default button with bold border).

```js
export async function showAsk(prompt): Promise<string>
export async function showAnswer(prompt, buttons[]): Promise<string>
export async function showConfirm(message): Promise<boolean>
```

Enter confirms default; Escape cancels.

### Script Inspector (`ui/script-inspector.js`)

280 px side panel, slides in from the right on double-click in Edit mode:

- Object name header
- `<textarea class="script-editor">` with monospace font
- Syntax highlight overlay via mirrored `<pre>` (no library)
- Save button (also Cmd/Ctrl+S)
- Inline error display

### Property Inspector (`ui/property-inspector.js`)

Side panel with inputs dynamically rendered per `object.kind`. Each input dispatches `UPDATE_OBJECT` on change.

---

## 9. Editor Interaction (`editor.js`)

**Selection:** `click` on object → `SELECT_OBJECT`, render selection frame with 8 handles (7×7 px black squares).

**Drag:** `pointerdown` on object body → track delta on `pointermove`, snap to 8 px grid → `UPDATE_OBJECT` on `pointerup`.

**Resize:** `pointerdown` on bottom-right handle → track delta, minimum 20×16 px → `UPDATE_OBJECT` on `pointerup`.

**Create:** Toolbar icon sets pending intent → canvas `click` creates default-size object at snapped position → `ADD_OBJECT` → open Property Inspector.

---

## 10. Demo Stacks

Each `src/stacks/demo-*.js` exports a Stack object literal.

**Séance Deck:** 3 cards. Title → Ouija Board (planchette button animates via `set the left of button` in a repeat loop, then `answer` dialog) → Oracle Response card.

**Welcome Stack:** 5 cards touring features; shared nav buttons in background layer.

**Haunted House:** 6 room cards (Foyer, Library, Basement, Attic, Garden, Crypt). Crypt plays `thunder` + `creeak` on `openCard` and has a puzzle `answer` dialog.

---

## 11. File Map

```
/
├── index.html
├── src/
│   ├── main.js
│   ├── store.js
│   ├── renderer.js
│   ├── editor.js
│   ├── audio.js
│   ├── serializer.js
│   ├── hypertalk/
│   │   ├── lexer.js
│   │   ├── parser.js
│   │   └── interpreter.js
│   ├── ui/
│   │   ├── toolbar.js
│   │   ├── dialogs.js
│   │   ├── script-inspector.js
│   │   └── property-inspector.js
│   └── stacks/
│       ├── demo-welcome.js
│       ├── demo-ouija.js
│       └── demo-haunted-house.js
├── vendor/
│   └── lz-string.js
├── styles/
│   ├── base.css
│   ├── card.css
│   ├── editor.css
│   └── dialogs.css
└── assets/   (empty; all graphics are CSS/SVG)
```

---

## 12. Security

- Scripts execute inside the interpreter only; `eval()` is never called.
- `ask`/`answer` use `<dialog>`, not `window.prompt`/`window.confirm`.
- Stack JSON from the hash is parsed with `JSON.parse` only.
- Entirely client-side; no credentials or network requests beyond initial page load.
