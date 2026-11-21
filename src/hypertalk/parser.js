/**
 * HyperTalk Parser
 *
 * Recursive-descent parser that consumes the token stream from the lexer and
 * produces an AST.  Every public node type is documented at the point of
 * production.
 *
 * Entry point:
 *   parse(script: string) → HandlerDef[]
 *
 * Throws ParseError (re-exported from lexer) on syntax errors.
 */

import { tokenize, TT, ParseError } from './lexer.js';

export { ParseError };

// ─── parse() ─────────────────────────────────────────────────────────────────

/**
 * Parse a full script string.
 * Returns an array of HandlerDef nodes (the script may declare multiple handlers).
 *
 * @param {string} script
 * @returns {Array<HandlerDef>}
 */
export function parse(script) {
  const tokens = tokenize(script);
  const parser = new Parser(tokens);
  return parser.parseScript();
}

// ─── Parser class ─────────────────────────────────────────────────────────────

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  // ── Token navigation ────────────────────────────────────────────────────────

  peek(offset = 0) {
    const idx = this.pos + offset;
    return idx < this.tokens.length ? this.tokens[idx] : this.tokens[this.tokens.length - 1];
  }

  advance() {
    const t = this.tokens[this.pos];
    if (t.type !== TT.EOF) this.pos++;
    return t;
  }

  check(type, value = null) {
    const t = this.peek();
    if (t.type !== type) return false;
    if (value !== null && t.value !== value) return false;
    return true;
  }

  match(type, value = null) {
    if (this.check(type, value)) { this.advance(); return true; }
    return false;
  }

  expect(type, value = null) {
    const t = this.peek();
    if (t.type !== type || (value !== null && t.value !== value)) {
      const got = t.value !== null ? `'${t.value}'` : t.type;
      const want = value !== null ? `'${value}'` : type;
      throw new ParseError(`Expected ${want} but got ${got}`, t.line);
    }
    return this.advance();
  }

  // Skip any number of newlines.
  skipNewlines() {
    while (this.check(TT.NEWLINE)) this.advance();
  }

  currentLine() {
    return this.peek().line;
  }

  // ── Script ──────────────────────────────────────────────────────────────────

  /**
   * Script = (NEWLINE | HandlerDef)*  EOF
   */
  parseScript() {
    const handlers = [];
    this.skipNewlines();
    while (!this.check(TT.EOF)) {
      if (this.check(TT.KEYWORD, 'on')) {
        handlers.push(this.parseHandlerDef());
      } else if (this.check(TT.NEWLINE)) {
        this.skipNewlines();
      } else {
        const t = this.peek();
        throw new ParseError(
          `Unexpected '${t.value}' at top level (expected 'on')`,
          t.line
        );
      }
      this.skipNewlines();
    }
    return handlers;
  }

  // ── Handler definition ──────────────────────────────────────────────────────

  /**
   * HandlerDef = 'on' name [params] NEWLINE body 'end' name
   * Node: { type:'HandlerDef', name, params:[], body:[], line }
   */
  parseHandlerDef() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'on');
    const nameToken = this.peek();
    if (nameToken.type !== TT.KEYWORD && nameToken.type !== TT.IDENTIFIER) {
      throw new ParseError(`Expected handler name after 'on'`, nameToken.line);
    }
    const name = this.advance().value; // already lowercased by lexer
    const params = this.parseParamList();
    this.expectNewline();

    const body = this.parseBody(['end']);

    this.expect(TT.KEYWORD, 'end');
    // end tag name can be keyword or identifier
    const endNameToken = this.peek();
    if (endNameToken.type !== TT.KEYWORD && endNameToken.type !== TT.IDENTIFIER) {
      throw new ParseError(`Expected handler name after 'end'`, endNameToken.line);
    }
    const endName = this.advance().value;
    if (endName !== name) {
      throw new ParseError(
        `'end ${endName}' does not match 'on ${name}'`,
        endNameToken.line
      );
    }
    // optional newline after end
    this.skipNewlines();

    return { type: 'HandlerDef', name, params, body, line };
  }

  parseParamList() {
    const params = [];
    while (!this.check(TT.NEWLINE) && !this.check(TT.EOF)) {
      const t = this.peek();
      if (t.type === TT.IDENTIFIER || t.type === TT.KEYWORD) {
        params.push(this.advance().value);
        this.match(TT.COMMA);
      } else {
        break;
      }
    }
    return params;
  }

  expectNewline() {
    if (!this.check(TT.NEWLINE) && !this.check(TT.EOF)) {
      const t = this.peek();
      throw new ParseError(`Expected end of line, got '${t.value}'`, t.line);
    }
    this.skipNewlines();
  }

  // ── Statement body ───────────────────────────────────────────────────────────

  /**
   * Parse statements until a stop keyword is encountered at the current
   * nesting level.  stopKeywords is an array of keyword values.
   */
  parseBody(stopKeywords) {
    const stmts = [];
    this.skipNewlines();
    while (!this.check(TT.EOF)) {
      const t = this.peek();
      if (t.type === TT.KEYWORD && stopKeywords.includes(t.value)) break;
      // Peek for 'else' which also stops a body
      if (t.type === TT.KEYWORD && t.value === 'else') break;
      const stmt = this.parseStatement();
      if (stmt) stmts.push(stmt);
      this.skipNewlines();
    }
    return stmts;
  }

  // ── Statement dispatch ───────────────────────────────────────────────────────

  parseStatement() {
    const t = this.peek();

    if (t.type === TT.NEWLINE) { this.advance(); return null; }

    if (t.type === TT.KEYWORD) {
      switch (t.value) {
        case 'go':       return this.parseGo();
        case 'put':      return this.parsePut();
        case 'get':      return this.parseGet();
        case 'set':      return this.parseSet();
        case 'ask':      return this.parseAsk();
        case 'answer':   return this.parseAnswer();
        case 'play':     return this.parsePlay();
        case 'show':     return this.parseShow();
        case 'hide':     return this.parseHide();
        case 'enable':   return this.parseEnable();
        case 'disable':  return this.parseDisable();
        case 'if':       return this.parseIf();
        case 'repeat':   return this.parseRepeat();
        case 'exit':     return this.parseExit();
        case 'next':     return this.parseNextRepeat();
        case 'pass':     return this.parsePass();
        case 'return':   return this.parseReturn();
        // Unsupported commands that must surface a clear error:
        case 'send':
        case 'do':
        case 'function':
        case 'open':
        case 'write':
        case 'read':
        case 'type':
        case 'choose':
        case 'select':
        case 'push':
        case 'pop':
        case 'visual':
          return this.parseUnsupported(t);
        default:
          // Could be a user-invoked message send: bare identifier
          return this.parseMessageSend();
      }
    }

    if (t.type === TT.IDENTIFIER) {
      return this.parseMessageSend();
    }

    throw new ParseError(`Unexpected token '${t.value}'`, t.line);
  }

  // ── Unsupported command ───────────────────────────────────────────────────────

  parseUnsupported(t) {
    // Consume the rest of the line so the parser can continue.
    const cmd = t.value;
    while (!this.check(TT.NEWLINE) && !this.check(TT.EOF)) this.advance();
    return { type: 'Unsupported', command: cmd, line: t.line };
  }

  // ── go ───────────────────────────────────────────────────────────────────────

  /**
   * go [to] [card] <target>
   * target: next | prev | previous | first | last | <expr>
   * Node: { type:'GoCmd', target, line }
   * target = { kind: 'keyword', value } | { kind: 'expr', expr }
   */
  parseGo() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'go');
    this.match(TT.KEYWORD, 'to');
    this.match(TT.KEYWORD, 'card');

    const t = this.peek();
    let target;
    if (t.type === TT.KEYWORD && ['next','prev','previous','first','last'].includes(t.value)) {
      target = { kind: 'keyword', value: this.advance().value };
      // allow optional trailing 'card': "go to next card"
      this.match(TT.KEYWORD, 'card');
    } else {
      target = { kind: 'expr', expr: this.parseExpr() };
    }
    this.expectNewline();
    return { type: 'GoCmd', target, line };
  }

  // ── put ──────────────────────────────────────────────────────────────────────

  /**
   * put <expr> into|before|after <dest>
   * Node: { type:'PutCmd', expr, prep, dest, line }
   */
  parsePut() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'put');
    const expr = this.parseExpr();
    const prepToken = this.peek();
    if (!['into','before','after'].includes(prepToken.value)) {
      throw new ParseError(`Expected 'into', 'before', or 'after' after put expression`, prepToken.line);
    }
    this.advance();
    const prep = prepToken.value;
    const dest = this.parseDest();
    this.expectNewline();
    return { type: 'PutCmd', expr, prep, dest, line };
  }

  /**
   * Destination for put:
   *   it | me | <identifier> | card field <name/num> | background field <name/num>
   *   | card field id <id>
   */
  parseDest() {
    const line = this.currentLine();
    const t = this.peek();

    if (t.type === TT.KEYWORD && t.value === 'it') {
      this.advance();
      return { type: 'ItRef', line };
    }
    if (t.type === TT.KEYWORD && t.value === 'me') {
      this.advance();
      return { type: 'MeRef', line };
    }

    const layer = this.parseOptionalLayer();
    if (layer !== null || (t.type === TT.KEYWORD && t.value === 'field')) {
      return this.parseFieldRef(layer, line);
    }

    // bare variable
    if (t.type === TT.IDENTIFIER || t.type === TT.KEYWORD) {
      return { type: 'VarRef', name: this.advance().value, line };
    }

    throw new ParseError(`Invalid put destination '${t.value}'`, t.line);
  }

  parseOptionalLayer() {
    const t = this.peek();
    if (t.type === TT.KEYWORD && (t.value === 'card' || t.value === 'background')) {
      this.advance();
      return t.value;
    }
    return null;
  }

  /**
   * field <name | number | id <id>>
   * Returns a FieldRef node.
   */
  parseFieldRef(layer, line) {
    this.expect(TT.KEYWORD, 'field');
    if (this.match(TT.KEYWORD, 'id')) {
      const id = this.parseStringOrNumber();
      return { type: 'FieldRef', layer: layer || 'card', by: 'id', value: id, line };
    }
    const ref = this.parseStringOrNumber();
    const by = typeof ref === 'number' ? 'index' : 'name';
    return { type: 'FieldRef', layer: layer || 'card', by, value: ref, line };
  }

  parseStringOrNumber() {
    const t = this.peek();
    if (t.type === TT.STRING) { this.advance(); return t.value; }
    if (t.type === TT.NUMBER) { this.advance(); return t.value; }
    if (t.type === TT.IDENTIFIER || t.type === TT.KEYWORD) {
      // variable reference — return as a VarExpr node so the interpreter can resolve it
      return { type: 'Identifier', name: this.advance().value };
    }
    throw new ParseError(`Expected field name or number, got '${t.value}'`, t.line);
  }

  // ── get ──────────────────────────────────────────────────────────────────────

  parseGet() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'get');
    const expr = this.parseExpr();
    this.expectNewline();
    return { type: 'GetCmd', expr, line };
  }

  // ── set ──────────────────────────────────────────────────────────────────────

  /**
   * set [the] <property> of <object> to <value>
   * Node: { type:'SetCmd', prop, obj, value, line }
   */
  parseSet() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'set');
    this.match(TT.KEYWORD, 'the');
    const propToken = this.peek();
    if (propToken.type !== TT.KEYWORD && propToken.type !== TT.IDENTIFIER) {
      throw new ParseError(`Expected property name after 'set'`, propToken.line);
    }
    const prop = this.advance().value;
    this.expect(TT.KEYWORD, 'of');
    const obj = this.parseObjectRef();
    this.expect(TT.KEYWORD, 'to');
    const value = this.parseExpr();
    this.expectNewline();
    return { type: 'SetCmd', prop, obj, value, line };
  }

  /**
   * Object reference: me | button <name> | field <name> | card button <name> |
   *   background field <name> | card <name>  (for 'name of card X')
   */
  parseObjectRef() {
    const line = this.currentLine();
    const t = this.peek();

    if (t.type === TT.KEYWORD && t.value === 'me') {
      this.advance();
      return { type: 'MeRef', line };
    }

    const layer = this.parseOptionalLayer(); // 'card' | 'background' | null

    const kind = this.peek();
    if (kind.type === TT.KEYWORD && (kind.value === 'button' || kind.value === 'field')) {
      const objKind = this.advance().value;
      const ref = this.parseStringOrNumber();
      return { type: 'ObjectRef', layer: layer || 'card', kind: objKind, ref, line };
    }

    // 'card' alone means the current card when layer is 'card' and no further kind
    if (layer === 'card') {
      return { type: 'CardRef', line };
    }

    // fall back: bare identifier or keyword = named button on current card
    if (t.type === TT.IDENTIFIER || t.type === TT.KEYWORD) {
      return { type: 'ObjectRef', layer: 'card', kind: 'button', ref: this.advance().value, line };
    }

    throw new ParseError(`Expected object reference, got '${t.value}'`, t.line);
  }

  // ── ask ──────────────────────────────────────────────────────────────────────

  parseAsk() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'ask');
    const prompt = this.parseExpr();
    let defaultVal = null;
    if (this.match(TT.KEYWORD, 'with')) {
      defaultVal = this.parseExpr();
    }
    this.expectNewline();
    return { type: 'AskCmd', prompt, defaultVal, line };
  }

  // ── answer ───────────────────────────────────────────────────────────────────

  parseAnswer() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'answer');
    const prompt = this.parseExpr();
    const buttons = [];
    if (this.match(TT.KEYWORD, 'with')) {
      // Parse the first button expression.  Button expressions must not consume
      // the 'or' separator, so we use parsePrimary-level precedence (no boolean
      // operators).  In practice button labels are always string literals but
      // we allow concat (&/&&) for composed strings.
      buttons.push(this._parseAnswerButtonExpr());
      while (this.match(TT.KEYWORD, 'or')) {
        buttons.push(this._parseAnswerButtonExpr());
        if (buttons.length >= 3) break;
      }
    }
    this.expectNewline();
    return { type: 'AnswerCmd', prompt, buttons, line };
  }

  /**
   * Parse a single button label for the `answer` command.
   * Stops at 'or' (the button separator) but allows concatenation operators.
   */
  _parseAnswerButtonExpr() {
    // Parse at concat precedence so we get "A" & "B" but not "A" or "B".
    let left = this.parseAdd();
    while (this.check(TT.OPERATOR) && (this.peek().value === '&' || this.peek().value === '&&')) {
      const line = this.currentLine();
      const op = this.advance().value;
      const right = this.parseAdd();
      left = { type: 'BinOp', op, left, right, line };
    }
    return left;
  }

  // ── play ─────────────────────────────────────────────────────────────────────

  parsePlay() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'play');
    const sound = this.parseExpr();
    this.expectNewline();
    return { type: 'PlayCmd', sound, line };
  }

  // ── show / hide ───────────────────────────────────────────────────────────────

  parseShow() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'show');
    const obj = this.parseObjectRef();
    this.expectNewline();
    return { type: 'ShowCmd', obj, line };
  }

  parseHide() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'hide');
    const obj = this.parseObjectRef();
    this.expectNewline();
    return { type: 'HideCmd', obj, line };
  }

  // ── enable / disable ─────────────────────────────────────────────────────────

  parseEnable() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'enable');
    const obj = this.parseObjectRef();
    this.expectNewline();
    return { type: 'EnableCmd', obj, line };
  }

  parseDisable() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'disable');
    const obj = this.parseObjectRef();
    this.expectNewline();
    return { type: 'DisableCmd', obj, line };
  }

  // ── if ───────────────────────────────────────────────────────────────────────

  /**
   * Single-line: if <cond> then <stmt>
   * Multi-line:  if <cond> then NEWLINE body [else if … | else …] end if
   * Node: { type:'IfStmt', condition, then:[], elseIfs:[{cond,body}], else:[], line }
   */
  parseIf() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'if');
    const condition = this.parseExpr();
    this.expect(TT.KEYWORD, 'then');

    // Single-line form: 'then' is followed by a statement on the same line.
    if (!this.check(TT.NEWLINE) && !this.check(TT.EOF)) {
      const stmt = this.parseStatement();
      return {
        type: 'IfStmt',
        condition,
        then: stmt ? [stmt] : [],
        elseIfs: [],
        else: [],
        line,
      };
    }

    // Multi-line form
    this.skipNewlines();
    const thenBody = this.parseBody(['end', 'else']);
    const elseIfs = [];
    let elseBody = [];

    while (this.check(TT.KEYWORD, 'else')) {
      this.advance(); // consume 'else'
      if (this.check(TT.KEYWORD, 'if')) {
        this.advance(); // consume 'if'
        const eic = this.parseExpr();
        this.expect(TT.KEYWORD, 'then');
        this.skipNewlines();
        const eib = this.parseBody(['end', 'else']);
        elseIfs.push({ condition: eic, body: eib });
      } else {
        this.skipNewlines();
        elseBody = this.parseBody(['end']);
        break;
      }
    }

    this.expect(TT.KEYWORD, 'end');
    this.expect(TT.KEYWORD, 'if');
    this.expectNewline();

    return { type: 'IfStmt', condition, then: thenBody, elseIfs, else: elseBody, line };
  }

  // ── repeat ───────────────────────────────────────────────────────────────────

  parseRepeat() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'repeat');

    const t = this.peek();

    // repeat while <cond>
    if (t.type === TT.KEYWORD && t.value === 'while') {
      this.advance();
      const condition = this.parseExpr();
      this.expectNewline();
      const body = this.parseBody(['end']);
      this.expect(TT.KEYWORD, 'end');
      this.expect(TT.KEYWORD, 'repeat');
      this.expectNewline();
      return { type: 'RepeatWhile', condition, body, line };
    }

    // repeat until <cond>
    if (t.type === TT.KEYWORD && t.value === 'until') {
      this.advance();
      const condition = this.parseExpr();
      this.expectNewline();
      const body = this.parseBody(['end']);
      this.expect(TT.KEYWORD, 'end');
      this.expect(TT.KEYWORD, 'repeat');
      this.expectNewline();
      return { type: 'RepeatUntil', condition, body, line };
    }

    // repeat with <var> = <start> to <end> [step <n>]
    if (t.type === TT.KEYWORD && t.value === 'with') {
      this.advance();
      const varToken = this.peek();
      if (varToken.type !== TT.IDENTIFIER && varToken.type !== TT.KEYWORD) {
        throw new ParseError(`Expected variable name in 'repeat with'`, varToken.line);
      }
      const variable = this.advance().value;
      this.expect(TT.OPERATOR, '=');
      const start = this.parseExpr();
      this.expect(TT.KEYWORD, 'to');
      const end = this.parseExpr();
      let step = null;
      if (this.check(TT.KEYWORD, 'step') || this.check(TT.IDENTIFIER, 'step')) {
        this.advance();
        step = this.parseExpr();
      }
      this.expectNewline();
      const body = this.parseBody(['end']);
      this.expect(TT.KEYWORD, 'end');
      this.expect(TT.KEYWORD, 'repeat');
      this.expectNewline();
      return { type: 'RepeatWith', variable, start, end, step, body, line };
    }

    // repeat <n> times
    // Also handles bare 'repeat' with an integer
    const count = this.parseExpr();
    // 'times' is optional but typically present
    this.match(TT.KEYWORD, 'times');
    this.expectNewline();
    const body = this.parseBody(['end']);
    this.expect(TT.KEYWORD, 'end');
    this.expect(TT.KEYWORD, 'repeat');
    this.expectNewline();
    return { type: 'RepeatTimes', count, body, line };
  }

  // ── exit / next repeat ────────────────────────────────────────────────────────

  parseExit() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'exit');
    const t = this.peek();
    if (t.type === TT.KEYWORD && t.value === 'repeat') {
      this.advance();
      this.expectNewline();
      return { type: 'ExitRepeat', line };
    }
    // exit <handlerName>
    if (t.type === TT.IDENTIFIER || t.type === TT.KEYWORD) {
      const name = this.advance().value;
      this.expectNewline();
      return { type: 'ExitHandler', name, line };
    }
    throw new ParseError(`Expected 'repeat' or handler name after 'exit'`, t.line);
  }

  parseNextRepeat() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'next');
    this.expect(TT.KEYWORD, 'repeat');
    this.expectNewline();
    return { type: 'NextRepeat', line };
  }

  parsePass() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'pass');
    const t = this.peek();
    const name = (t.type === TT.IDENTIFIER || t.type === TT.KEYWORD) ? this.advance().value : '';
    this.expectNewline();
    return { type: 'PassMsg', name, line };
  }

  parseReturn() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'return');
    // 'return' in a handler (not a function — but parse an optional expr anyway)
    if (!this.check(TT.NEWLINE) && !this.check(TT.EOF)) {
      const expr = this.parseExpr();
      this.expectNewline();
      return { type: 'ReturnStmt', expr, line };
    }
    this.expectNewline();
    return { type: 'ReturnStmt', expr: null, line };
  }

  // ── user-defined message send ─────────────────────────────────────────────────

  parseMessageSend() {
    const line = this.currentLine();
    const name = this.advance().value;
    const args = [];
    if (!this.check(TT.NEWLINE) && !this.check(TT.EOF)) {
      args.push(this.parseExpr());
      while (this.match(TT.COMMA)) {
        args.push(this.parseExpr());
      }
    }
    this.expectNewline();
    return { type: 'MessageSend', name, args, line };
  }

  // ── Expressions ───────────────────────────────────────────────────────────────
  // Precedence (low → high): or and comparison concat add mul unary power primary

  parseExpr() { return this.parseOr(); }

  parseOr() {
    let left = this.parseAnd();
    while (this.check(TT.KEYWORD, 'or')) {
      const line = this.currentLine();
      this.advance();
      const right = this.parseAnd();
      left = { type: 'BinOp', op: 'or', left, right, line };
    }
    return left;
  }

  parseAnd() {
    let left = this.parseComparison();
    while (this.check(TT.KEYWORD, 'and')) {
      const line = this.currentLine();
      this.advance();
      const right = this.parseComparison();
      left = { type: 'BinOp', op: 'and', left, right, line };
    }
    return left;
  }

  parseComparison() {
    let left = this.parseConcat();
    const compOps = ['=', '<>', '≠', '<', '>', '<=', '>='];
    while (this.check(TT.OPERATOR) && compOps.includes(this.peek().value)) {
      const line = this.currentLine();
      const op = this.advance().value;
      const right = this.parseConcat();
      left = { type: 'BinOp', op, left, right, line };
    }
    return left;
  }

  parseConcat() {
    let left = this.parseAdd();
    while (this.check(TT.OPERATOR) && (this.peek().value === '&' || this.peek().value === '&&')) {
      const line = this.currentLine();
      const op = this.advance().value;
      const right = this.parseAdd();
      left = { type: 'BinOp', op, left, right, line };
    }
    return left;
  }

  parseAdd() {
    let left = this.parseMul();
    while (this.check(TT.OPERATOR) && (this.peek().value === '+' || this.peek().value === '-')) {
      const line = this.currentLine();
      const op = this.advance().value;
      const right = this.parseMul();
      left = { type: 'BinOp', op, left, right, line };
    }
    return left;
  }

  parseMul() {
    let left = this.parseUnary();
    const mulOps = ['*', '/', 'mod', 'div'];
    while (
      (this.check(TT.OPERATOR) && (this.peek().value === '*' || this.peek().value === '/')) ||
      (this.check(TT.KEYWORD) && (this.peek().value === 'mod' || this.peek().value === 'div'))
    ) {
      const line = this.currentLine();
      const op = this.advance().value;
      const right = this.parseUnary();
      left = { type: 'BinOp', op, left, right, line };
    }
    return left;
  }

  parseUnary() {
    const line = this.currentLine();
    if (this.check(TT.KEYWORD, 'not')) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryOp', op: 'not', operand, line };
    }
    if (this.check(TT.OPERATOR, '-')) {
      this.advance();
      const operand = this.parseUnary();
      return { type: 'UnaryOp', op: '-', operand, line };
    }
    return this.parsePower();
  }

  parsePower() {
    let base = this.parsePrimary();
    if (this.check(TT.OPERATOR, '^')) {
      const line = this.currentLine();
      this.advance();
      const exp = this.parseUnary(); // right-associative
      return { type: 'BinOp', op: '^', left: base, right: exp, line };
    }
    return base;
  }

  // ── Primary expressions ───────────────────────────────────────────────────────

  parsePrimary() {
    const t = this.peek();
    const line = t.line;

    // Parenthesised expression
    if (t.type === TT.LPAREN) {
      this.advance();
      const expr = this.parseExpr();
      this.expect(TT.RPAREN);
      return expr;
    }

    // String literal
    if (t.type === TT.STRING) {
      this.advance();
      return { type: 'StringLit', value: t.value, line };
    }

    // Number literal
    if (t.type === TT.NUMBER) {
      this.advance();
      return { type: 'NumberLit', value: t.value, line };
    }

    // Boolean literals
    if (t.type === TT.KEYWORD && (t.value === 'true' || t.value === 'false')) {
      this.advance();
      return { type: 'BoolLit', value: t.value === 'true', line };
    }

    // 'me'
    if (t.type === TT.KEYWORD && t.value === 'me') {
      this.advance();
      return { type: 'MeRef', line };
    }

    // 'it'
    if (t.type === TT.KEYWORD && t.value === 'it') {
      this.advance();
      return { type: 'ItRef', line };
    }

    // 'the number of cards'
    if (t.type === TT.KEYWORD && t.value === 'the') {
      return this.parseTheExpr();
    }

    // Chunk expression keywords: char/chars/word/words/line/lines/item/items
    if (t.type === TT.KEYWORD && ['char','word','line','item'].includes(t.value)) {
      return this.parseChunkExpr();
    }
    // plural forms arrive as IDENTIFIER after the keyword-set change
    if (t.type === TT.IDENTIFIER && ['chars','words','lines','items'].includes(t.value)) {
      return this.parseChunkExpr();
    }

    // 'card field …' or 'background field …' as an rvalue
    if (t.type === TT.KEYWORD && (t.value === 'card' || t.value === 'background')) {
      const savedPos = this.pos;
      const layer = this.advance().value;
      if (this.check(TT.KEYWORD, 'field')) {
        return this.parseFieldRef(layer, line);
      }
      // Not a field ref — restore and fall through to identifier
      this.pos = savedPos;
    }

    // 'field' by itself (default card layer)
    if (t.type === TT.KEYWORD && t.value === 'field') {
      return this.parseFieldRef('card', line);
    }

    // Identifier (variable)
    if (t.type === TT.IDENTIFIER) {
      this.advance();
      return { type: 'Identifier', name: t.value, line };
    }

    // Keyword used as identifier (e.g. variable named after a command)
    // This is a catch-all for keywords that might appear in expression position
    // through unusual scripts.
    if (t.type === TT.KEYWORD) {
      this.advance();
      return { type: 'Identifier', name: t.value, line };
    }

    throw new ParseError(`Unexpected token '${t.value}' in expression`, t.line);
  }

  // 'the number of cards' | 'the number of <something>'
  parseTheExpr() {
    const line = this.currentLine();
    this.expect(TT.KEYWORD, 'the');
    const propToken = this.peek();
    if (propToken.type !== TT.KEYWORD && propToken.type !== TT.IDENTIFIER) {
      throw new ParseError(`Expected property after 'the'`, propToken.line);
    }
    const prop = this.advance().value;

    // 'the number of cards' or 'the number of <something>'
    if (prop === 'number') {
      this.expect(TT.KEYWORD, 'of');
      const ofWhat = this.peek().value;
      this.advance();
      // 'the number of <chunk> of <expr>' — e.g. items/lines/words/chars of omens
      const chunkKinds = ['char','chars','word','words','line','lines','item','items'];
      if (chunkKinds.includes(ofWhat) && this.check(TT.KEYWORD, 'of')) {
        this.advance();
        const container = this.parseExpr();
        return { type: 'FunctionCall', name: 'theNumberOf', arg: ofWhat, container, line };
      }
      return { type: 'FunctionCall', name: 'theNumberOf', arg: ofWhat, line };
    }

    // Generic 'the <property> of <object>'
    if (this.check(TT.KEYWORD, 'of')) {
      this.advance();
      const obj = this.parseObjectRef();
      return { type: 'PropertyRef', prop, obj, line };
    }

    // 'the <property>' with implied object
    return { type: 'PropertyRef', prop, obj: null, line };
  }

  // Chunk expression: char/word/line/item <n> [to <m>] of <expr>
  parseChunkExpr() {
    const line = this.currentLine();
    // Both singular (KEYWORD) and plural (IDENTIFIER) forms arrive here.
    const kind = this.advance().value; // char|word|line|item (or plural)
    const startExpr = this.parseExpr();
    let endExpr = null;
    if (this.match(TT.KEYWORD, 'to')) {
      endExpr = this.parseExpr();
    }
    this.expect(TT.KEYWORD, 'of');
    const container = this.parseExpr();
    return { type: 'ChunkExpr', kind, start: startExpr, end: endExpr, container, line };
  }
}
