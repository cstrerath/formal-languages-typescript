import { RecursiveSet, Tuple } from 'recursive-set';

// ============================================================
// 1. Type Definitions
// ============================================================

/** Operators for Regular Expressions */
export type BinaryOp = '⋅' | '+';
export type UnaryOp = '*';

/**
 * The Regular Expression Type (Recursive)
 * - 0 represents the empty set (∅)
 * - string represents a character or epsilon ('ε')
 */
export type RegExp =
  | number
  | string
  | Tuple<[RegExp, UnaryOp]>
  | Tuple<[RegExp, BinaryOp, RegExp]>;

/** Character type */
export type Char = string;

/** State type (integers) */
export type State = number;

/** Helper to generate unique keys "state,char" */
export function key(q: State, c: Char): string {
  return `${q},${c}`;
}

/** Transition Relation: Map<"q,c", Set<q_next>> */
export type Delta = Map<string, RecursiveSet<State>>;

/** NFA Structure: [Q, Sigma, delta, q0, A] */
export type NFA = {
  Q: RecursiveSet<State>;
  Sigma: RecursiveSet<Char>;
  delta: Delta;
  q0: State;
  A: RecursiveSet<State>;
};

// ============================================================
// 2. State Generator
// ============================================================

/** Helper class to generate unique integer states */
export class StateGenerator {
  private stateCount: number = 0;

  getNewState(): State {
    this.stateCount += 1;
    return this.stateCount;
  }
}

// ============================================================
// 3. NFA Construction Functions
// ============================================================

/** Creates an NFA that accepts nothing (∅) */
export function genEmptyNFA(
  gen: StateGenerator,
  Sigma: RecursiveSet<Char>
): NFA {
  const q0 = gen.getNewState();
  const q1 = gen.getNewState();

  return {
    Q: new RecursiveSet(q0, q1),
    Sigma: Sigma,
    delta: new Map(),
    q0: q0,
    A: new RecursiveSet(q1),
  };
}

/** Creates an NFA that accepts epsilon (ε) */
export function genEpsilonNFA(
  gen: StateGenerator,
  Sigma: RecursiveSet<Char>
): NFA {
  const q0 = gen.getNewState();
  const q1 = gen.getNewState();

  const delta: Delta = new Map();
  delta.set(key(q0, 'ε'), new RecursiveSet(q1));

  return {
    Q: new RecursiveSet(q0, q1),
    Sigma: Sigma,
    delta: delta,
    q0: q0,
    A: new RecursiveSet(q1),
  };
}

/** Creates an NFA that accepts a single character c */
export function genCharNFA(
  gen: StateGenerator,
  Sigma: RecursiveSet<Char>,
  c: Char
): NFA {
  const q0 = gen.getNewState();
  const q1 = gen.getNewState();

  const delta: Delta = new Map();
  delta.set(key(q0, c), new RecursiveSet(q1));

  return {
    Q: new RecursiveSet(q0, q1),
    Sigma: Sigma,
    delta: delta,
    q0: q0,
    A: new RecursiveSet(q1),
  };
}

/** Helper to merge two transition maps */
export function copyDelta(d1: Delta, d2: Delta): Delta {
  const newDelta = new Map(d1);
  for (const [k, v] of d2) {
    newDelta.set(k, v);
  }
  return newDelta;
}

/** Concatenation of two NFAs (r1 ⋅ r2) */
export function catenate(gen: StateGenerator, f1: NFA, f2: NFA): NFA {
  const Q1 = f1.Q;
  const Sigma = f1.Sigma;
  const delta1 = f1.delta;
  const q1 = f1.q0;
  const A1 = f1.A;

  const Q2 = f2.Q;
  const delta2 = f2.delta;
  const q3 = f2.q0;
  const A2 = f2.A;

  const q2 = Array.from(A1)[0] as State;

  const delta = copyDelta(delta1, delta2);

  delta.set(key(q2, 'ε'), new RecursiveSet(q3));

  return {
    Q: Q1.union(Q2),
    Sigma: Sigma,
    delta: delta,
    q0: q1,
    A: A2,
  };
}

/** Disjunction of two NFAs (r1 + r2) */
export function disjunction(gen: StateGenerator, f1: NFA, f2: NFA): NFA {
  const Q1 = f1.Q;
  const Sigma = f1.Sigma;
  const delta1 = f1.delta;
  const q1 = f1.q0;
  const A1 = f1.A;

  const Q2 = f2.Q;
  const delta2 = f2.delta;
  const q2 = f2.q0;
  const A2 = f2.A;

  const q3 = Array.from(A1)[0] as State;
  const q4 = Array.from(A2)[0] as State;

  const q0 = gen.getNewState();
  const q5 = gen.getNewState();

  const delta = copyDelta(delta1, delta2);

  delta.set(key(q0, 'ε'), new RecursiveSet(q1, q2));
  delta.set(key(q3, 'ε'), new RecursiveSet(q5));
  delta.set(key(q4, 'ε'), new RecursiveSet(q5));

  return {
    Q: new RecursiveSet(q0, q5).union(Q1).union(Q2),
    Sigma: Sigma,
    delta: delta,
    q0: q0,
    A: new RecursiveSet(q5),
  };
}

/** Kleene Star of an NFA (r*) */
export function kleene(gen: StateGenerator, f: NFA): NFA {
  const M = f.Q;
  const Sigma = f.Sigma;
  const delta0 = f.delta;
  const q1 = f.q0;
  const A = f.A;

  const q2 = Array.from(A)[0] as State;

  const q0 = gen.getNewState();
  const q3 = gen.getNewState();

  const delta = new Map(delta0);

  delta.set(key(q0, 'ε'), new RecursiveSet(q1, q3));
  delta.set(key(q2, 'ε'), new RecursiveSet(q1, q3));

  return {
    Q: new RecursiveSet(q0, q3).union(M),
    Sigma: Sigma,
    delta: delta,
    q0: q0,
    A: new RecursiveSet(q3),
  };
}

// ============================================================
// 4. Main Converter Class
// ============================================================

/** Main class to convert Regular Expressions to NFAs */
export class RegExp2NFA {
  private gen: StateGenerator;
  private sigma: RecursiveSet<Char>;

  constructor(sigma: RecursiveSet<Char>) {
    this.sigma = sigma;
    this.gen = new StateGenerator();
  }

    public toNFA(r: RegExp): NFA {
    // 1. Base Case: Empty Set
    if (r === 0) {
      return genEmptyNFA(this.gen, this.sigma);
    }

    // 2. Base Case: Epsilon
    if (r === 'ε') {
      return genEpsilonNFA(this.gen, this.sigma);
    }

    // 3. Base Case: Character (single letter string)
    if (typeof r === 'string' && r.length === 1) {
      return genCharNFA(this.gen, this.sigma, r);
    }

    // 4. Recursive Cases: Tuple Operations
    if (r instanceof Tuple) {
      // Wir greifen direkt auf das zugrunde liegende Array zu, das ist in JS/TS sicherer
      // bei komplexen Union-Types als der generische .get() Aufruf.
      const val = r.values; 

      // Kleene Star: [RegExp, '*']
      if (val.length === 2 && val[1] === '*') {
        const inner = val[0] as RegExp;
        return kleene(this.gen, this.toNFA(inner));
      }

      // Binary Operations (Concatenation or Union)
      if (val.length === 3) {
        const left = val[0] as RegExp;
        const op = val[1];
        const right = val[2] as RegExp;

        if (op === '⋅') {
           return catenate(this.gen, this.toNFA(left), this.toNFA(right));
        }

        if (op === '+') {
           return disjunction(this.gen, this.toNFA(left), this.toNFA(right));
        }
      }
    }

    throw new Error(`${JSON.stringify(r)} is not a proper regular expression.`);
  }

}