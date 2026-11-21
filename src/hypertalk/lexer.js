/**
 * HyperTalk Lexer
 *
 * Produces a flat token array from a script string.
 * All keywords are matched case-insensitively; identifiers are lowercased so
 * the rest of the pipeline never has to worry about case.
 *
 * Token types:
 *   KEYWORD | IDENTIFIER | STRING | NUMBER | OPERATOR | NEWLINE | EOF
 *   LPAREN  | RPAREN     | COMMA
 */

// ─── Token type constants ────────────────────────────────────────────────────

export const TT = Object.freeze({
  KEYWORD:    'KEYWORD',
  IDENTIFIER: 'IDENTIFIER',
  STRING:     'STRING',
  NUMBER:     'NUMBER',
  OPERATOR:   'OPERATOR',
  LPAREN:     'LPAREN',
  RPAREN:     'RPAREN',
  COMMA:      'COMMA',
  NEWLINE:    'NEWLINE',
  EOF:        'EOF',
});

// ─── Keyword set ─────────────────────────────────────────────────────────────
// All lowercase — comparisons always happen after lowercasing the source text.
//
// Note: plural chunk keywords (chars, words, lines, items) are intentionally
// NOT in this set.  They are matched in the parser only when the singular form
// is expected.  Keeping them as identifiers prevents them from being mistaken
// for the start of a chunk expression when used as plain variable names.

const KEYWORDS = new Set([
  'on', 'end', 'go', 'to', 'card', 'next', 'prev', 'previous', 'first',
  'last', 'put', 'into', 'before', 'after', 'get', 'set', 'of', 'the',
  'if', 'then', 'else', 'repeat', 'while', 'until', 'with', 'times',
  'exit', 'pass', 'return', 'ask', 'answer', 'or', 'play', 'show', 'hide',
  'enable', 'disable', 'me', 'it', 'true', 'false', 'and', 'not', 'mod',
  'div', 'number', 'cards', 'background', 'field', 'button', 'stack',
  'step', 'id', 'by', 'function', 'send', 'do', 'open', 'write', 'read',
  'type', 'choose', 'select', 'push', 'pop', 'visual', 'effect',
  // singular chunk expression keywords only
  'char', 'word', 'line', 'item',
]);

// Multi-character operators that must be matched before their single-char prefixes.
const MULTI_OPS = ['<>', '<=', '>=', '&&', '≠'];

// ─── ParseError ──────────────────────────────────────────────────────────────

export class ParseError extends Error {
  constructor(message, line) {
    super(message);
    this.name = 'ParseError';
    this.line = line;
  }
}

// ─── Token factory ───────────────────────────────────────────────────────────

function tok(type, value, line) {
  return { type, value, line };
}

// ─── Lexer ───────────────────────────────────────────────────────────────────

/**
 * @param {string} source
 * @returns {Array<{type:string, value:string|number, line:number}>}
 */
export function tokenize(source) {
  const tokens = [];
  let pos = 0;
  let line = 1;

  function peek(offset = 0) { return source[pos + offset]; }
  function advance() { return source[pos++]; }
  function atEnd() { return pos >= source.length; }

  while (!atEnd()) {
    const ch = peek();

    // ── Newline ──────────────────────────────────────────────────────────────
    if (ch === '\r' || ch === '\n') {
      // Merge consecutive newlines into one token; \r\n counts as one.
      let last = tokens[tokens.length - 1];
      if (!last || last.type !== TT.NEWLINE) {
        tokens.push(tok(TT.NEWLINE, '\n', line));
      }
      if (ch === '\r' && peek(1) === '\n') advance(); // \r\n
      advance();
      line++;
      continue;
    }

    // ── Whitespace (not newline) ──────────────────────────────────────────────
    if (ch === ' ' || ch === '\t') {
      advance();
      continue;
    }

    // ── HyperTalk line comment: -- ────────────────────────────────────────────
    if (ch === '-' && peek(1) === '-') {
      while (!atEnd() && peek() !== '\n' && peek() !== '\r') advance();
      continue;
    }

    // ── String literal (double-quoted) ───────────────────────────────────────
    if (ch === '"') {
      advance(); // consume opening quote
      let str = '';
      while (!atEnd() && peek() !== '"') {
        if (peek() === '\n' || peek() === '\r') {
          throw new ParseError('Unterminated string literal', line);
        }
        str += advance();
      }
      if (atEnd()) throw new ParseError('Unterminated string literal', line);
      advance(); // consume closing quote
      tokens.push(tok(TT.STRING, str, line));
      continue;
    }

    // ── Number literal ────────────────────────────────────────────────────────
    if ((ch >= '0' && ch <= '9') || (ch === '-' && peek(1) >= '0' && peek(1) <= '9' && (tokens.length === 0 || ['OPERATOR','KEYWORD','LPAREN','COMMA','NEWLINE'].includes(tokens[tokens.length-1].type)))) {
      let num = '';
      if (ch === '-') num += advance();
      while (!atEnd() && ((peek() >= '0' && peek() <= '9') || peek() === '.')) {
        num += advance();
      }
      tokens.push(tok(TT.NUMBER, parseFloat(num), line));
      continue;
    }

    // ── Multi-character operators ─────────────────────────────────────────────
    let matchedOp = null;
    for (const op of MULTI_OPS) {
      if (source.startsWith(op, pos)) {
        matchedOp = op;
        break;
      }
    }
    if (matchedOp) {
      tokens.push(tok(TT.OPERATOR, matchedOp, line));
      pos += matchedOp.length;
      continue;
    }

    // ── Single-character operators / punctuation ──────────────────────────────
    if ('+-*/^=<>&(),.'.includes(ch)) {
      if (ch === '(') { advance(); tokens.push(tok(TT.LPAREN, '(', line)); continue; }
      if (ch === ')') { advance(); tokens.push(tok(TT.RPAREN, ')', line)); continue; }
      if (ch === ',') { advance(); tokens.push(tok(TT.COMMA,  ',', line)); continue; }
      if (ch === '.') {
        // Could be part of a number if next char is digit, but we handle that above.
        advance(); tokens.push(tok(TT.OPERATOR, '.', line)); continue;
      }
      tokens.push(tok(TT.OPERATOR, ch, line));
      advance();
      continue;
    }

    // ── Unicode not-equal ─────────────────────────────────────────────────────
    if (ch === '≠') {
      tokens.push(tok(TT.OPERATOR, '≠', line));
      advance();
      continue;
    }

    // ── Identifier or keyword ─────────────────────────────────────────────────
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let word = '';
      while (!atEnd() && (/[a-zA-Z0-9_]/.test(peek()))) {
        word += advance();
      }
      const lower = word.toLowerCase();
      if (KEYWORDS.has(lower)) {
        tokens.push(tok(TT.KEYWORD, lower, line));
      } else {
        tokens.push(tok(TT.IDENTIFIER, lower, line));
      }
      continue;
    }

    // ── Unknown character — skip with a warning ───────────────────────────────
    console.warn(`HyperTalk lexer: unexpected character '${ch}' at line ${line}`);
    advance();
  }

  tokens.push(tok(TT.EOF, null, line));
  return tokens;
}
