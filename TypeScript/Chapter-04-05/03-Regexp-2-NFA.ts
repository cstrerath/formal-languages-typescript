// ---------------------------------------------------------------------------
// 03-Regexp-2-NFA.ts
// Converts regular expressions into equivalent NFAs (Thompson construction).
// Implements the theory from lecture section 4.4.
// ---------------------------------------------------------------------------

// ---------- Basic Type Definitions -----------------------------------------

export type Char = string;
export type State = number;
export const EPS = 'ε' as const;

// ---------- NFA Definition --------------------------------------------------

export type Delta = Map<string, Set<State>>;

export interface NFA {
  Q: Set<State>; // set of states
  Sigma: Set<Char>; // alphabet
  delta: Delta; // transition relation
  q0: State; // start state
  F: Set<State>; // accepting states
}

// ---------------------------------------------------------------------------
// Parser for regular expressions producing an AST with "kind" fields
// ---------------------------------------------------------------------------

type Tok =
  | { t: 'sym'; v: string }
  | { t: '(' | ')' | '+' | '*' | '⋅' | '.' | 'ε' | '∅' };

function isOpChar(c: string) {
  return '() +*⋅.'.includes(c);
}

function tokenize(input: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if ('()+*⋅.'.includes(c)) {
      toks.push({ t: c } as Tok);
      i++;
      continue;
    }
    if (c === 'ε' || c === '∅') {
      toks.push({ t: c } as Tok);
      i++;
      continue;
    }
    if (!isOpChar(c)) {
      toks.push({ t: 'sym', v: c });
      i++;
      continue;
    }

    throw new Error(`Unexpected character '${c}'`);
  }

  // implicit concatenation
  const out: Tok[] = [];
  const isAtomRight = (t?: Tok) =>
    t && (t.t === 'sym' || t.t === 'ε' || t.t === '(');
  const isAtomLeft = (t?: Tok) =>
    t && (t.t === 'sym' || t.t === 'ε' || t.t === ')' || t.t === '*');
  for (let k = 0; k < toks.length; k++) {
    const a = toks[k];
    const b = toks[k + 1];
    out.push(a);
    if (isAtomLeft(a) && isAtomRight(b)) out.push({ t: '⋅' } as Tok);
  }
  return out;
}

// AST node types
export type RegExp =
  | { kind: 'empty' }
  | { kind: 'epsilon' }
  | { kind: 'sym'; ch: string }
  | { kind: 'concat'; left: RegExp; right: RegExp }
  | { kind: 'union'; left: RegExp; right: RegExp }
  | { kind: 'star'; expr: RegExp };

export function parseRegex(expr: string): RegExp {
  const toks = tokenize(expr);
  let pos = 0;
  function peek() {
    return toks[pos];
  }
  function next() {
    return toks[pos++]!;
  }

  function parseE(): RegExp {
    let left = parseT();
    while (peek()?.t === '+') {
      next();
      const right = parseT();
      left = { kind: 'union', left, right };
    }
    return left;
  }

  function parseT(): RegExp {
    let left = parseF();
    while (peek() && (peek()!.t === '⋅' || peek()!.t === '.')) {
      next();
      const right = parseF();
      left = { kind: 'concat', left, right };
    }
    return left;
  }

  function parseF(): RegExp {
    let base = parseA();
    while (peek()?.t === '*') {
      next();
      base = { kind: 'star', expr: base };
    }
    return base;
  }

  function parseA(): RegExp {
    const tok = next();
    if (!tok) throw new Error('Unexpected end of input');
    switch (tok.t) {
      case 'sym':
        return { kind: 'sym', ch: tok.v };
      case 'ε':
        return { kind: 'epsilon' };
      case '∅':
        return { kind: 'empty' };
      case '(': {
        const inner = parseE();
        const close = next();
        if (!close || close.t !== ')')
          throw new Error('Missing closing parenthesis');
        return inner;
      }
      default:
        throw new Error(`Unexpected token: ${tok.t}`);
    }
  }

  const result = parseE();
  if (pos !== toks.length)
    throw new Error('Unexpected characters at end of expression');
  return result;
}

// ---------- RegExp → NFA Conversion Class ----------------------------------

export class RegExp2NFA {
  Sigma: Set<Char>;
  StateCount: number;

  constructor(Sigma: Set<Char>) {
    this.Sigma = Sigma;
    this.StateCount = 0;
  }

  toNFA(r: RegExp): NFA {
    switch (r.kind) {
      case 'empty':
        return this.genEmptyNFA();
      case 'epsilon':
        return this.genEpsilonNFA();
      case 'sym':
        return this.genCharNFA(r.ch);
      case 'concat':
        return this.catenate(this.toNFA(r.left), this.toNFA(r.right));
      case 'union':
        return this.disjunction(this.toNFA(r.left), this.toNFA(r.right));
      case 'star':
        return this.kleene(this.toNFA(r.expr));
      default:
        throw new Error('Unknown regex kind');
    }
  }

  // ---------- Base automata -----------------------------------------------

  genEmptyNFA(): NFA {
    const q0 = this.getNewState();
    const q1 = this.getNewState();
    const delta: Delta = new Map();
    return {
      Q: new Set([q0, q1]),
      Sigma: this.Sigma,
      delta,
      q0,
      F: new Set([q1]),
    };
  }

  genEpsilonNFA(): NFA {
    const q0 = this.getNewState();
    const q1 = this.getNewState();
    const delta: Delta = new Map();
    delta.set(`${q0},${EPS}`, new Set([q1]));
    return {
      Q: new Set([q0, q1]),
      Sigma: this.Sigma,
      delta,
      q0,
      F: new Set([q1]),
    };
  }

  genCharNFA(c: Char): NFA {
    const q0 = this.getNewState();
    const q1 = this.getNewState();
    const delta: Delta = new Map();
    delta.set(`${q0},${c}`, new Set([q1]));
    return {
      Q: new Set([q0, q1]),
      Sigma: this.Sigma,
      delta,
      q0,
      F: new Set([q1]),
    };
  }

  // ---------- Operations on Automata ---------------------------------------

  catenate(f1: NFA, f2: NFA): NFA {
    const delta: Delta = new Map([...f1.delta, ...f2.delta]);
    const [q2] = Array.from(f1.F);
    delta.set(`${q2},${EPS}`, new Set([f2.q0]));
    return {
      Q: new Set([...f1.Q, ...f2.Q]),
      Sigma: f1.Sigma,
      delta,
      q0: f1.q0,
      F: new Set(f2.F),
    };
  }

  disjunction(f1: NFA, f2: NFA): NFA {
    const [q3] = Array.from(f1.F);
    const [q4] = Array.from(f2.F);
    const q0 = this.getNewState();
    const q5 = this.getNewState();

    const delta: Delta = new Map([...f1.delta, ...f2.delta]);
    delta.set(`${q0},${EPS}`, new Set([f1.q0, f2.q0]));
    delta.set(`${q3},${EPS}`, new Set([q5]));
    delta.set(`${q4},${EPS}`, new Set([q5]));

    return {
      Q: new Set([q0, q5, ...f1.Q, ...f2.Q]),
      Sigma: f1.Sigma,
      delta,
      q0,
      F: new Set([q5]),
    };
  }

  kleene(f: NFA): NFA {
    const [q2] = Array.from(f.F);
    const q0 = this.getNewState();
    const q3 = this.getNewState();

    const delta: Delta = new Map([...f.delta]);
    delta.set(`${q0},${EPS}`, new Set([f.q0, q3]));
    delta.set(`${q2},${EPS}`, new Set([f.q0, q3]));

    return {
      Q: new Set([q0, q3, ...f.Q]),
      Sigma: f.Sigma,
      delta,
      q0,
      F: new Set([q3]),
    };
  }

  getNewState(): State {
    this.StateCount += 1;
    return this.StateCount;
  }
}

// ---------------------------------------------------------------------------
// Utility: Pretty-print an NFA similar to the Python notebook output
// ---------------------------------------------------------------------------

export function showNFA(nfa: NFA): string {
  const setStr = (S: Set<any>) => `{${[...S].join(', ')}}`;
  const deltaStr = [...nfa.delta.entries()]
    .map(([k, v]) => {
      const [q, sym] = k.split(',');
      return `(${q}, '${sym}'): ${setStr(v)}`;
    })
    .join(', ');
  return `(${setStr(nfa.Q)}, ${setStr(nfa.Sigma)}, {${deltaStr}}, ${
    nfa.q0
  }, ${setStr(nfa.F)})`;
}

// ---------------------------------------------------------------------------
// Convert an NFA to Graphviz DOT format
// ---------------------------------------------------------------------------

export function nfa2dot(nfa: NFA): string {
  const { delta, q0, F } = nfa;
  const lines: string[] = [];
  lines.push('digraph NFA {');
  lines.push('  rankdir=LR;');
  lines.push('  __start [shape=point, label=""];');
  lines.push(`  __start -> "${q0}";`);

  // final states
  lines.push('  node [shape = doublecircle];');
  for (const f of F) lines.push(`  "${f}";`);
  lines.push('  node [shape = circle];');

  // transitions
  for (const [key, targets] of delta.entries()) {
    const [from, c] = key.split(',');
    for (const to of targets) {
      lines.push(`  "${from}" -> "${to}" [label="${c === EPS ? 'ε' : c}"];`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}

// ---------- DFA Definition --------------------------------------------------

export interface DFA {
  Q: Set<string>; // Menge der Zustände (Mengen von NFA-States)
  Sigma: Set<Char>; // Alphabet
  delta: Map<string, string>; // deterministische Übergänge
  q0: string; // Startzustand
  F: Set<string>; // akzeptierende Zustände
}

// Hilfsfunktion: epsilon-closure
function epsilonClosure(nfa: NFA, states: Set<State>): Set<State> {
  const closure = new Set(states);
  const stack = [...states];
  while (stack.length > 0) {
    const state = stack.pop()!;
    for (const [key, targets] of nfa.delta.entries()) {
      const [src, sym] = key.split(',');
      if (src === String(state) && sym === EPS) {
        for (const t of targets) {
          if (!closure.has(t)) {
            closure.add(t);
            stack.push(t);
          }
        }
      }
    }
  }
  return closure;
}

// Hilfsfunktion: move
function move(nfa: NFA, states: Set<State>, symbol: Char): Set<State> {
  const result = new Set<State>();
  for (const s of states) {
    for (const [key, targets] of nfa.delta.entries()) {
      const [src, sym] = key.split(',');
      if (src === String(s) && sym === symbol) {
        for (const t of targets) result.add(t);
      }
    }
  }
  return result;
}

export function nfa2dfa(nfa: NFA): DFA {
  // ---------- Startzustand (ε-closure)
  const start = epsilonClosure(nfa, new Set([nfa.q0]));
  const startKey = JSON.stringify([...start].sort());
  const Q = new Set<string>([startKey]);
  const delta = new Map<string, string>();
  const F = new Set<string>();
  const worklist: Set<string> = new Set([startKey]);

  // Hilfsfunktion zum Deserialisieren von Zustandsmengen
  const parseStateSet = (key: string) => new Set(JSON.parse(key)) as Set<State>;

  // ---------- Potenzmengenkonstruktion
  while (worklist.size > 0) {
    const currentKey = worklist.values().next().value as string;
    worklist.delete(currentKey);
    const currentStates = parseStateSet(currentKey);

    for (const a of nfa.Sigma) {
      const moveSet = move(nfa, currentStates, a);
      const closure = epsilonClosure(nfa, moveSet);

      // Wenn keine Zustände erreicht werden → Übergang zu ∅
      if (closure.size === 0) {
        delta.set(currentKey + ',' + a, '∅');
        continue;
      }

      const nextKey = JSON.stringify([...closure].sort());
      delta.set(currentKey + ',' + a, nextKey);

      if (!Q.has(nextKey)) {
        Q.add(nextKey);
        worklist.add(nextKey);
      }
    }
  }

  // ---------- ∅-Zustand hinzufügen, falls benötigt
  if ([...delta.values()].some((v) => v === '∅')) {
    Q.add('∅');
    for (const a of nfa.Sigma) {
      delta.set('∅,' + a, '∅');
    }
  }

  // ---------- Akzeptierende Zustände bestimmen
  for (const qKey of Q) {
    if (qKey === '∅') continue;
    const qSet = parseStateSet(qKey);
    for (const f of nfa.F) {
      if (qSet.has(Number(f)) || qSet.has(f)) {
        F.add(qKey);
        break;
      }
    }
  }

  // ---------- DFA zurückgeben
  return { Q, Sigma: nfa.Sigma, delta, q0: startKey, F };
}

export function dfaToDot(dfa: DFA): string {
  const { delta, q0, F } = dfa;
  const lines: string[] = [];
  lines.push('digraph DFA {');
  lines.push('  rankdir=LR;');
  lines.push('  __start [shape=point, label=""];');
  lines.push(`  __start -> "${q0}";`);

  lines.push('  node [shape = doublecircle];');
  for (const f of F) lines.push(`  "${f}";`);
  lines.push('  node [shape = circle];');

  for (const [key, target] of delta.entries()) {
    if (target === '∅') continue;
    const idx = key.lastIndexOf(',');
    if (idx < 0) continue;
    const from = key.slice(0, idx);
    const sym = key.slice(idx + 1);
    lines.push(`  "${from}" -> "${target}" [label="${sym}"];`);
  }

  lines.push('}');
  return lines.join('\n');
}

export function minimizeDFA(dfa: DFA): DFA {
  const { Q, Sigma, delta, q0, F } = dfa;

  // ---------- 1. Initiale Partition (F / Nicht-F)
  let P: Set<Set<string>> = new Set([
    new Set(F),
    new Set([...Q].filter((q) => !F.has(q))),
  ]);
  let W: Set<Set<string>> = new Set([...P]);

  // ---------- 2. Hauptschleife (Hopcroft)
  while (W.size > 0) {
    const A = W.values().next().value as Set<string>;
    W.delete(A);

    for (const c of Sigma) {
      const X = new Set(
        [...Q].filter((q) => {
          const t = delta.get(`${q},${c}`);
          return t && A.has(t);
        })
      );

      const newP: Set<Set<string>> = new Set();
      for (const Y of P) {
        const intersect = new Set([...Y].filter((x) => X.has(x)));
        const diff = new Set([...Y].filter((x) => !X.has(x)));

        if (intersect.size && diff.size) {
          newP.add(intersect);
          newP.add(diff);
          if (W.has(Y)) {
            W.delete(Y);
            W.add(intersect);
            W.add(diff);
          } else {
            // kleinere Teilmenge zuerst zur Warteschlange hinzufügen
            if (intersect.size <= diff.size) W.add(intersect);
            else W.add(diff);
          }
        } else {
          newP.add(Y);
        }
      }
      P = newP;
    }
  }

  // ---------- 3. Neue Zustände erzeugen
  const newStates = [...P].map((group, i) => ({
    name: `S${i}`,
    states: group,
  }));

  // Mapping von alten → neuen Zuständen
  const nameMap = new Map<string, string>();
  for (const n of newStates) {
    for (const q of n.states) nameMap.set(q, n.name);
  }

  // ---------- 4. Neue Übergänge aufbauen
  const newDelta = new Map<string, string>();
  for (const [key, val] of delta.entries()) {
    if (val === '∅') continue; // leere Übergänge ignorieren
    const idx = key.lastIndexOf(',');
    if (idx < 0) continue;
    const q = key.slice(0, idx);
    const sym = key.slice(idx + 1);

    const from = nameMap.get(q);
    const to = nameMap.get(val);
    if (!from || !to) continue; // robust gegen fehlende Zuordnungen
    newDelta.set(`${from},${sym}`, to);
  }

  // ---------- 5. Neue Mengen definieren
  const newQ = new Set(newStates.map((s) => s.name));
  const newF = new Set(
    newStates
      .filter((s) => [...s.states].some((q) => F.has(q)))
      .map((s) => s.name)
  );

  const newStart = nameMap.get(q0);
  if (!newStart)
    throw new Error(`Startzustand '${q0}' konnte nicht gemappt werden`);

  // ---------- 6. Neues minimiertes DFA zurückgeben
  return { Q: newQ, Sigma, delta: newDelta, q0: newStart, F: newF };
}
