# How PhantomCard was built with Kiro

PhantomCard was built with **Kiro CLI** (Kiro's terminal agent) during the
Kiroween 2026 hackathon. This file documents the workflow.

## Spec-driven development

Before any application code, we wrote the spec in `.kiro/specs/phantomcard/`:

- `requirements.md` — the contract: data model (stack → cards → objects),
  the HyperTalk grammar surface to support, interaction modes (Browse /
  Authoring), platform constraints.
- `design.md` — architecture: canvas renderer, HyperTalk lexer/parser/
  interpreter pipeline, ES-module layout with zero build step.
- `tasks.md` — the execution plan the agent worked through.

Every later judgment call (e.g. dissolve transitions, the chunk-expression
grammar, the re-entrant message queue) traced back to a spec decision rather
than an ad-hoc prompt.

## Steering rules

`.kiro/steering/` holds the rules Kiro worked under:

- `retro-ui.md` — System-7 monochrome fidelity: 512×342 canvas cards, pixel
  font (Silkscreen), black/white/pattern fills only, classic bevel styles.
- `hypertalk.md` — HyperTalk semantics: English-ish syntax, `on <msg>` /
  `end <msg>` handlers, `it`, `the result`, chunk expressions, `me`.

## What Kiro CLI authored

- The HyperTalk interpreter: lexer, recursive-descent parser, and the async
  interpreter with HyperCard's message hierarchy (object → card → background →
  stack) and re-entrant `send`/`dispatch` semantics.
- The card renderer and dissolve animation, canvas paint layers, dialog and
  menu chrome.
- The authoring-mode tooling (button/field tools, inspectors, script editor).
- All three bundled demo stacks, each itself an authored HyperCard document:
  Welcome, The Séance Deck, The Haunted House.

## Iteration loop

The dissolve-transition bug (animation re-firing on every render, not just
card changes) was found by reviewing a screen recording of the app
frame-by-frame and fixed with a one-line guard — the kind of retro-faithful
detail that spec-driven iteration surfaces.
