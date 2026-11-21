# PhantomCard — Requirements

**Project:** PhantomCard  
**Category:** Kiroween 2026 · Resurrection  
**Date:** 2026-11-21  
**Status:** Draft

---

## Requirement Notation

EARS patterns used throughout:
- **Ubiquitous:** `<System> shall <action>.`
- **Event-driven:** `When <trigger>, <system> shall <action>.`
- **State-driven:** `While <state>, <system> shall <action>.`
- **Conditional:** `Where <condition>, <system> shall <action>.`

---

## 1. Stack Model

**REQ-001** The system shall organize content in a three-level hierarchy: stacks contain cards, and cards contain objects (buttons, fields, labels).

**REQ-002** The system shall support an unlimited number of cards per stack.

**REQ-003** Each stack shall have a name, a unique ID, and an ordered list of card IDs.

**REQ-004** Each card shall have a name, a unique ID, a background fill (white or black), and an ordered list of object IDs.

**REQ-005** The system shall maintain a background layer shared across all cards in a stack containing background objects that appear on every card.

**REQ-006** The system shall render every card at exactly 512 × 342 pixels.

**REQ-007** The system shall render the card canvas in 1-bit monochrome: pure black (#000000) and pure white (#FFFFFF) only.

**REQ-008** When the viewport is wider than 512 px, the system shall center the card canvas horizontally.

**REQ-009** The system shall scale the card canvas using integer CSS scaling only (1×, 2×); it shall never use fractional scaling.

---

## 2. Object Model

### 2.1 Buttons

**REQ-010** The system shall support button objects with properties: `id`, `name`, `left`, `top`, `width`, `height`, `style` (rectangle | roundRect | shadow | transparent | oval | checkbox | radio), `showName`, `icon`, `script`, `layer`.

**REQ-011** When a user clicks a button in Browse mode, the system shall execute the button's `mouseUp` handler.

**REQ-012** The system shall render buttons with the correct monochrome System 7 visual style matching their `style` property.

### 2.2 Fields

**REQ-013** The system shall support field objects with properties: `id`, `name`, `left`, `top`, `width`, `height`, `style` (transparent | opaque | rectangle | shadow | scrolling), `text`, `font`, `size`, `textAlign`, `lockText`, `script`, `layer`.

**REQ-014** While `lockText` is false and the user is in Browse mode, the system shall allow direct text editing in fields.

**REQ-015** When a field has style `scrolling` and its text overflows the field height, the system shall display a functional scrollbar.

### 2.3 Labels

**REQ-016** The system shall support label objects (non-interactive text display) with properties: `id`, `name`, `left`, `top`, `width`, `height`, `text`, `font`, `size`, `textAlign`, `layer`.

---

## 3. Navigation

**REQ-017** When a HyperTalk `go to card <target>` command executes, the system shall navigate to the target card within the current stack.

**REQ-018** When navigation occurs, the system shall animate the transition using a dissolve effect no longer than 300 ms.

**REQ-019** The system shall provide First, Previous, Next, and Last card navigation controls visible in Browse mode.

**REQ-020** When on the first card and navigating Previous, the system shall wrap to the last card. When on the last card and navigating Next, the system shall wrap to the first card.

---

## 4. HyperTalk Interpreter

### 4.1 Handlers

**REQ-022** The system shall parse and execute `on mouseUp … end mouseUp` handlers on buttons.

**REQ-023** The system shall parse and execute `on openCard … end openCard` and `on closeCard … end closeCard` handlers on cards.

**REQ-024** The system shall parse and execute `on openStack … end openStack` handlers on the stack.

**REQ-025** The system shall implement HyperTalk's message-passing hierarchy: button → card → background → stack.

### 4.2 Commands

**REQ-027** `go to card <target>` — target may be a name, number, `next`, `prev`, `first`, or `last`.

**REQ-028** `put <expr> into|before|after <container>`.

**REQ-029** `get <expr>` — result stored in `it`.

**REQ-030** `set <property> of <object> to <value>`.

**REQ-031** `ask <prompt>` — modal text input; response stored in `it`.

**REQ-032** `answer <prompt> [with <btn1> [or <btn2> [or <btn3>]]]` — clicked label stored in `it`.

**REQ-033** `play <sound>` — triggers a named WebAudio sound.

**REQ-034** `show <object>` / `hide <object>`.

**REQ-035** `enable <button>` / `disable <button>`.

### 4.3 Expressions and Variables

**REQ-036** Local variables declared implicitly by assignment.

**REQ-037** `&` (concat) and `&&` (concat with space).

**REQ-038** Arithmetic: `+`, `-`, `*`, `/`, `^`, `mod`, `div`.

**REQ-039** Comparison: `=`, `≠` / `<>`, `<`, `>`, `<=`, `>=`.

**REQ-040** Logical: `and`, `or`, `not`.

**REQ-041** Container references: `card field <name>`, `background field <name>`, `me`, `it`.

**REQ-042** `the number of cards` and `the number of <objectType> of card <target>`.

### 4.4 Control Flow

**REQ-043** `if … then … [else if …] [else …] end if` (multi-line) and `if … then <stmt>` (single-line).

**REQ-044** `repeat <n> times … end repeat`.

**REQ-045** `repeat while <condition> … end repeat`.

**REQ-046** `repeat until <condition> … end repeat`.

**REQ-047** `repeat with <var> = <start> to <end> … end repeat`.

**REQ-048** `exit repeat`, `exit <handlerName>`, `next repeat`.

---

## 5. Editor

**REQ-050** The system shall operate in Browse mode or Edit mode, toggled by a visible control.

**REQ-052** In Edit mode, the system shall allow selecting, dragging (8 px grid snap), and resizing objects.

**REQ-054** In Edit mode, the system shall allow creating new buttons and fields by clicking a toolbar icon then clicking the canvas.

**REQ-057** In Edit mode, the system shall display selection handles (7×7 px black squares) around the selected object.

**REQ-058** Pressing Delete or Backspace in Edit mode shall delete the selected object.

**REQ-059** Double-clicking an object in Edit mode shall open the Script Inspector.

**REQ-061** On saving from the Script Inspector, the system shall immediately parse the script and report syntax errors inline.

**REQ-062** When an object is selected in Edit mode, the system shall display a Property Inspector with editable properties.

**REQ-064–066** The system shall provide controls to add, delete (with confirmation), and reorder cards.

---

## 6. Persistence and Sharing

**REQ-067** The system shall auto-save the current stack to `localStorage` on every change.

**REQ-068** On page load without a URL hash, the system shall load the most recently saved stack from `localStorage`, or display the demo stack selector.

**REQ-069** The system shall serialize the stack to JSON, compress with LZ-string, base64url-encode it, and store in the URL hash.

**REQ-070** On page load with a non-empty hash, the system shall decode and load the stack from the hash.

**REQ-071** A "Share Link" button shall copy the current URL to the clipboard.

**REQ-072–073** The system shall support export to `.json` file and import from `.json` file (with confirmation).

---

## 7. Demo Stacks

**REQ-074** Three bundled demo stacks: Séance Deck (Ouija), Welcome to PhantomCard, The Haunted House.

**REQ-075** Each demo stack shall be a valid PhantomCard JSON exported as an ES module in `src/stacks/`.

---

## 8. Audio

**REQ-076** Built-in sounds: `boing`, `harpsichord`, `click`, `creeak`, `thunder`, `whisper`.

**REQ-077** All sounds synthesized via WebAudio API; no external audio files required.

**REQ-078** Unknown sound names fail silently.

---

## 9. Platform

**REQ-079** The system shall use the System 7 monochrome Mac visual language as described in `retro-ui.md`.

**REQ-080** Chicago font (`'Chicago', 'Charcoal', system-ui`) for all UI chrome text.

**REQ-081** Pure client-side ES modules; no bundler; no build step; entry point is `index.html`.

**REQ-082** Runs in current Chrome, Firefox, and Safari without polyfills.

**REQ-083** Deployable to GitHub Pages as a static directory.

---

## 10. Spooky Theming

**REQ-084** Welcome screen displays the PhantomCard name in a ghost-and-card monochrome motif.

**REQ-085** At least one hidden Easter egg: a spooky animation or sound triggered by a specific script sequence.

**REQ-086** Séance Deck includes a functional Ouija board where the planchette animates to the oracle's response.

---

## Acceptance Criteria

| ID | Done When |
|----|-----------|
| AC-01 | Card renders at 512×342 in 1-bit monochrome |
| AC-02 | Clicking a button with `on mouseUp / go to next card / end mouseUp` navigates correctly |
| AC-03 | Dragging an object in Edit mode moves it; position is reflected in serialized JSON |
| AC-04 | Pasting the copied URL in a new tab loads the identical stack |
| AC-05 | `ask "What is your name?"` shows a modal; `it` holds the entered value afterward |
| AC-06 | `play "thunder"` produces an audible synthesized sound |
| AC-07 | Séance Deck loads; planchette animates; answer dialog delivers a response |
| AC-08 | Cloning the repo and opening `index.html` via a static file server works with zero npm steps |
