import { RecursiveSet, Tuple } from 'recursive-set';

// === 1. Typ-Definitionen ===

export type State = string | number;
export type Char = string;
export type TransRelDet = Map<string, RecursiveSet<State>>;
export type BinaryOp = '⋅' | '+';
export type UnaryOp = '*';

/**
 * Regulärer Ausdruck:
 * - Zahl (0) oder String
 * - Tupel der Form [RegExp, UnaryOp] -> r*
 * - Tupel der Form [RegExp, BinaryOp, RegExp] -> r+s oder r.s
 */
export type RegExp =
  | number
  | string
  | Tuple<[RegExp, UnaryOp]>
  | Tuple<[RegExp, BinaryOp, RegExp]>;

export type DFA = {
  Q: RecursiveSet<RecursiveSet<State>>;
  Sigma: RecursiveSet<Char>;
  delta: TransRelDet;
  q0: RecursiveSet<State>;
  A: RecursiveSet<RecursiveSet<State>>;
};

// === 2. Hilfsfunktionen ===

export function key(q: State | RecursiveSet<State>, c: Char): string {
  return `${q.toString()},${c}`;
}

export function regexpSum(S: RecursiveSet<RegExp> | RegExp[]): RegExp {
  const elems: RegExp[] = Array.isArray(S) ? S : (Array.from(S) as RegExp[]);
  const n = elems.length;

  if (n === 0) return 0;
  if (n === 1) return elems[0];

  const [r, ...rest] = elems;

  // Explizite Angabe der Tupel-Struktur [RegExp, BinaryOp, RegExp]
  return new Tuple<[RegExp, BinaryOp, RegExp]>(
    r,
    '+' as BinaryOp,
    regexpSum(rest)
  );
}

export function rpq(
  p1: RecursiveSet<State>,
  p2: RecursiveSet<State>,
  Sigma: RecursiveSet<Char>,
  delta: TransRelDet,
  Allowed: RecursiveSet<State>[]
): RegExp {
  if (Allowed.length === 0) {
    const allChars = new RecursiveSet<Char>();
    for (const symbol of Sigma) {
      const c = symbol as Char;
      const target = delta.get(key(p1, c));
      if (target && (target === p2 || target.equals(p2))) {
        allChars.add(c);
      }
    }

    const r = regexpSum(allChars);

    if (p1.equals(p2)) {
      // ε + r
      return new Tuple<[RegExp, BinaryOp, RegExp]>('ε', '+' as BinaryOp, r);
    } else {
      return r;
    }
  }

  const [q, ...RestAllowed] = Allowed;

  const rp1p2 = rpq(p1, p2, Sigma, delta, RestAllowed);
  const rp1q = rpq(p1, q, Sigma, delta, RestAllowed);
  const rqq = rpq(q, q, Sigma, delta, RestAllowed);
  const rqp2 = rpq(q, p2, Sigma, delta, RestAllowed);

  // Konstruktion: (rp1q ⋅ rqq* ⋅ rqp2)

  // 1. Schleife: rqq* -> Struktur [RegExp, UnaryOp]
  const loop = new Tuple<[RegExp, UnaryOp]>(rqq, '*' as UnaryOp);

  // 2. Konkatenation 1: rp1q ⋅ loop -> Struktur [RegExp, BinaryOp, RegExp]
  // Hinweis: 'loop' ist ein RegExp, da Tuple<...> ein RegExp ist.
  const concat1 = new Tuple<[RegExp, BinaryOp, RegExp]>(
    rp1q,
    '⋅' as BinaryOp,
    loop
  );

  // 3. Konkatenation 2: concat1 ⋅ rqp2
  const concat2 = new Tuple<[RegExp, BinaryOp, RegExp]>(
    concat1,
    '⋅' as BinaryOp,
    rqp2
  );

  // Gesamtergebnis: rp1p2 + concat2
  return new Tuple<[RegExp, BinaryOp, RegExp]>(rp1p2, '+' as BinaryOp, concat2);
}

// === 3. Hauptfunktion ===

export function dfa2regexp(F: DFA): RegExp {
  const { Q, Sigma, delta, q0, A } = F;
  const allStates = Array.from(Q) as RecursiveSet<State>[];
  const parts = new RecursiveSet<RegExp>();

  for (const acc of A) {
    const p = acc as RecursiveSet<State>;
    const r = rpq(q0, p, Sigma, delta, allStates);
    parts.add(r);
  }

  return regexpSum(parts);
}
