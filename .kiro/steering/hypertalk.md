# Steering: HyperTalk Language Semantics

**Applies to:** `src/hypertalk/lexer.js`, `src/hypertalk/parser.js`, `src/hypertalk/interpreter.js`, demo stack scripts, Script Inspector validation.

This document defines how PhantomCard's HyperTalk subset must behave. When implementing or extending the interpreter, treat this document as the normative specification. When in doubt, match what HyperCard 2.4 did on a Mac.

---

## 1. The HyperTalk Mental Model

HyperTalk is an English-like message-passing language. The core idea: **every action is a message sent to an object**. Objects handle messages they understand and pass ones they do not to the next object in the hierarchy.

The message hierarchy is:
```
button (or field, card) → current card → background → stack → (HyperCard itself, not implemented)
```

A handler declared at a higher level catches messages that nothing below it handles. This is not inheritance — it is delegation.

HyperTalk is **case-insensitive** for all keywords, variable names, object names, and handler names. `mouseUp`, `MOUSEUP`, and `Mouseup` are the same.

HyperTalk is **loosely typed**: every value is a string internally. Numbers are strings that happen to look like numbers; `true` and `false` are strings. Coercion happens at the point of use.

---

## 2. Handler Syntax

```
on <handlerName> [<param1>[, <param2>...]]
  <statements>
end <handlerName>
```

Handler names are identifiers. The end tag must match the opening name exactly (case-insensitively). Parameters are local variables initialized from the message's arguments.

Built-in message names that the interpreter must fire automatically:

| Message | Fired when |
|---------|-----------|
| `mouseUp` | User releases mouse button over a button in Browse mode |
| `mouseDown` | User presses mouse button over a button (optional in v1) |
| `openCard` | A card becomes the current card (after the transition) |
| `closeCard` | A card is about to stop being the current card (before transition) |
| `openStack` | A stack is loaded and its first card is about to be shown |

---

## 3. Commands

### `go`

```
go to card <target>
go to <target>     -- "to" is optional
```

Target resolution (in order of precedence):

1. `next` — next card, wrapping.
2. `prev` or `previous` — previous card, wrapping.
3. `first` — card at index 0.
4. `last` — final card.
5. An integer literal — card at that 1-based position.
6. A string expression — card whose `.name` matches (case-insensitive).

If the target cannot be resolved, do nothing and do not throw.

### `put`

```
put <expr> into <dest>
put <expr> before <dest>
put <expr> after <dest>
```

Destinations: a local variable (bare identifier), `it`, `me`, or a field reference:
- `card field <name or number>`
- `background field <name or number>`
- `card field id <id>`

`into` replaces the destination's value.
`before` prepends the string to the destination's current value.
`after` appends the string to the destination's current value.

### `get`

```
get <expr>
```

Evaluates the expression and stores the result in `it`. This is shorthand for `put <expr> into it`.

### `set`

```
set [the] <property> of <object> to <value>
```

Settable properties and their effect:

| Property | Object type | Effect |
|----------|-------------|--------|
| `text` | field | Sets the field's text content |
| `name` | button, field, card | Renames the object |
| `visible` | button, field, label | Shows or hides |
| `enabled` | button | Enables or disables |
| `hilite` | button (checkbox/radio) | Sets checked state |
| `left`, `top` | button, field, label | Moves the object |
| `width`, `height` | button, field, label | Resizes the object |
| `lockText` | field | Locks or unlocks editing |
| `textAlign` | field, label | `left`, `center`, or `right` |

Properties not in this list produce a silent no-op in v1.

### `ask`

```
ask <prompt>
ask <prompt> with <default>
```

Displays a System 7 modal dialog with the prompt text, an editable text field (prepopulated with `default` if provided), and OK / Cancel buttons. Stores the entered text in `it`. If the user cancels, `it` is set to `""`.

### `answer`

```
answer <prompt>
answer <prompt> with <btn1>
answer <prompt> with <btn1> or <btn2>
answer <prompt> with <btn1> or <btn2> or <btn3>
```

Displays a modal dialog with the prompt and up to three buttons. The last button listed (rightmost) is the default. Stores the label of the clicked button in `it`. If Escape is pressed, `it` is set to the label of the leftmost button.

When only one button is specified, it must be labeled. When no buttons are specified, a single OK button is shown.

### `play`

```
play <soundName>
```

`soundName` is a string expression. Valid names: `boing`, `harpsichord`, `click`, `creeak`, `thunder`, `whisper`. Unknown names fail silently.

### `show` / `hide`

```
show <object>
hide <object>
```

Sets `visible` to `true` or `false` on the named object. Object references: `button <name>`, `field <name>`, `card button <name>`, `background field <name>`.

### `enable` / `disable`

```
enable button <name>
disable button <name>
```

Sets `enabled` to `true` or `false` on the named button.

---

## 4. Expressions

### Type coercion rules

HyperTalk treats all values as strings. When an expression needs a number, the runtime converts the string with `parseFloat`. Coercion failures produce `0` (not an error). `true` and `false` as boolean values are case-insensitive strings.

### Operator precedence (high to low)

1. `not` (unary)
2. `^` (power)
3. `*`, `/`, `mod`, `div`
4. `+`, `-`
5. `&`, `&&`
6. `=`, `≠`, `<>`, `<`, `>`, `<=`, `>=`
7. `and`
8. `or`

### String operators

`&` concatenates without separator: `"Hello" & " " & "World"` → `"Hello World"`.
`&&` concatenates with a single space: `"Hello" && "World"` → `"Hello World"`.

### The `it` variable

`it` is a read/write pseudo-variable local to the current handler invocation. `get` and `ask`/`answer` write to it. It persists across statements within one handler invocation but is not shared between handler calls.

### `me`

`me` refers to the object that received the current message. In a button handler, `me` is that button. `me` can be used as the object in `set` and `show`/`hide`:

```
set the name of me to "ghost"
hide me
```

### Container references

```
card field "fieldName"
card field id "fieldId"
card field 1          -- 1-based index
background field "fieldName"
me
it
<variableName>        -- any identifier not matching a keyword
```

### Chunk expressions (optional, implement if time permits)

```
char <n> of <expr>
chars <n> to <m> of <expr>
word <n> of <expr>
words <n> to <m> of <expr>
line <n> of <expr>
lines <n> to <m> of <expr>
item <n> of <expr>   -- comma-delimited
```

Chunk expressions are read-only in v1. If not implemented, the interpreter should emit a clear "chunk expressions not supported" error rather than silently returning wrong results.

---

## 5. Control Flow

### `if`

Single-line form:
```
if <condition> then <statement>
```

Multi-line form:
```
if <condition> then
  <statements>
[else if <condition> then
  <statements>]
[else
  <statements>]
end if
```

The `else if` clause may appear zero or more times. `else` is optional. There is no `else then`.

### `repeat`

Four forms:

```
repeat <n> times
  <body>
end repeat

repeat while <condition>
  <body>
end repeat

repeat until <condition>
  <body>
end repeat

repeat with <var> = <start> to <end> [step <n>]
  <body>
end repeat
```

`repeat with` increments `<var>` from `<start>` to `<end>` inclusive, by 1 (or by `step n` if provided). If `start > end`, the loop does not execute (do not auto-reverse).

**Safety limit:** Any `repeat` loop must abort after 100,000 iterations to prevent infinite loops from hanging the browser. The interpreter should log a console warning when this limit is hit, not throw.

### `exit repeat`

Immediately exits the innermost `repeat` loop.

### `next repeat`

Skips to the next iteration of the innermost `repeat` loop (equivalent to `continue` in other languages).

### `exit <handlerName>`

Exits the named handler immediately. The handler name must match the enclosing handler's name.

---

## 6. Error Handling

### Parse errors

The parser must throw a `ParseError` with:
- `message`: human-readable description
- `line`: 1-based line number in the script source

The Script Inspector must display parse errors inline below the editor.

### Runtime errors

The interpreter must catch all runtime errors and:
1. Stop executing the current handler.
2. Log the error to the browser console with the script context.
3. Display a System 7 styled error alert via `showAnswer` with the message and an OK button.
4. Never propagate an unhandled JS exception to the browser.

This matches HyperCard's behavior: scripts that fail show a dialog, they do not crash the application.

---

## 7. What Is Not Supported (v1)

The following HyperTalk features are intentionally out of scope. Attempting to use them must produce a clear "not supported in PhantomCard" error from the interpreter, not a silent wrong result or a JS crash:

- `send` message to another object
- `do <string>` (dynamic script execution)
- `function` declarations and user-defined functions (only built-in `the number of …` etc.)
- File I/O (`open file`, `read from file`, `write to file`)
- `visual effect` transitions (other than the basic dissolve already implemented)
- `type <string>` keyboard simulation
- `choose tool` (painting/drawing tools)
- `select` command
- Multiple stacks open simultaneously
- `push card` / `pop card` navigation stack
- Networking (`open url`, etc.)
- Chunk expressions as `put` destinations (can be a v2 feature)

When a user writes one of these commands, the interpreter should stop and display: *"PhantomCard doesn't support '<command>' yet."*

---

## 8. Demo Script Examples

These scripts must work correctly and serve as the reference test cases for the interpreter.

### Navigate with wrap

```hypercard
on mouseUp
  go to next card
end mouseUp
```

### Conditional navigation

```hypercard
on mouseUp
  if the number of cards > 1 then
    go to card 1
  else
    answer "This is the only card." with "OK"
  end if
end mouseUp
```

### Field update

```hypercard
on mouseUp
  put "Hello, world!" into card field "greeting"
end mouseUp
```

### Ask and respond

```hypercard
on mouseUp
  ask "What is your name?"
  put "Welcome, " & it & "!" into card field "greeting"
end mouseUp
```

### Animated movement

```hypercard
on mouseUp
  repeat with x = 10 to 200
    set the left of me to x
  end repeat
end mouseUp
```

### Oracle (Séance Deck pattern)

```hypercard
on mouseUp
  put "Yes,Perhaps,No,Ask again,Silence" into answers
  -- pick a pseudo-random answer by using card number as seed
  put the number of cards mod 5 + 1 into idx
  put word idx of answers into oracle   -- simplified; real version uses item
  answer "The spirits say: " & oracle with "Thank the spirits"
  put oracle into card field "response"
  go to card "Oracle Response"
end mouseUp
```

### Sound on card open

```hypercard
on openCard
  play "creeak"
end openCard
```

---

## 9. Interpreter Implementation Notes

- **Async throughout:** Every handler execution must be an async function because `ask` and `answer` are awaited modal dialogs. The interpreter's `execute` method must be `async` and must be awaited at every call site.
- **No `eval`:** The interpreter walks the AST manually. Never call `eval` or `new Function` on user script text.
- **Re-entrancy:** While a handler is executing, button clicks in Browse mode should queue rather than immediately fire another handler, to avoid re-entrant script execution corrupting variable state.
- **Line tracking:** The interpreter should track the current executing line number so runtime errors can cite it.
- **Variable mutation safety:** Variables are stored in a plain `Map` per handler invocation. When a `put … into` targets a field, dispatch a store action; do not mutate the stack object directly from the interpreter.
