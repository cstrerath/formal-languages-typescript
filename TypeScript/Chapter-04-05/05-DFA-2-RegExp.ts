import { RecursiveSet } from 'recursive-set';

// ============================================================
// 1. Type Definitions (wie 01-NFA-2-DFA.ts & 03-Regexp-2-NFA.ts)
// ============================================================

/** Abstract type for states (can be string or number) */
export type State = string | number;

/** Abstract type for characters (alphabet symbols) */
export type Char = string;

/**
 * Transition relation for NFA:
 * Maps a string key "state,char" to a set of reachable states.
 * (Für DFA brauchen wir eigentlich nur TransRelDet, aber egal.)
 */
export type TransRel = Map<string, RecursiveSet<State>>;

/**
 * Transition relation for DFA:
 * Maps a string key "stateSet,char" to a single set of states
 * (the target state in the DFA).
 * Die Ziel-RecursiveSet<State> repräsentiert EINEN DFA-Zustand.
 */
export type TransRelDet = Map<string, RecursiveSet<State>>;

/** Helper to generate keys for transition maps (wie in 01-NFA-2-DFA.ts). */
export function key(q: State | RecursiveSet<State>, c: Char): string {
  return `${q.toString()},${c}`;
}

/** Operators for Regular Expressions */
export type BinaryOp = '⋅' | '+';
export type UnaryOp = '*';

/**
 * Regular Expression type:
 * - 0      represents the empty set (∅)
 * - string represents either a symbol from Σ or epsilon ('ε')
 * - [r, '*']                is r*
 * - [r1, '⋅', r2]           is r1 r2
 * - [r1, '+', r2]           is r1 + r2
 */
export type RegExp =
  | number
  | string
  | [RegExp, UnaryOp]
  | [RegExp, BinaryOp, RegExp];

/** Deterministic Finite Automaton (wie in 01-NFA-2-DFA.ts) */
export interface DFA {
  Q: RecursiveSet<RecursiveSet<State>>; // States are sets of NFA states
  Sigma: RecursiveSet<Char>;
  delta: TransRelDet;
  q0: RecursiveSet<State>;
  A: RecursiveSet<RecursiveSet<State>>;
}

// ============================================================
// 2. regexpSum – Summe von RegExps
// ============================================================

/**
 * Bildet die Summe (Disjunktion) einer Menge bzw. Liste von RegExps:
 *   regexpSum({r1, r2, r3}) = r1 + r2 + r3
 *
 * - Leere Menge/Liste -> 0
 * - Ein Element       -> dieses Element
 */
export function regexpSum(S: Set<RegExp> | RegExp[]): RegExp {
  const elems: RegExp[] = S instanceof Set ? Array.from(S) : S.slice();
  const n = elems.length;

  if (n === 0) {
    return 0;
  }
  if (n === 1) {
    return elems[0];
  }

  const [r, ...rest] = elems;
  return [r, '+', regexpSum(rest)];
}

// ============================================================
// 3. rpq-Funktion (State-Elimination)
// ============================================================

/**
 * rpq(p1, p2, Σ, δ, Allowed):
 *
 * Gibt einen regulären Ausdruck für alle Wörter an,
 * die Zustand p1 nach p2 bringen, wobei als Zwischenzustände
 * NUR Zustände aus `Allowed` benutzt werden dürfen.
 *
 * Direkte Portierung von rpq aus dem Python-Notebook.
 */
export function rpq(
  p1: RecursiveSet<State>,
  p2: RecursiveSet<State>,
  Sigma: RecursiveSet<Char>,
  delta: TransRelDet,
  Allowed: RecursiveSet<State>[]
): RegExp {
  // Basisfall: keine Zwischenzustände mehr erlaubt
  if (Allowed.length === 0) {
    const allChars = new Set<RegExp>();

    // AllChars = { c in Σ | δ(p1, c) == p2 }
    for (const symbol of Sigma) {
      const c = symbol as Char;
      const target = delta.get(key(p1, c));

      // Wir verlassen uns hier darauf, dass dieselbe RecursiveSet-Instanz
      // für Zustände in Q, A und delta verwendet wird (wie in 01-NFA-2-DFA.ts).
      if (target === p2) {
        allChars.add(c);
      }
    }

    const r = regexpSum(allChars);

    // Wenn Start- und Zielzustand gleich sind, ist zusätzlich ε erlaubt
    if (p1 === p2) {
      // In den TS-Dateien wird 'ε' als Epsilon verwendet.
      return ['ε', '+', r];
    } else {
      return r;
    }
  }

  // Rekursionsfall: einen Zwischenzustand q aus Allowed eliminieren
  const [q, ...RestAllowed] = Allowed;

  const rp1p2 = rpq(p1, p2, Sigma, delta, RestAllowed);
  const rp1q = rpq(p1, q, Sigma, delta, RestAllowed);
  const rqq = rpq(q, q, Sigma, delta, RestAllowed);
  const rqp2 = rpq(q, p2, Sigma, delta, RestAllowed);

  // Term:  (rp1q ⋅ rqq* ⋅ rqp2)
  const loop: RegExp = [rqq, '*'];
  const concat1: RegExp = [rp1q, '⋅', loop];
  const concat2: RegExp = [concat1, '⋅', rqp2];

  // Gesamtergebnis: rp1p2 + (rp1q ⋅ rqq* ⋅ rqp2)
  return [rp1p2, '+', concat2];
}

// ============================================================
// 4. Hauptfunktion: DFA → RegExp
// ============================================================

/**
 * Wandelt einen DFA in einen äquivalenten regulären Ausdruck um,
 * mittels rekursiver Zustandseliminierung (rpq).
 */
export function dfa2regexp(F: DFA): RegExp {
  const { Q, Sigma, delta, q0, A } = F;

  // Allowed-States-Liste: alle Zustände des DFA
  const allStates = Array.from(Q) as RecursiveSet<State>[];

  const parts = new Set<RegExp>();

  // Für jeden akzeptierenden Zustand p wird r_{q0,p} berechnet
  for (const acc of A) {
    const p = acc as RecursiveSet<State>;
    const r = rpq(q0, p, Sigma, delta, allStates);
    parts.add(r);
  }

  // Gesamtsprache ist die Summe über alle akzeptierenden Zustände
  return regexpSum(parts);
}
