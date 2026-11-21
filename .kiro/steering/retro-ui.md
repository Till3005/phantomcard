# Steering: Authentic System 7 Visual Conventions

**Applies to:** All UI chrome, card canvas, objects, dialogs, and editor panels in PhantomCard.

This document is the authoritative reference for visual style. When an implementation detail is not covered here, default to what original System 7 / HyperCard 2.x looked like on a Macintosh SE or Classic — sharp, dense, and monochrome.

---

## 1. The One Rule

**Everything visible uses only #000000 (black) and #FFFFFF (white), plus the dithered patterns that simulate gray.**

No CSS color values other than `#000000` and `#FFFFFF` may appear on the card canvas or on any object rendered within a card. Inspector panels and toolbar chrome may use `#888888` for disabled/secondary text only. No gradients. No drop shadows using rgba. No anti-aliased text on the card canvas (use `image-rendering: pixelated` on any scaled bitmap; use `-webkit-font-smoothing: none` on canvas text).

---

## 2. Typography

### Fonts

| Context | Font stack |
|---------|------------|
| All UI chrome (toolbar, menus, dialogs) | `'Chicago', 'Charcoal', system-ui, sans-serif` |
| Default card object text | `'Geneva', 'Helvetica Neue', Helvetica, sans-serif` |
| Script Inspector editor | `'Monaco', 'Courier New', monospace` |
| Small labels (9 pt) | `'Cairo', 'Geneva', sans-serif` |

Chicago is a bitmap font; if it is not available on the user's system, the CSS fallback is used. Never substitute a proportional font with decorative or serif characteristics.

### Sizes

| Context | Size |
|---------|------|
| Menu bar / toolbar text | 12 px |
| Dialog body text | 12 px |
| Dialog title (if any) | 12 px bold |
| Button labels | 12 px |
| Field default | 12 px |
| Scroll bar labels | 10 px |

No sub-pixel font sizes. All sizes are integer pixel values.

### Rendering

Apply these CSS rules to the card canvas and all objects within it:

```css
.card-canvas, .card-canvas * {
  -webkit-font-smoothing: none;
  font-smoothing: none;
  text-rendering: optimizeSpeed;
}
```

---

## 3. The Card Canvas

```css
.card-canvas {
  width: 512px;
  height: 342px;
  background-color: #ffffff;
  position: relative;
  overflow: hidden;
  box-shadow: 2px 2px 0 #000000;   /* the classic Mac window shadow */
  image-rendering: pixelated;
}
```

The canvas always has a 1 px black border. The surrounding "desktop" area behind the canvas is a dithered medium gray — implemented as a CSS `background-image` with a 2×2 checkerboard pattern:

```css
#app {
  background-color: #888;
  background-image: url("data:image/svg+xml,...");  /* 2×2 checkerboard SVG */
  /* or: repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 0 0 / 2px 2px */
}
```

---

## 4. Buttons

All button styles share these base rules:

```css
.hc-button {
  font-family: 'Chicago', 'Charcoal', system-ui;
  font-size: 12px;
  color: #000000;
  background-color: #ffffff;
  cursor: default;        /* HyperCard uses an arrow cursor, not pointer */
  user-select: none;
  outline: none;
}
.hc-button:disabled {
  color: #888888;         /* dithered gray text for disabled state */
}
```

Style-specific rules:

| Style | Border / appearance |
|-------|---------------------|
| `rectangle` | `border: 1px solid #000` |
| `roundRect` | `border: 1px solid #000; border-radius: 4px` |
| `shadow` | `border: 1px solid #000; box-shadow: 2px 2px 0 #000` |
| `transparent` | `border: none; background: transparent` |
| `oval` | `border: 1px solid #000; border-radius: 50%` |
| `checkbox` | Native checkbox, `-webkit-appearance: none`, custom 12×12 px square drawn in CSS |
| `radio` | Native radio, `-webkit-appearance: none`, custom 12×12 px circle drawn in CSS |

**Default button (dialog default action):** 3 px black border with 2 px gap from the button face — the classic Mac "I am the default" ring:

```css
.hc-button.default-button {
  outline: 3px solid #000;
  outline-offset: 2px;
}
```

**Pressed state:** Invert colors (black fill, white text):

```css
.hc-button:active {
  background-color: #000000;
  color: #ffffff;
}
```

---

## 5. Fields

```css
.hc-field {
  font-family: 'Geneva', 'Helvetica Neue', Helvetica, sans-serif;
  font-size: 12px;
  color: #000;
  background: transparent;
  resize: none;
  outline: none;
}
.hc-field.rectangle  { border: 1px solid #000; background: #fff; }
.hc-field.shadow     { border: 1px solid #000; background: #fff; box-shadow: 2px 2px 0 #000; }
.hc-field.opaque     { border: none; background: #fff; }
.hc-field.transparent{ border: none; background: transparent; }
.hc-field.scrolling  { border: 1px solid #000; background: #fff; overflow-y: scroll; }
```

**Scrollbar:** When style is `scrolling`, use a custom CSS scrollbar styled to match System 7:

```css
.hc-field.scrolling::-webkit-scrollbar { width: 15px; }
.hc-field.scrolling::-webkit-scrollbar-track { background: #fff; border-left: 1px solid #000; }
.hc-field.scrolling::-webkit-scrollbar-thumb {
  background: repeating-linear-gradient(
    45deg, #000 0px, #000 1px, #fff 1px, #fff 2px
  );
  border: 1px solid #000;
}
.hc-field.scrolling::-webkit-scrollbar-button { background: #fff; border: 1px solid #000; height: 15px; }
```

---

## 6. Dialogs

System 7 dialogs are centered, have a 1 px black border with an outer 1 px black shadow line (not a CSS blur shadow — a hard offset):

```css
.hc-dialog {
  border: 1px solid #000;
  box-shadow: 2px 2px 0 #000;
  background: #fff;
  padding: 16px;
  min-width: 240px;
  font-family: 'Chicago', 'Charcoal', system-ui;
  font-size: 12px;
}
```

Dialog icon: a 32×32 px monochrome SVG caution diamond or note icon in the top-left, matching the System 7 alert icon appearance.

Button row: right-aligned, 3 px gap between buttons. The default action button (rightmost or explicitly marked) has the 3 px default-button ring.

No close box, no title bar on alert/ask dialogs. Plain white background.

---

## 7. Menus

The menu bar strip is 20 px tall with a 1 px black bottom border. Menu items are 12 px Chicago. The active/open menu has an inverted (black background, white text) selected item.

Dropdown menus:
- 1 px black border
- White background
- Each item: 20 px tall, 12 px font, left-padded 16 px
- Hover state: black fill, white text (invert)
- Separator: 1 px black horizontal rule
- Disabled item: 50% dithered gray text (`color: #888888`)

---

## 8. Selection and Edit Mode Indicators

**Selection frame:** 1 px black dashed border around selected object (not CSS `outline`, which can clip; use a sibling `<div>` absolutely positioned 1 px outside the object bounds).

**Selection handles:** 7×7 px squares, `background: #000`, positioned at all 8 anchor points.

**Edit mode indicator:** The toolbar border changes to a thicker 2 px black bottom line, and the word "Edit" is shown in the mode toggle with an inset appearance (black background, white text, 1 px inset border — the classic Mac pressed state).

---

## 9. Cursors

| Context | Cursor CSS |
|---------|-----------|
| Browse mode (over button) | `cursor: default` (System 7 arrow, not `pointer`) |
| Browse mode (over editable field) | `cursor: text` |
| Edit mode (over object) | `cursor: move` |
| Edit mode (over resize handle) | `cursor: se-resize` |
| Edit mode (canvas background) | `cursor: crosshair` when creation intent active; else `cursor: default` |

HyperCard uses the arrow cursor for clickable buttons; do not use `cursor: pointer` (the hand cursor) in Browse mode.

---

## 10. What to Avoid

These are common modern CSS patterns that break the System 7 illusion. Do not use:

- Any color other than `#000` and `#fff` on the card canvas (gray must be dithered patterns)
- `border-radius` values greater than 4 px (even `roundRect` only uses 4 px)
- CSS `filter`, `blur`, or `opacity` other than 0 or 1 (except for the 300 ms dissolve transition)
- `box-shadow` with blur radius (use `box-shadow: 2px 2px 0 #000` only — zero blur)
- Transition animations other than the card-to-card dissolve
- SVG icons with strokes heavier than 1 px
- Font sizes below 9 px or above 24 px
- `cursor: pointer` anywhere
- Material Design, iOS, or Fluent-inspired UI patterns
- Any external CSS framework

---

## 11. Reference Screenshots (conceptual)

When in doubt, ask: does this look like it was designed on a Mac SE in 1989?

A correct PhantomCard screen has:
- Sharp 1 px black lines everywhere
- No gradients, no shadows with blur
- Dense 12 px Chicago text
- Pure white backgrounds and pure black foregrounds
- That specific System 7 "heavy but simple" feeling
