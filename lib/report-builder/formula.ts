/* ────────────────────────────────────────────────────────────────────────── */
/*  Formula columns — tokenizer → recursive-descent parser → evaluator.       */
/*                                                                            */
/*  Mirror of LC_PIZZA_DATA app/Reports/Engine/Formula/*. The server stays    */
/*  authoritative (it re-validates at save and at run); this copy only gives  */
/*  live feedback in the builder and the sample evaluation. No `eval`, no     */
/*  `Function`, no React.                                                     */
/*                                                                            */
/*  Language v1:                                                              */
/*    numbers 12  3.5  .5   strings 'a' "b" (\ escapes)   null                */
/*    column ids c1, c2 …   + - * / %   ( )   = != < <= > >=   and or not     */
/*    round(x[,n]) abs(x) min(…) max(…) sum(…) avg(…) coalesce(…)             */
/*    if(cond,a,b) concat(…) len(s) upper(s) lower(s) percent(a,b)            */
/*  Keywords and function names are case-insensitive; column ids are not.    */
/*  Null operands and division by zero give null; so does a text result     */
/*  over 32,767 characters (the Excel cell maximum). round() keeps 0..10      */
/*  decimals. The only limit is nesting depth 64 (parentheses + calls).       */
/* ────────────────────────────────────────────────────────────────────────── */

const FORMULA_MAX_DEPTH = 64;

const TWO_ARGS = 2;
const THREE_ARGS = 3;
const PERCENT_SCALE = 100;
/** `round` keeps 0..10 decimals, like the PHP engine. */
const ROUND_MAX_DIGITS = 10;
/** A string result longer than this is null, like the PHP engine. */
const MAX_STRING_LENGTH = 32_767;
const DECIMAL_BASE = 10;

export type FormulaValue = number | string | boolean | null;

/** Stable codes so the UI can translate; `message` is the English text the server also uses. */
type FormulaErrorCode =
  | "empty"
  | "too_deep"
  | "unexpected_char"
  | "unterminated_string"
  | "unexpected_token"
  | "unexpected_end"
  | "expected_token"
  | "unknown_function"
  | "bad_arity"
  | "unknown_column"
  | "cycle";

export interface FormulaError {
  code: FormulaErrorCode;
  message: string;
  /** 0-based character offset into the expression. */
  position: number;
  params?: Record<string, string | number>;
}

type BinaryOp = "+" | "-" | "*" | "/" | "%" | "=" | "!=" | "<" | "<=" | ">" | ">=" | "and" | "or";
type UnaryOp = "-" | "+" | "not";

interface NumberNode { kind: "number"; value: number; pos: number }
interface StringNode { kind: "string"; value: string; pos: number }
interface NullNode { kind: "null"; pos: number }
interface ColumnNode { kind: "column"; id: string; pos: number }
interface UnaryNode { kind: "unary"; op: UnaryOp; operand: FormulaNode; pos: number }
interface BinaryNode { kind: "binary"; op: BinaryOp; left: FormulaNode; right: FormulaNode; pos: number }
interface CallNode { kind: "call"; name: FunctionName; args: FormulaNode[]; pos: number }

type FormulaNode = NumberNode | StringNode | NullNode | ColumnNode | UnaryNode | BinaryNode | CallNode;

type ParseResult =
  | { ast: FormulaNode; error?: undefined }
  | { ast?: undefined; error: FormulaError };

/* ── Functions and their arity (max Infinity = variadic) ─────────────────── */

interface Arity {
  min: number;
  max: number;
}

const ARITY = {
  round: { min: 1, max: TWO_ARGS },
  abs: { min: 1, max: 1 },
  min: { min: 1, max: Infinity },
  max: { min: 1, max: Infinity },
  sum: { min: 1, max: Infinity },
  avg: { min: 1, max: Infinity },
  coalesce: { min: 1, max: Infinity },
  if: { min: THREE_ARGS, max: THREE_ARGS },
  concat: { min: 1, max: Infinity },
  len: { min: 1, max: 1 },
  upper: { min: 1, max: 1 },
  lower: { min: 1, max: 1 },
  percent: { min: TWO_ARGS, max: TWO_ARGS },
} as const satisfies Record<string, Arity>;

type FunctionName = keyof typeof ARITY;
export const FORMULA_FUNCTIONS = Object.keys(ARITY) as FunctionName[];

const isFunctionName = (name: string): name is FunctionName =>
  Object.prototype.hasOwnProperty.call(ARITY, name);

type Keyword = "and" | "or" | "not" | "null";
const KEYWORDS: ReadonlySet<string> = new Set(["and", "or", "not", "null"]);
const COMPARISONS: ReadonlySet<string> = new Set(["=", "!=", "<", "<=", ">", ">="]);

/* ── Tokenizer ──────────────────────────────────────────────────────────── */

type Token =
  | { t: "num"; v: number; pos: number }
  | { t: "str"; v: string; pos: number }
  | { t: "ident"; v: string; pos: number }
  | { t: "kw"; v: Keyword; pos: number }
  | { t: "op"; v: string; pos: number }
  | { t: "eof"; pos: number };

class FormulaSyntaxError extends Error {
  constructor(public readonly detail: FormulaError) {
    super(detail.message);
  }
}

function fail(
  code: FormulaErrorCode,
  message: string,
  position: number,
  params?: FormulaError["params"],
): never {
  throw new FormulaSyntaxError({ code, message, position, params });
}

// One token per match, so consecutive matches cover the whole input. Groups:
// 1 whitespace, 2 number, 3 quoted string, 4 identifier, 5 operator, 6 any other
// character. "round(c1, 2.5)" splits into round ( c1 , 2.5 ); "#" lands in
// group 6 and is rejected; an unclosed "'abc" leaves its quote in group 6.
// Tester: https://regex101.com/?flavor=javascript&regex=(%5Cs%2B)%7C(%5Cd%2B(%3F%3A%5C.%5Cd%2B)%3F%7C%5C.%5Cd%2B)&testString=round(c1%2C%202.5)
const TOKEN_RE = /(\s+)|(\d+(?:\.\d+)?|\.\d+)|('(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*")|([A-Za-z_][A-Za-z0-9_]*)|(!=|<=|>=|[-+*/%()=<>,])|([\s\S])/g;

// A backslash and the character after it: "\'" becomes "'", "\\" becomes "\";
// a lone "a" is left alone. Tester: https://regex101.com/?flavor=javascript&regex=%5C%5C(%5B%5Cs%5CS%5D)&testString=it%5C's
const ESCAPE_RE = /\\([\s\S])/g;

function toToken(m: RegExpMatchArray): Token | null {
  const pos = m.index ?? 0;
  const [, space, num, str, ident, op, other] = m;
  if (space !== undefined) return null;
  if (num !== undefined) return { t: "num", v: Number(num), pos };
  if (str !== undefined) return { t: "str", v: str.slice(1, -1).replace(ESCAPE_RE, "$1"), pos };
  if (ident !== undefined) {
    const lower = ident.toLowerCase();
    return KEYWORDS.has(lower) ? { t: "kw", v: lower as Keyword, pos } : { t: "ident", v: ident, pos };
  }
  if (op !== undefined) return { t: "op", v: op, pos };
  if (other === "'" || other === '"') return fail("unterminated_string", "Unterminated string", pos);
  return fail("unexpected_char", `Unexpected character "${other}"`, pos, { char: other ?? "" });
}

function tokenize(src: string): Token[] {
  const tokens = [...src.matchAll(TOKEN_RE)]
    .map(toToken)
    .filter((tok): tok is Token => tok !== null);
  return [...tokens, { t: "eof", pos: src.length }];
}

/* ── Parser ─────────────────────────────────────────────────────────────── */
/*                                                                            */
/*  or     := and ('or' and)*                                                 */
/*  and    := not ('and' not)*                                                */
/*  not    := 'not' not | cmp                                                 */
/*  cmp    := add (('='|'!='|'<'|'<='|'>'|'>=') add)?                         */
/*  add    := mul (('+'|'-') mul)*                                            */
/*  mul    := unary (('*'|'/'|'%') unary)*                                    */
/*  unary  := ('-'|'+') unary | primary                                       */
/*  primary:= num | str | null | ident '(' args? ')' | ident | '(' or ')'     */

const DESCRIBE: { [K in Token["t"]]: (tok: Extract<Token, { t: K }>) => string } = {
  eof: () => "end of expression",
  num: (tok) => String(tok.v),
  str: (tok) => `'${tok.v}'`,
  ident: (tok) => `"${tok.v}"`,
  kw: (tok) => `"${tok.v}"`,
  op: (tok) => `"${tok.v}"`,
};

function describe(tok: Token): string {
  return (DESCRIBE[tok.t] as (t: Token) => string)(tok);
}

function arityText({ min, max }: Arity): string {
  if (min === max) return String(min);
  if (max === Infinity) return `${min}+`;
  return `${min}-${max}`;
}

class Parser {
  private i = 0;
  private depth = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.i];
  }

  private next(): Token {
    const tok = this.tokens[this.i];
    this.i += 1;
    return tok;
  }

  private opAhead(ops: readonly string[]): string | null {
    const tok = this.peek();
    return tok.t === "op" && ops.includes(tok.v) ? tok.v : null;
  }

  private kwAhead(kw: Keyword): boolean {
    const tok = this.peek();
    return tok.t === "kw" && tok.v === kw;
  }

  private expectOp(v: string): void {
    const tok = this.peek();
    if (tok.t === "op" && tok.v === v) {
      this.i += 1;
      return;
    }
    if (tok.t === "eof")
      fail("unexpected_end", `Expected "${v}" but the expression ended`, tok.pos, { expected: v });
    fail("expected_token", `Expected "${v}" but found ${describe(tok)}`, tok.pos, {
      expected: v,
      found: describe(tok),
    });
  }

  private nested<T>(pos: number, body: () => T): T {
    this.depth += 1;
    if (this.depth > FORMULA_MAX_DEPTH)
      fail("too_deep", `Nesting is deeper than ${FORMULA_MAX_DEPTH} levels`, pos, { max: FORMULA_MAX_DEPTH });
    const out = body();
    this.depth -= 1;
    return out;
  }

  /** `operand (op operand)*`, folded to the left. */
  private leftAssoc(operand: () => FormulaNode, match: () => BinaryOp | null): FormulaNode {
    const step = (left: FormulaNode): FormulaNode => {
      const op = match();
      if (!op) return left;
      const pos = this.next().pos;
      return step({ kind: "binary", op, left, right: operand(), pos });
    };
    return step(operand());
  }

  parse(): FormulaNode {
    const node = this.or();
    const tok = this.peek();
    if (tok.t !== "eof")
      fail("unexpected_token", `Unexpected ${describe(tok)}`, tok.pos, { found: describe(tok) });
    return node;
  }

  private or(): FormulaNode {
    return this.leftAssoc(
      () => this.and(),
      () => (this.kwAhead("or") ? "or" : null),
    );
  }

  private and(): FormulaNode {
    return this.leftAssoc(
      () => this.not(),
      () => (this.kwAhead("and") ? "and" : null),
    );
  }

  private not(): FormulaNode {
    if (!this.kwAhead("not")) return this.cmp();
    const pos = this.next().pos;
    return { kind: "unary", op: "not", operand: this.not(), pos };
  }

  private cmp(): FormulaNode {
    const left = this.add();
    const tok = this.peek();
    if (tok.t !== "op" || !COMPARISONS.has(tok.v)) return left;
    this.i += 1;
    return { kind: "binary", op: tok.v as BinaryOp, left, right: this.add(), pos: tok.pos };
  }

  private add(): FormulaNode {
    return this.leftAssoc(
      () => this.mul(),
      () => this.opAhead(["+", "-"]) as BinaryOp | null,
    );
  }

  private mul(): FormulaNode {
    return this.leftAssoc(
      () => this.unary(),
      () => this.opAhead(["*", "/", "%"]) as BinaryOp | null,
    );
  }

  private unary(): FormulaNode {
    const op = this.opAhead(["-", "+"]);
    if (!op) return this.primary();
    const pos = this.next().pos;
    return { kind: "unary", op: op as UnaryOp, operand: this.unary(), pos };
  }

  /** Comma-separated arguments up to (not including) the closing parenthesis. */
  private args(): FormulaNode[] {
    if (this.opAhead([")"])) return [];
    const more = (acc: FormulaNode[]): FormulaNode[] => {
      if (!this.opAhead([","])) return acc;
      this.i += 1;
      return more([...acc, this.or()]);
    };
    return more([this.or()]);
  }

  private call(tok: { v: string; pos: number }): FormulaNode {
    const name = tok.v.toLowerCase();
    if (!isFunctionName(name)) return fail("unknown_function", `Unknown function "${tok.v}"`, tok.pos, { name: tok.v });
    this.i += 1; // the "("
    const args = this.nested(tok.pos, () => {
      const list = this.args();
      this.expectOp(")");
      return list;
    });
    const arity: Arity = ARITY[name];
    if (args.length < arity.min || args.length > arity.max) {
      const expected = arityText(arity);
      fail("bad_arity", `${name}() takes ${expected} argument(s), got ${args.length}`, tok.pos, {
        name,
        expected,
        got: args.length,
      });
    }
    return { kind: "call", name, args, pos: tok.pos };
  }

  private primary(): FormulaNode {
    const tok = this.next();
    if (tok.t === "num") return { kind: "number", value: tok.v, pos: tok.pos };
    if (tok.t === "str") return { kind: "string", value: tok.v, pos: tok.pos };
    if (tok.t === "kw" && tok.v === "null") return { kind: "null", pos: tok.pos };
    if (tok.t === "eof") return fail("unexpected_end", "The expression ended too early", tok.pos);
    if (tok.t === "ident")
      return this.opAhead(["("]) ? this.call(tok) : { kind: "column", id: tok.v, pos: tok.pos };
    if (tok.t === "op" && tok.v === "(")
      return this.nested(tok.pos, () => {
        const inner = this.or();
        this.expectOp(")");
        return inner;
      });
    return fail("unexpected_token", `Unexpected ${describe(tok)}`, tok.pos, { found: describe(tok) });
  }
}

/** Parse one expression. Never throws. */
function parseFormula(expr: string): ParseResult {
  if (!expr || !expr.trim()) return { error: { code: "empty", message: "The expression is empty", position: 0 } };
  try {
    return { ast: new Parser(tokenize(expr)).parse() };
  } catch (err) {
    if (err instanceof FormulaSyntaxError) return { error: err.detail };
    throw err;
  }
}

/* ── References and validation across columns ───────────────────────────── */

/** Every node of the tree, depth-first, root first. */
function nodesOf(n: FormulaNode): FormulaNode[] {
  if (n.kind === "unary") return [n, ...nodesOf(n.operand)];
  if (n.kind === "binary") return [n, ...nodesOf(n.left), ...nodesOf(n.right)];
  if (n.kind === "call") return [n, ...n.args.flatMap(nodesOf)];
  return [n];
}

const columnNodes = (ast: FormulaNode): ColumnNode[] =>
  nodesOf(ast).filter((n): n is ColumnNode => n.kind === "column");

/** Column ids the expression reads, in first-seen order. */
function referencedColumns(ast: FormulaNode): string[] {
  return [...new Set(columnNodes(ast).map((n) => n.id))];
}

function firstReferencePos(ast: FormulaNode, id: string): number {
  return columnNodes(ast).find((n) => n.id === id)?.pos ?? 0;
}

interface FormulaColumnLike {
  id: string;
  expr: string;
}

interface Checked {
  id: string;
  ast?: FormulaNode;
  error?: FormulaError;
  deps: string[];
}

function checkOne(f: FormulaColumnLike, known: ReadonlySet<string>, formulaIds: ReadonlySet<string>): Checked {
  const parsed = parseFormula(f.expr);
  if (parsed.error) return { id: f.id, error: parsed.error, deps: [] };
  const refs = referencedColumns(parsed.ast);
  const unknown = refs.find((r) => !known.has(r));
  if (unknown)
    return {
      id: f.id,
      ast: parsed.ast,
      deps: [],
      error: {
        code: "unknown_column",
        message: `Unknown column "${unknown}"`,
        position: firstReferencePos(parsed.ast, unknown),
        params: { id: unknown },
      },
    };
  return { id: f.id, ast: parsed.ast, deps: refs.filter((r) => formulaIds.has(r)) };
}

/**
 * The first dependency cycle reachable from `start`, as a closed chain (a → b → a), or null.
 * `clean` remembers the columns already explored without finding a cycle, so a
 * graph of interdependent formulas is walked once, not once per path. Share
 * one set across the calls for the same `deps`.
 */
function findCycle(start: string, deps: ReadonlyMap<string, string[]>, clean: Set<string>): string[] | null {
  const visit = (id: string, path: string[]): string[] | null => {
    if (path.includes(id)) return [...path.slice(path.indexOf(id)), id];
    if (clean.has(id)) return null;
    const found = (deps.get(id) ?? []).reduce<string[] | null>(
      (hit, d) => hit ?? (deps.has(d) ? visit(d, [...path, id]) : null),
      null,
    );
    if (!found) clean.add(id);
    return found;
  };
  return visit(start, []);
}

/** Dependency order (dependencies first) of an acyclic graph. */
function topoOrder(ids: string[], deps: ReadonlyMap<string, string[]>): string[] {
  const place = (order: string[], id: string): string[] => {
    if (order.includes(id)) return order;
    const withDeps = (deps.get(id) ?? []).filter((d) => deps.has(d)).reduce(place, order);
    return [...withDeps, id];
  };
  return ids.reduce(place, []);
}

/**
 * Validates every formula column of a report: syntax, references to ids the
 * report actually has, and cycles (a formula may read another formula, never
 * itself through any chain). Returns one error per failing column id, and the
 * evaluation order when there are none.
 */
export function validateFormulas(
  formulas: FormulaColumnLike[],
  knownIds: Iterable<string>,
): { errors: Record<string, FormulaError>; order: string[] } {
  const known: ReadonlySet<string> = new Set(knownIds);
  const formulaIds: ReadonlySet<string> = new Set(formulas.map((f) => f.id));
  const checked = formulas.map((f) => checkOne(f, known, formulaIds));

  const syntaxErrors = Object.fromEntries(
    checked.filter((c) => c.error).map((c) => [c.id, c.error as FormulaError]),
  );
  const deps = new Map(checked.filter((c) => !c.error).map((c) => [c.id, c.deps]));
  const asts = new Map(checked.map((c) => [c.id, c.ast]));

  const clean = new Set<string>();
  const cycleErrors = [...deps.keys()].reduce<Record<string, FormulaError>>((acc, id) => {
    if (acc[id]) return acc;
    const cycle = findCycle(id, deps, clean);
    if (!cycle) return acc;
    const chain = cycle.join(" → ");
    const members = cycle.slice(0, -1).filter((m) => !acc[m]);
    return members.reduce((inner, m) => {
      const ast = asts.get(m);
      const target = cycle[cycle.indexOf(m) + 1];
      return {
        ...inner,
        [m]: {
          code: "cycle",
          message: `Circular reference: ${chain}`,
          position: ast ? firstReferencePos(ast, target) : 0,
          params: { chain },
        },
      };
    }, acc);
  }, {});

  const errors = { ...syntaxErrors, ...cycleErrors };
  const order = Object.keys(errors).length ? [] : topoOrder([...deps.keys()], deps);
  return { errors, order };
}

/* ── Evaluator ──────────────────────────────────────────────────────────── */

// A plain decimal, optional sign and exponent: matches "12.50", "-3", ".5",
// "1e3"; rejects "12abc", "$5", "". Tester: https://regex101.com/?flavor=javascript&regex=%5E%5B-%2B%5D%3F(%5Cd%2B%5C.%3F%5Cd*%7C%5C.%5Cd%2B)(%5BeE%5D%5B-%2B%5D%3F%5Cd%2B)%3F%24&testString=12.50
const NUMERIC_RE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/** Numbers and numeric strings (CSV cells, 2-decimal money strings) → number; anything else → null. */
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!NUMERIC_RE.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function truthy(v: FormulaValue): boolean | null {
  if (v === null) return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return v.length > 0;
}

function normalize(v: unknown): FormulaValue {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" || typeof v === "boolean") return v;
  return String(v);
}

/** Half away from zero, like PHP's round(). */
function roundHalfAway(x: number, digits: number): number {
  const d = Math.max(0, Math.min(ROUND_MAX_DIGITS, Math.trunc(digits)));
  const f = Math.pow(DECIMAL_BASE, d);
  const r = (Math.sign(x) * Math.round(Math.abs(x) * f + Number.EPSILON)) / f;
  return Object.is(r, -0) ? 0 : r;
}

function order3(a: number | string, b: number | string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compare(a: FormulaValue, b: FormulaValue): number | null {
  if (a === null || b === null) return null;
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na !== null && nb !== null) return order3(na, nb);
  return order3(toText(a), toText(b));
}

function numbersOf(values: FormulaValue[]): number[] {
  return values.map(toNumber).filter((n): n is number => n !== null);
}

type Num2 = (a: number, b: number) => number | null;

const ARITHMETIC: Record<"+" | "-" | "*" | "/" | "%", Num2> = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => (b === 0 ? null : a / b),
  "%": (a, b) => (b === 0 ? null : a % b),
};

const ORDERING: Record<"<" | "<=" | ">" | ">=", (c: number) => boolean> = {
  "<": (c) => c < 0,
  "<=": (c) => c <= 0,
  ">": (c) => c > 0,
  ">=": (c) => c >= 0,
};

function arithmetic(fn: Num2): (l: FormulaValue, r: FormulaValue) => FormulaValue {
  return (l, r) => {
    const a = toNumber(l);
    const b = toNumber(r);
    return a === null || b === null ? null : fn(a, b);
  };
}

function ordering(test: (c: number) => boolean): (l: FormulaValue, r: FormulaValue) => FormulaValue {
  return (l, r) => {
    const c = compare(l, r);
    return c === null ? null : test(c);
  };
}

/** Null-aware equality: `c1 = null` is how a user tests for an empty cell. */
function equals(l: FormulaValue, r: FormulaValue): boolean {
  if (l === null || r === null) return l === r;
  return compare(l, r) === 0;
}

type Strict = Exclude<BinaryOp, "and" | "or">;

const BINARY: Record<Strict, (l: FormulaValue, r: FormulaValue) => FormulaValue> = {
  "+": arithmetic(ARITHMETIC["+"]),
  "-": arithmetic(ARITHMETIC["-"]),
  "*": arithmetic(ARITHMETIC["*"]),
  "/": arithmetic(ARITHMETIC["/"]),
  "%": arithmetic(ARITHMETIC["%"]),
  "=": (l, r) => equals(l, r),
  "!=": (l, r) => !equals(l, r),
  "<": ordering(ORDERING["<"]),
  "<=": ordering(ORDERING["<="]),
  ">": ordering(ORDERING[">"]),
  ">=": ordering(ORDERING[">="]),
};

/** Three-valued and/or: a definite answer wins over null, null wins over the other. */
function logical(op: "and" | "or", l: boolean | null, r: () => boolean | null): FormulaValue {
  const decisive = op === "or";
  if (l === decisive) return decisive;
  const right = r();
  if (right === decisive) return decisive;
  if (l === null || right === null) return null;
  return !decisive;
}

type Ev = (n: FormulaNode) => FormulaValue;
type Fn = (args: FormulaNode[], ev: Ev) => FormulaValue;

const firstNumber = (args: FormulaNode[], ev: Ev) => toNumber(ev(args[0]));
/** Text longer than 32,767 characters (counted by code point, like `len`) becomes null. */
const capped = (s: string): string | null => ([...s].length > MAX_STRING_LENGTH ? null : s);
const textOrNull = (args: FormulaNode[], ev: Ev, map: (s: string) => FormulaValue): FormulaValue => {
  const v = ev(args[0]);
  return v === null ? null : map(toText(v));
};
const fromNumbers = (pick: (ns: number[]) => number): Fn => (args, ev) => {
  const ns = numbersOf(args.map(ev));
  return ns.length ? pick(ns) : null;
};
const total = (ns: number[]) => ns.reduce((s, n) => s + n, 0);

const FUNCTIONS: Record<FunctionName, Fn> = {
  round: (args, ev) => {
    const x = firstNumber(args, ev);
    const d = args.length > 1 ? toNumber(ev(args[1])) : 0;
    return x === null || d === null ? null : roundHalfAway(x, d);
  },
  abs: (args, ev) => {
    const x = firstNumber(args, ev);
    return x === null ? null : Math.abs(x);
  },
  min: fromNumbers((ns) => Math.min(...ns)),
  max: fromNumbers((ns) => Math.max(...ns)),
  sum: fromNumbers(total),
  avg: fromNumbers((ns) => total(ns) / ns.length),
  // Lazy: stops at the first non-null argument.
  coalesce: (args, ev) => args.reduce<FormulaValue>((found, a) => (found !== null ? found : ev(a)), null),
  // Lazy: only the chosen branch is evaluated.
  if: (args, ev) => (truthy(ev(args[0])) ? ev(args[1]) : ev(args[TWO_ARGS])),
  concat: (args, ev) => capped(args.map((a) => toText(ev(a))).join("")),
  len: (args, ev) => textOrNull(args, ev, (s) => [...s].length),
  upper: (args, ev) => textOrNull(args, ev, (s) => capped(s.toUpperCase())),
  lower: (args, ev) => textOrNull(args, ev, (s) => capped(s.toLowerCase())),
  percent: (args, ev) => {
    const a = toNumber(ev(args[0]));
    const b = toNumber(ev(args[1]));
    return a === null || b === null || b === 0 ? null : (a / b) * PERCENT_SCALE;
  },
};

function evalUnary(n: UnaryNode, ev: Ev): FormulaValue {
  const v = ev(n.operand);
  if (n.op === "not") {
    const b = truthy(v);
    return b === null ? null : !b;
  }
  const x = toNumber(v);
  if (x === null) return null;
  return n.op === "-" ? -x : x;
}

function evalBinaryNode(n: BinaryNode, ev: Ev): FormulaValue {
  if (n.op === "and" || n.op === "or") return logical(n.op, truthy(ev(n.left)), () => truthy(ev(n.right)));
  return BINARY[n.op](ev(n.left), ev(n.right));
}

type Handlers = { [K in FormulaNode["kind"]]: (n: Extract<FormulaNode, { kind: K }>, row: Record<string, unknown>, ev: Ev) => FormulaValue };

const NODE: Handlers = {
  number: (n) => n.value,
  string: (n) => n.value,
  null: () => null,
  column: (n, row) => normalize(row[n.id]),
  unary: (n, _row, ev) => evalUnary(n, ev),
  binary: (n, _row, ev) => evalBinaryNode(n, ev),
  call: (n, _row, ev) => FUNCTIONS[n.name](n.args, ev),
};

/** Evaluates an AST against one row keyed by column id. Never throws. */
export function evaluate(ast: FormulaNode, row: Record<string, unknown>): FormulaValue {
  // The handler table is keyed by the node's own tag, so the cast is exact.
  const ev: Ev = (n) => (NODE[n.kind] as (n: FormulaNode, row: Record<string, unknown>, ev: Ev) => FormulaValue)(n, row, ev);
  try {
    const v = ev(ast);
    return typeof v === "number" && !Number.isFinite(v) ? null : v;
  } catch {
    return null;
  }
}

/**
 * Evaluates a set of formula columns over one row, in dependency order, so a
 * formula that reads another formula sees its value. Used for the sample
 * evaluation in the formula dialog. Columns that fail validation are skipped.
 */
export function evaluateFormulas(
  formulas: FormulaColumnLike[],
  row: Record<string, unknown>,
  knownIds: Iterable<string>,
): Record<string, FormulaValue> {
  const { order } = validateFormulas(formulas, knownIds);
  const byId = new Map(formulas.map((f) => [f.id, f.expr]));
  const scope = order.reduce<Record<string, unknown>>((acc, id) => {
    const parsed = parseFormula(byId.get(id) ?? "");
    return parsed.ast ? { ...acc, [id]: evaluate(parsed.ast, acc) } : acc;
  }, { ...row });
  return Object.fromEntries(order.filter((id) => id in scope).map((id) => [id, normalize(scope[id])]));
}
