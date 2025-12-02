import { RecursiveSet } from 'recursive-set';

// === Typ-Definitionen ===

export type State = string | number;
export type Char = string;

// Die Übergangsfunktion bildet (State, Char) -> State ab.
// Da wir RecursiveSets als Keys in Maps nur über Strings nutzen können (oder Hash-Maps),
// nutzen wir hier den String-Key.
export type TransRelDet = Map<string, RecursiveSet<State>>;

export type BinaryOp = '⋅' | '+';
export type UnaryOp = '*';

// Rekursive Definition des regulären Ausdrucks
export type RegExp =
  | number
  | string
  | [RegExp, UnaryOp]
  | [RegExp, BinaryOp, RegExp];

export type DFA = {
  Q: RecursiveSet<RecursiveSet<State>>; // Menge aller Zustände (Mengen von Mengen)
  Sigma: RecursiveSet<Char>; // Alphabet
  delta: TransRelDet; // Übergangsfunktion
  q0: RecursiveSet<State>; // Startzustand
  A: RecursiveSet<RecursiveSet<State>>; // Akzeptierende Zustände
};

// === Hilfsfunktionen ===

/**
 * Erzeugt einen eindeutigen Schlüssel für die Map-Suche.
 */
export function key(q: State | RecursiveSet<State>, c: Char): string {
  return `${q.toString()},${c}`;
}

/**
 * Summiert eine Menge von regulären Ausdrücken (Alternativen).
 * r1 + r2 + ... + rn
 */
export function regexpSum(S: RecursiveSet<RegExp> | RegExp[]): RegExp {
  // Konvertierung zu Array, um sicherzustellen, dass wir iterieren können
  const elems: RegExp[] = Array.isArray(S) ? S : (Array.from(S) as RegExp[]);

  const n = elems.length;

  if (n === 0) {
    return 0; // Leere Menge entspricht 0 (oder leere Sprache)
  }
  if (n === 1) {
    return elems[0];
  }

  const [r, ...rest] = elems;
  return [r, '+', regexpSum(rest)];
}

/**
 * Berechnet den regulären Ausdruck für den Pfad von p1 nach p2,
 * wobei nur Zustände aus 'Allowed' als Zwischenzustände erlaubt sind.
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
    const allChars = new RecursiveSet<RegExp>();

    // AllChars = { c in Σ | δ(p1, c) == p2 }
    for (const symbol of Sigma) {
      const c = symbol as Char;
      const target = delta.get(key(p1, c));

      // Prüfen, ob wir den Zielzustand erreichen.
      // .equals() ist bei RecursiveSet sicherer als ===
      if (target && (target === p2 || target.equals(p2))) {
        allChars.add(c);
      }
    }

    const r = regexpSum(allChars);

    // Wenn Start- und Zielzustand gleich sind, ist zusätzlich ε erlaubt
    // Auch hier .equals() nutzen
    if (p1.equals(p2)) {
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

  // Term: (rp1q ⋅ rqq* ⋅ rqp2)
  const loop: RegExp = [rqq, '*'];
  const concat1: RegExp = [rp1q, '⋅', loop];
  const concat2: RegExp = [concat1, '⋅', rqp2];

  // Gesamtergebnis: rp1p2 + (rp1q ⋅ rqq* ⋅ rqp2)
  return [rp1p2, '+', concat2];
}

// === Hauptfunktion ===

/**
 * Konvertiert einen DFA in einen regulären Ausdruck.
 */
export function dfa2regexp(F: DFA): RegExp {
  const { Q, Sigma, delta, q0, A } = F;

  // Allowed-States-Liste: alle Zustände des DFA als Array für die Rekursion
  const allStates = Array.from(Q) as RecursiveSet<State>[];

  // Menge der Teilausdrücke für jeden akzeptierenden Zustand
  const parts = new RecursiveSet<RegExp>();

  // Für jeden akzeptierenden Zustand p wird der Pfad vom Startzustand q0 berechnet
  for (const acc of A) {
    const p = acc as RecursiveSet<State>;
    const r = rpq(q0, p, Sigma, delta, allStates);
    parts.add(r);
  }

  // Gesamtsprache ist die Summe (Alternative) über alle akzeptierenden Zustände
  return regexpSum(parts);
}
