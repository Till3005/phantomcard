/**
 * HyperTalk Interpreter
 *
 * Walks the AST produced by the parser and executes it.  Fully async so that
 * ask/answer can await modal dialogs.  No eval, no new Function.
 *
 * Usage:
 *   import { Interpreter } from './hypertalk/interpreter.js';
 *
 *   const interp = new Interpreter(runtime);
 *   await interp.executeHandler('mouseUp', context);
 *
 * Runtime object expected by the constructor:
 *   {
 *     stack,            // Stack data object (see data model)
 *     getCurrentCard,   // () → Card
 *     getCurrentCardIndex, // () → number
 *     dispatch,         // (action) → void
 *     audio,            // { playSound(name) }
 *     dialogs,          // { showAsk(prompt,def) → Promise<string>,
 *                       //   showAnswer(prompt, buttons[]) → Promise<string> }
 *   }
 *
 * Context object passed to execute/executeHandler:
 *   {
 *     currentObject,    // the button/field/card/background object that owns the script
 *     scriptSource,     // raw script text (for error display)
 *   }
 */

import { parse, ParseError } from './parser.js';

export { ParseError };

// ─── Control-flow sentinels ──────────────────────────────────────────────────
// These are thrown as values (not Errors) to implement non-local exits from
// nested loops and handlers.  The interpreter catches them at the right level.

class ExitRepeatSignal {
  constructor() { this.type = 'ExitRepeat'; }
}
class NextRepeatSignal {
  constructor() { this.type = 'NextRepeat'; }
}
class ExitHandlerSignal {
  constructor(name) { this.type = 'ExitHandler'; this.name = name; }
}
class PassMsgSignal {
  constructor(name) { this.type = 'PassMsg'; this.name = name; }
}

// ─── Runtime error ───────────────────────────────────────────────────────────

class RuntimeError extends Error {
  constructor(message, line) {
    super(message);
    this.name = 'RuntimeError';
    this.line = line;
  }
}

// ─── Interpreter ─────────────────────────────────────────────────────────────

export class Interpreter {
  /**
   * @param {object} runtime
   */
  constructor(runtime) {
    this.runtime = runtime;
    // Re-entrancy guard: while a handler is running, queue new execute calls.
    this._executing = false;
    this._queue = [];
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Parse `script` and execute the handler named `handlerName` if present.
   * Delegates through the message hierarchy if not found on the given context.
   *
   * @param {string} handlerName
   * @param {object} context  { currentObject, scriptSource? }
   * @param {string[]} [args]
   */
  async executeHandler(handlerName, context, args = []) {
    if (this._executing) {
      // Queue for later execution.
      return new Promise((resolve) => {
        this._queue.push({ handlerName, context, args, resolve });
      });
    }

    this._executing = true;
    try {
      await this._runHandlerInHierarchy(handlerName, context, args);
    } finally {
      this._executing = false;
      if (this._queue.length > 0) {
        const next = this._queue.shift();
        // Kick off the next queued execution (not awaited here — it will manage itself).
        this.executeHandler(next.handlerName, next.context, next.args)
          .then(next.resolve)
          .catch(next.resolve);
      }
    }
  }

  /**
   * Parse and execute an arbitrary script string directly (used by the
   * Script Inspector "run" action and by demo stacks to fire openStack).
   *
   * @param {string} script
   * @param {object} context
   */
  async execute(script, context) {
    let handlers;
    try {
      handlers = parse(script);
    } catch (e) {
      await this._handleError(e, context);
      return;
    }
    for (const handler of handlers) {
      await this._runHandler(handler, [], context);
    }
  }

  // ── Message hierarchy ────────────────────────────────────────────────────────

  async _runHandlerInHierarchy(handlerName, context, args) {
    const { stack } = this.runtime;
    const card = this.runtime.getCurrentCard();
    const { currentObject } = context;

    // Build the lookup chain: object → card → background → stack
    const scripts = [];

    if (currentObject && currentObject.script) {
      scripts.push({ script: currentObject.script, label: currentObject.name || 'object' });
    }
    if (card && card.script) {
      scripts.push({ script: card.script, label: `card "${card.name}"` });
    }
    if (stack.background && stack.background.script) {
      scripts.push({ script: stack.background.script, label: 'background' });
    }
    if (stack.script) {
      scripts.push({ script: stack.script, label: 'stack' });
    }

    for (const { script, label } of scripts) {
      if (!script || !script.trim()) continue;
      let handlers;
      try {
        handlers = parse(script);
      } catch (e) {
        await this._handleError(e, { ...context, scriptSource: script, scriptLabel: label });
        return;
      }
      const handler = handlers.find(
        (h) => h.name === handlerName.toLowerCase()
      );
      if (!handler) continue;

      const passed = await this._runHandler(handler, args, { ...context, scriptSource: script });
      if (!passed) return; // handler consumed the message
    }
    // Message not handled — silently drop (HyperTalk behavior)
  }

  /**
   * Execute a single HandlerDef node.
   * Returns true if the handler used `pass`, false otherwise.
   */
  async _runHandler(handler, args, context) {
    const locals = new Map();
    locals.set('it', '');

    // Bind params
    for (let i = 0; i < handler.params.length; i++) {
      locals.set(handler.params[i], i < args.length ? String(args[i]) : '');
    }

    const execCtx = {
      locals,
      handlerName: handler.name,
      currentLine: handler.line,
      context,
    };

    try {
      await this._execBody(handler.body, execCtx);
    } catch (sig) {
      if (sig instanceof ExitHandlerSignal) {
        // Normal early exit
        return false;
      }
      if (sig instanceof PassMsgSignal) {
        return true; // pass to next level
      }
      if (sig instanceof RuntimeError) {
        await this._handleError(sig, context);
        return false;
      }
      if (sig instanceof ExitRepeatSignal || sig instanceof NextRepeatSignal) {
        // These should have been caught by the repeat loop; if they escape it
        // means they were used outside a loop — treat as runtime error.
        await this._handleError(
          new RuntimeError(`'${sig.type === 'ExitRepeat' ? 'exit repeat' : 'next repeat'}' outside a repeat loop`, execCtx.currentLine),
          context
        );
        return false;
      }
      // Unexpected JS error
      await this._handleError(sig, context);
      return false;
    }
    return false;
  }

  // ── Statement execution ──────────────────────────────────────────────────────

  async _execBody(stmts, ctx) {
    for (const stmt of stmts) {
      ctx.currentLine = stmt.line;
      await this._execStmt(stmt, ctx);
    }
  }

  async _execStmt(node, ctx) {
    switch (node.type) {
      case 'GoCmd':       return this._execGo(node, ctx);
      case 'PutCmd':      return this._execPut(node, ctx);
      case 'GetCmd':      return this._execGet(node, ctx);
      case 'SetCmd':      return this._execSet(node, ctx);
      case 'AskCmd':      return this._execAsk(node, ctx);
      case 'AnswerCmd':   return this._execAnswer(node, ctx);
      case 'PlayCmd':     return this._execPlay(node, ctx);
      case 'ShowCmd':     return this._execShow(node, ctx);
      case 'HideCmd':     return this._execHide(node, ctx);
      case 'EnableCmd':   return this._execEnable(node, ctx);
      case 'DisableCmd':  return this._execDisable(node, ctx);
      case 'IfStmt':      return this._execIf(node, ctx);
      case 'RepeatTimes': return this._execRepeatTimes(node, ctx);
      case 'RepeatWhile': return this._execRepeatWhile(node, ctx);
      case 'RepeatUntil': return this._execRepeatUntil(node, ctx);
      case 'RepeatWith':  return this._execRepeatWith(node, ctx);
      case 'ExitRepeat':  throw new ExitRepeatSignal();
      case 'NextRepeat':  throw new NextRepeatSignal();
      case 'ExitHandler': throw new ExitHandlerSignal(node.name);
      case 'PassMsg':     throw new PassMsgSignal(node.name);
      case 'ReturnStmt':  throw new ExitHandlerSignal(ctx.handlerName);
      case 'MessageSend': return this._execMessageSend(node, ctx);
      case 'Unsupported': return this._execUnsupported(node, ctx);
      default:
        throw new RuntimeError(`Unknown statement type '${node.type}'`, node.line);
    }
  }

  // ── go ───────────────────────────────────────────────────────────────────────

  async _execGo(node, ctx) {
    const { stack } = this.runtime;
    const order = stack.cardOrder;
    const currentIdx = this.runtime.getCurrentCardIndex();
    const count = order.length;
    if (count === 0) return;

    let targetIdx;
    const { target } = node;

    if (target.kind === 'keyword') {
      switch (target.value) {
        case 'next':     targetIdx = (currentIdx + 1) % count; break;
        case 'prev':
        case 'previous': targetIdx = (currentIdx - 1 + count) % count; break;
        case 'first':    targetIdx = 0; break;
        case 'last':     targetIdx = count - 1; break;
      }
    } else {
      const val = await this._evalExpr(target.expr, ctx);
      const num = parseFloat(val);
      if (!isNaN(num) && Number.isInteger(num)) {
        // 1-based
        targetIdx = Math.round(num) - 1;
      } else {
        // Name lookup (case-insensitive)
        const lower = String(val).toLowerCase();
        targetIdx = order.findIndex((id) => {
          const card = stack.cards[id];
          return card && card.name.toLowerCase() === lower;
        });
      }
    }

    if (targetIdx === undefined || targetIdx < 0 || targetIdx >= count) return; // silently do nothing

    this.runtime.dispatch({ type: 'SET_CARD', index: targetIdx });
  }

  // ── put ──────────────────────────────────────────────────────────────────────

  async _execPut(node, ctx) {
    const value = await this._evalExpr(node.expr, ctx);
    const { prep, dest } = node;

    if (dest.type === 'ItRef' || (dest.type === 'VarRef' && dest.name === 'it')) {
      ctx.locals.set('it', applyPrep(ctx.locals.get('it') || '', prep, value));
      return;
    }
    if (dest.type === 'MeRef') {
      // 'put X into me' sets the text of the current object if it's a field.
      const obj = ctx.context.currentObject;
      if (obj && obj.kind === 'field') {
        const newText = applyPrep(obj.text || '', prep, value);
        this._patchObject(obj, { text: newText });
      }
      return;
    }
    if (dest.type === 'VarRef') {
      const current = ctx.locals.get(dest.name) || '';
      ctx.locals.set(dest.name, applyPrep(current, prep, value));
      return;
    }
    if (dest.type === 'FieldRef') {
      const obj = this._resolveFieldRef(dest, ctx);
      if (!obj) return; // silently do nothing if field not found
      const newText = applyPrep(obj.text || '', prep, value);
      this._patchObject(obj, { text: newText });
      return;
    }

    throw new RuntimeError(`Cannot put into '${dest.type}'`, node.line);
  }

  // ── get ──────────────────────────────────────────────────────────────────────

  async _execGet(node, ctx) {
    const value = await this._evalExpr(node.expr, ctx);
    ctx.locals.set('it', String(value));
  }

  // ── set ──────────────────────────────────────────────────────────────────────

  async _execSet(node, ctx) {
    const value = await this._evalExpr(node.value, ctx);
    const obj = this._resolveObjectRef(node.obj, ctx);
    if (!obj) return; // silent no-op for unresolved objects

    const prop = node.prop.toLowerCase();
    const patch = this._buildPropPatch(prop, value, obj, node.line);
    if (patch !== null) {
      this._patchObject(obj, patch);
    }
    // Properties not in the known list → silent no-op
  }

  _buildPropPatch(prop, value, obj, line) {
    switch (prop) {
      case 'text':      return { text: String(value) };
      case 'name':      return { name: String(value) };
      case 'visible':   return { visible: toBool(value) };
      case 'enabled':   return { enabled: toBool(value) };
      case 'hilite':    return { hilite: toBool(value) };
      case 'left':      return { left: toNum(value) };
      case 'top':       return { top: toNum(value) };
      case 'width':     return { width: toNum(value) };
      case 'height':    return { height: toNum(value) };
      case 'locktext':  return { lockText: toBool(value) };
      case 'textalign': return { textAlign: String(value) };
      default:          return null; // silent no-op
    }
  }

  // ── ask ──────────────────────────────────────────────────────────────────────

  async _execAsk(node, ctx) {
    const prompt = await this._evalExpr(node.prompt, ctx);
    const def = node.defaultVal ? await this._evalExpr(node.defaultVal, ctx) : '';
    const result = await this.runtime.dialogs.showAsk(String(prompt), String(def));
    ctx.locals.set('it', result !== null ? String(result) : '');
  }

  // ── answer ───────────────────────────────────────────────────────────────────

  async _execAnswer(node, ctx) {
    const prompt = await this._evalExpr(node.prompt, ctx);
    const buttons = [];
    for (const b of node.buttons) {
      buttons.push(await this._evalExpr(b, ctx));
    }
    if (buttons.length === 0) buttons.push('OK');
    const result = await this.runtime.dialogs.showAnswer(String(prompt), buttons.map(String));
    ctx.locals.set('it', result !== null ? String(result) : (buttons[0] || 'OK'));
  }

  // ── play ─────────────────────────────────────────────────────────────────────

  async _execPlay(node, ctx) {
    const name = await this._evalExpr(node.sound, ctx);
    this.runtime.audio.playSound(String(name));
  }

  // ── show / hide / enable / disable ───────────────────────────────────────────

  async _execShow(node, ctx) {
    const obj = this._resolveObjectRef(node.obj, ctx);
    if (obj) this._patchObject(obj, { visible: true });
  }

  async _execHide(node, ctx) {
    const obj = this._resolveObjectRef(node.obj, ctx);
    if (obj) this._patchObject(obj, { visible: false });
  }

  async _execEnable(node, ctx) {
    const obj = this._resolveObjectRef(node.obj, ctx);
    if (obj) this._patchObject(obj, { enabled: true });
  }

  async _execDisable(node, ctx) {
    const obj = this._resolveObjectRef(node.obj, ctx);
    if (obj) this._patchObject(obj, { enabled: false });
  }

  // ── if ───────────────────────────────────────────────────────────────────────

  async _execIf(node, ctx) {
    const cond = await this._evalExpr(node.condition, ctx);
    if (toBool(cond)) {
      await this._execBody(node.then, ctx);
      return;
    }
    for (const ei of node.elseIfs) {
      const eic = await this._evalExpr(ei.condition, ctx);
      if (toBool(eic)) {
        await this._execBody(ei.body, ctx);
        return;
      }
    }
    if (node.else && node.else.length > 0) {
      await this._execBody(node.else, ctx);
    }
  }

  // ── repeat ───────────────────────────────────────────────────────────────────

  static REPEAT_LIMIT = 100_000;

  async _execRepeatTimes(node, ctx) {
    const countVal = await this._evalExpr(node.count, ctx);
    let n = toNum(countVal);
    let iters = 0;
    while (n-- > 0) {
      if (++iters > Interpreter.REPEAT_LIMIT) {
        console.warn('HyperTalk: repeat loop exceeded 100,000 iterations — aborting');
        break;
      }
      try {
        await this._execBody(node.body, ctx);
      } catch (sig) {
        if (sig instanceof ExitRepeatSignal) break;
        if (sig instanceof NextRepeatSignal) continue;
        throw sig;
      }
    }
  }

  async _execRepeatWhile(node, ctx) {
    let iters = 0;
    while (toBool(await this._evalExpr(node.condition, ctx))) {
      if (++iters > Interpreter.REPEAT_LIMIT) {
        console.warn('HyperTalk: repeat while loop exceeded 100,000 iterations — aborting');
        break;
      }
      try {
        await this._execBody(node.body, ctx);
      } catch (sig) {
        if (sig instanceof ExitRepeatSignal) break;
        if (sig instanceof NextRepeatSignal) continue;
        throw sig;
      }
    }
  }

  async _execRepeatUntil(node, ctx) {
    let iters = 0;
    while (!toBool(await this._evalExpr(node.condition, ctx))) {
      if (++iters > Interpreter.REPEAT_LIMIT) {
        console.warn('HyperTalk: repeat until loop exceeded 100,000 iterations — aborting');
        break;
      }
      try {
        await this._execBody(node.body, ctx);
      } catch (sig) {
        if (sig instanceof ExitRepeatSignal) break;
        if (sig instanceof NextRepeatSignal) continue;
        throw sig;
      }
    }
  }

  async _execRepeatWith(node, ctx) {
    const startVal = toNum(await this._evalExpr(node.start, ctx));
    const endVal   = toNum(await this._evalExpr(node.end,   ctx));
    const stepVal  = node.step ? toNum(await this._evalExpr(node.step, ctx)) : 1;

    if (stepVal === 0) {
      throw new RuntimeError("'repeat with' step cannot be zero", node.line);
    }

    let iters = 0;
    let i = startVal;

    // If start > end (and positive step), do not execute.
    while (stepVal > 0 ? i <= endVal : i >= endVal) {
      if (++iters > Interpreter.REPEAT_LIMIT) {
        console.warn('HyperTalk: repeat with loop exceeded 100,000 iterations — aborting');
        break;
      }
      ctx.locals.set(node.variable, String(i));
      try {
        await this._execBody(node.body, ctx);
      } catch (sig) {
        if (sig instanceof ExitRepeatSignal) break;
        if (sig instanceof NextRepeatSignal) { i += stepVal; continue; }
        throw sig;
      }
      i += stepVal;
    }
  }

  // ── user message send ─────────────────────────────────────────────────────────

  async _execMessageSend(node, ctx) {
    const args = [];
    for (const a of node.args) {
      args.push(await this._evalExpr(a, ctx));
    }
    // Try to run the named handler starting from the current object.
    // We don't want to trigger the re-entrancy guard here because we're
    // already inside an execution; call _runHandlerInHierarchy directly.
    await this._runHandlerInHierarchy(node.name, ctx.context, args);
  }

  // ── unsupported commands ──────────────────────────────────────────────────────

  async _execUnsupported(node, ctx) {
    const msg = `PhantomCard doesn't support '${node.command}' yet.`;
    throw new RuntimeError(msg, node.line);
  }

  // ── Expression evaluation ─────────────────────────────────────────────────────

  async _evalExpr(node, ctx) {
    switch (node.type) {
      case 'StringLit':  return node.value;
      case 'NumberLit':  return String(node.value);
      case 'BoolLit':    return node.value ? 'true' : 'false';
      case 'ItRef':      return ctx.locals.get('it') || '';
      case 'MeRef':      return this._evalMe(ctx);
      case 'Identifier': return this._evalIdentifier(node, ctx);
      case 'BinOp':      return this._evalBinOp(node, ctx);
      case 'UnaryOp':    return this._evalUnaryOp(node, ctx);
      case 'FieldRef':   return this._evalFieldRef(node, ctx);
      case 'FunctionCall': return this._evalFunctionCall(node, ctx);
      case 'PropertyRef':  return this._evalPropertyRef(node, ctx);
      case 'ChunkExpr':    return this._evalChunkExpr(node, ctx);
      default:
        throw new RuntimeError(`Cannot evaluate node type '${node.type}'`, node.line);
    }
  }

  _evalMe(ctx) {
    const obj = ctx.context.currentObject;
    if (!obj) return '';
    // Return a string representation; the interpreter uses MeRef at the
    // statement level (set/show/hide) to look up the object, not its value.
    return obj.name || '';
  }

  _evalIdentifier(node, ctx) {
    const name = node.name;
    if (ctx.locals.has(name)) return ctx.locals.get(name);
    // Not a local variable — return the name itself as a string (HyperTalk
    // treats undefined variables as the empty string, but unknown barewords
    // that aren't variables are returned as their name in some HyperCard
    // contexts; we return '' to stay safe).
    return '';
  }

  async _evalBinOp(node, ctx) {
    const op = node.op;

    // Short-circuit operators
    if (op === 'and') {
      const l = await this._evalExpr(node.left, ctx);
      if (!toBool(l)) return 'false';
      const r = await this._evalExpr(node.right, ctx);
      return toBool(r) ? 'true' : 'false';
    }
    if (op === 'or') {
      const l = await this._evalExpr(node.left, ctx);
      if (toBool(l)) return 'true';
      const r = await this._evalExpr(node.right, ctx);
      return toBool(r) ? 'true' : 'false';
    }

    const l = await this._evalExpr(node.left, ctx);
    const r = await this._evalExpr(node.right, ctx);

    switch (op) {
      case '+':   return String(toNum(l) + toNum(r));
      case '-':   return String(toNum(l) - toNum(r));
      case '*':   return String(toNum(l) * toNum(r));
      case '/': {
        const divisor = toNum(r);
        if (divisor === 0) throw new RuntimeError('Division by zero', node.line);
        return String(toNum(l) / divisor);
      }
      case 'mod': return String(toNum(l) % toNum(r));
      case 'div': return String(Math.trunc(toNum(l) / toNum(r)));
      case '^':   return String(Math.pow(toNum(l), toNum(r)));
      case '&':   return String(l) + String(r);
      case '&&':  return String(l) + ' ' + String(r);
      case '=':   return compareHT(l, r) === 0 ? 'true' : 'false';
      case '<>':
      case '≠':   return compareHT(l, r) !== 0 ? 'true' : 'false';
      case '<':   return compareHT(l, r) <  0 ? 'true' : 'false';
      case '>':   return compareHT(l, r) >  0 ? 'true' : 'false';
      case '<=':  return compareHT(l, r) <= 0 ? 'true' : 'false';
      case '>=':  return compareHT(l, r) >= 0 ? 'true' : 'false';
      default:
        throw new RuntimeError(`Unknown operator '${op}'`, node.line);
    }
  }

  async _evalUnaryOp(node, ctx) {
    const val = await this._evalExpr(node.operand, ctx);
    if (node.op === 'not') return toBool(val) ? 'false' : 'true';
    if (node.op === '-')   return String(-toNum(val));
    throw new RuntimeError(`Unknown unary operator '${node.op}'`, node.line);
  }

  _evalFieldRef(node, ctx) {
    const obj = this._resolveFieldRef(node, ctx);
    return obj ? (obj.text || '') : '';
  }

  _evalFunctionCall(node, ctx) {
    if (node.name === 'theNumberOf') {
      const what = node.arg.toLowerCase();
      if (what === 'cards') {
        return String(this.runtime.stack.cardOrder.length);
      }
      // 'the number of buttons', etc. — not implemented, return 0
      return '0';
    }
    throw new RuntimeError(`Unknown function '${node.name}'`, node.line);
  }

  async _evalPropertyRef(node, ctx) {
    // 'the <property> of <object>' or 'the <property>'
    const { prop, obj } = node;
    const resolved = obj ? this._resolveObjectRef(obj, ctx) : ctx.context.currentObject;
    if (!resolved) return '';

    switch (prop.toLowerCase()) {
      case 'text':      return resolved.text || '';
      case 'name':      return resolved.name || '';
      case 'visible':   return resolved.visible !== false ? 'true' : 'false';
      case 'enabled':   return resolved.enabled !== false ? 'true' : 'false';
      case 'hilite':    return resolved.hilite ? 'true' : 'false';
      case 'left':      return String(resolved.left || 0);
      case 'top':       return String(resolved.top || 0);
      case 'width':     return String(resolved.width || 0);
      case 'height':    return String(resolved.height || 0);
      case 'locktext':  return resolved.lockText ? 'true' : 'false';
      case 'textalign': return resolved.textAlign || 'left';
      default:          return '';
    }
  }

  async _evalChunkExpr(node, ctx) {
    const startIdx = toNum(await this._evalExpr(node.start, ctx));
    const endIdx   = node.end ? toNum(await this._evalExpr(node.end, ctx)) : startIdx;
    const str      = await this._evalExpr(node.container, ctx);
    const kind     = node.kind;

    return extractChunk(kind, Math.round(startIdx), Math.round(endIdx), String(str), node.line);
  }

  // ── Object resolution helpers ─────────────────────────────────────────────────

  /**
   * Resolve a FieldRef node to the actual object in the stack.
   */
  _resolveFieldRef(ref, ctx) {
    const { stack } = this.runtime;
    const card = this.runtime.getCurrentCard();

    const pool = [];

    if (ref.layer === 'card' || ref.layer === undefined) {
      if (card) {
        for (const id of (card.objectOrder || [])) {
          const o = card.objects[id];
          if (o && o.kind === 'field') pool.push(o);
        }
      }
    }
    if (ref.layer === 'background') {
      if (stack.background) {
        for (const id of (stack.background.objectOrder || [])) {
          const o = stack.background.objects[id];
          if (o && o.kind === 'field') pool.push(o);
        }
      }
    }

    return this._findInPool(pool, ref);
  }

  /**
   * Resolve an ObjectRef / MeRef / CardRef node.
   */
  _resolveObjectRef(ref, ctx) {
    if (!ref) return null;
    if (ref.type === 'MeRef') return ctx.context.currentObject || null;
    if (ref.type === 'CardRef') return this.runtime.getCurrentCard() || null;
    if (ref.type !== 'ObjectRef') return null;

    const { stack } = this.runtime;
    const card = this.runtime.getCurrentCard();
    const { layer, kind } = ref;

    const pool = [];
    if (layer === 'card' || layer === undefined) {
      if (card) {
        for (const id of (card.objectOrder || [])) {
          const o = card.objects[id];
          if (o && (!kind || o.kind === kind)) pool.push(o);
        }
      }
    }
    if (layer === 'background') {
      if (stack.background) {
        for (const id of (stack.background.objectOrder || [])) {
          const o = stack.background.objects[id];
          if (o && (!kind || o.kind === kind)) pool.push(o);
        }
      }
    }

    return this._findInPool(pool, ref);
  }

  /**
   * Find an object from a pool by name, index, or id.
   * ref.ref may be a string (name), a number (1-based index), or a VarExpr.
   */
  _findInPool(pool, ref) {
    const r = ref.ref !== undefined ? ref.ref : ref.value;

    if (r === undefined || r === null) return pool[0] || null;

    // VarExpr from parser — currently we don't have a ctx here, so return null.
    // The main paths always pass resolved strings/numbers from parseStringOrNumber.
    if (typeof r === 'object' && r.type === 'Identifier') return null;

    if (typeof r === 'number' || (typeof r === 'string' && /^\d+(\.\d+)?$/.test(r))) {
      const idx = Math.round(Number(r)) - 1; // 1-based → 0-based
      return pool[idx] || null;
    }

    // Name lookup (case-insensitive)
    const lower = String(r).toLowerCase();
    return pool.find((o) => o.name && o.name.toLowerCase() === lower) || null;
  }

  // ── Dispatch helper ───────────────────────────────────────────────────────────

  /**
   * Patch an object via the store dispatcher.
   * Finds which card (or background) the object lives in first.
   */
  _patchObject(obj, patch) {
    const { stack } = this.runtime;
    const card = this.runtime.getCurrentCard();

    // Check card objects
    if (card && card.objects[obj.id]) {
      this.runtime.dispatch({
        type: 'UPDATE_OBJECT',
        cardId: card.id,
        objectId: obj.id,
        patch,
      });
      return;
    }

    // Check background objects
    if (stack.background && stack.background.objects[obj.id]) {
      this.runtime.dispatch({
        type: 'UPDATE_OBJECT',
        cardId: '__background__',
        objectId: obj.id,
        patch,
      });
      return;
    }

    // Object is the card itself (name, etc.)
    if (card && card.id === obj.id) {
      this.runtime.dispatch({ type: 'UPDATE_CARD', cardId: card.id, patch });
    }
  }

  // ── Error handling ────────────────────────────────────────────────────────────

  async _handleError(err, context) {
    const label = (context && context.scriptLabel) ? context.scriptLabel : 'script';
    const lineInfo = err.line ? ` (line ${err.line})` : '';
    console.error(`HyperTalk error in ${label}${lineInfo}:`, err.message || err);

    if (this.runtime.dialogs && this.runtime.dialogs.showAnswer) {
      try {
        await this.runtime.dialogs.showAnswer(
          `Script error${lineInfo}:\n${err.message || String(err)}`,
          ['OK']
        );
      } catch (_) {
        // If the dialog itself throws, swallow it — we must never let an error
        // propagate out of the interpreter.
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a HyperTalk string value to a JS number.
 * Returns 0 on failure (matches HyperCard's coercion behaviour).
 */
function toNum(val) {
  const n = parseFloat(String(val));
  return isNaN(n) ? 0 : n;
}

/**
 * Convert a HyperTalk string value to a JS boolean.
 * 'true' (case-insensitive) → true; everything else → false.
 * Non-zero numbers also coerce to true.
 */
function toBool(val) {
  const s = String(val).toLowerCase();
  if (s === 'true') return true;
  if (s === 'false') return false;
  const n = parseFloat(s);
  return !isNaN(n) && n !== 0;
}

/**
 * HyperTalk comparison: numeric when both sides look like numbers, else
 * case-insensitive string comparison.
 */
function compareHT(a, b) {
  const na = parseFloat(a), nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb)) return na < nb ? -1 : na > nb ? 1 : 0;
  const sa = String(a).toLowerCase(), sb = String(b).toLowerCase();
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * Apply a put preposition.
 */
function applyPrep(current, prep, value) {
  switch (prep) {
    case 'into':   return String(value);
    case 'before': return String(value) + String(current);
    case 'after':  return String(current) + String(value);
    default:       return String(value);
  }
}

/**
 * Extract a chunk from a string.
 * kind: char|chars|word|words|line|lines|item|items
 * start/end are 1-based, inclusive.
 */
function extractChunk(kind, start, end, str, line) {
  const base = kind.replace(/s$/, ''); // normalize plural

  let parts;
  switch (base) {
    case 'char':
      parts = [...str]; // Unicode-safe split
      break;
    case 'word':
      parts = str.match(/\S+/g) || [];
      break;
    case 'line':
      parts = str.split('\n');
      break;
    case 'item':
      parts = str.split(',');
      break;
    default:
      throw new RuntimeError(`Chunk expression '${kind}' is not supported in PhantomCard.`, line);
  }

  const s = Math.max(0, start - 1);        // 1-based → 0-based
  const e = Math.min(parts.length, end);   // end is inclusive
  const slice = parts.slice(s, e);

  if (base === 'char') return slice.join('');
  if (base === 'item') return slice.join(',');
  return slice.join(' ');
}
