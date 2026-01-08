import { RecursiveSet, Tuple } from 'recursive-set';

export type BinaryOp = '⋅' | '+';
export type UnaryOp = '*';

type State = number;
type Char = string;
export type RegExp =
  | number
  | string
  | Tuple<[RegExp, UnaryOp]>
  | Tuple<[RegExp, BinaryOp, RegExp]>;

function key(q: State, c: Char): string {
  return `${q},${c}`;
}

type Delta = Map<string, RecursiveSet<State>>;

export type NFA = {
  Q: RecursiveSet<State>;
  Sigma: RecursiveSet<Char>;
  delta: Delta;
  q0: State;
  A: RecursiveSet<State>;
};

class StateGenerator {
  private stateCount: number = 0;

  getNewState(): State {
    return ++this.stateCount;
  }
}

function getOnlyElement(S: RecursiveSet<State>): State {
  if (S.isEmpty()) {
    throw new Error('Set is empty, expected at least one element.');
  }
  return S.raw[0];
}

function genEmptyNFA(gen: StateGenerator, Sigma: RecursiveSet<Char>): NFA {
  const q0 = gen.getNewState();
  const q1 = gen.getNewState();

  return {
    Q: RecursiveSet.fromSortedUnsafe([q0, q1]),
    Sigma: Sigma,
    delta: new Map(),
    q0: q0,
    A: RecursiveSet.fromSortedUnsafe([q1]),
  };
}

function genEpsilonNFA(gen: StateGenerator, Sigma: RecursiveSet<Char>): NFA {
  const q0 = gen.getNewState();
  const q1 = gen.getNewState();

  const delta: Delta = new Map();
  delta.set(key(q0, 'ε'), RecursiveSet.fromSortedUnsafe([q1]));

  return {
    Q: RecursiveSet.fromSortedUnsafe([q0, q1]),
    Sigma: Sigma,
    delta: delta,
    q0: q0,
    A: RecursiveSet.fromSortedUnsafe([q1]),
  };
}

function genCharNFA(
  gen: StateGenerator,
  Sigma: RecursiveSet<Char>,
  c: Char
): NFA {
  const q0 = gen.getNewState();
  const q1 = gen.getNewState();

  const delta: Delta = new Map();
  delta.set(key(q0, c), RecursiveSet.fromSortedUnsafe([q1]));

  return {
    Q: RecursiveSet.fromSortedUnsafe([q0, q1]),
    Sigma: Sigma,
    delta: delta,
    q0: q0,
    A: RecursiveSet.fromSortedUnsafe([q1]),
  };
}

function copyDelta(d1: Delta, d2: Delta): Delta {
  const newDelta = new Map(d1);
  for (const [k, v] of d2) {
    newDelta.set(k, v);
  }
  return newDelta;
}

function catenate(gen: StateGenerator, f1: NFA, f2: NFA): NFA {
  const q1 = f1.q0;
  const q3 = f2.q0;

  const q2 = getOnlyElement(f1.A);

  const delta = copyDelta(f1.delta, f2.delta);

  delta.set(key(q2, 'ε'), RecursiveSet.fromSortedUnsafe([q3]));

  return {
    Q: f1.Q.union(f2.Q),
    Sigma: f1.Sigma,
    delta: delta,
    q0: q1,
    A: f2.A,
  };
}

function disjunction(gen: StateGenerator, f1: NFA, f2: NFA): NFA {
  const q1 = f1.q0;
  const q2 = f2.q0;

  const q3 = getOnlyElement(f1.A);
  const q4 = getOnlyElement(f2.A);

  const q0 = gen.getNewState();
  const q5 = gen.getNewState();

  const delta = copyDelta(f1.delta, f2.delta);

  delta.set(key(q0, 'ε'), new RecursiveSet(q1, q2));

  const targetQ5 = RecursiveSet.fromSortedUnsafe([q5]);
  delta.set(key(q3, 'ε'), targetQ5);
  delta.set(key(q4, 'ε'), targetQ5);

  const newStates = RecursiveSet.fromSortedUnsafe([q0, q5]);

  return {
    Q: newStates.union(f1.Q).union(f2.Q),
    Sigma: f1.Sigma,
    delta: delta,
    q0: q0,
    A: targetQ5,
  };
}

function kleene(gen: StateGenerator, f: NFA): NFA {
  const q1 = f.q0;
  const q2 = getOnlyElement(f.A);

  const q0 = gen.getNewState();
  const q3 = gen.getNewState();

  const delta = new Map(f.delta);

  const targets = new RecursiveSet(q1, q3);

  delta.set(key(q0, 'ε'), targets);
  delta.set(key(q2, 'ε'), targets);

  const newStates = RecursiveSet.fromSortedUnsafe([q0, q3]);

  return {
    Q: newStates.union(f.Q),
    Sigma: f.Sigma,
    delta: delta,
    q0: q0,
    A: RecursiveSet.fromSortedUnsafe([q3]),
  };
}

export class RegExp2NFA {
  private gen: StateGenerator;
  private sigma: RecursiveSet<Char>;

  constructor(sigma: RecursiveSet<Char>) {
    this.sigma = sigma;
    this.gen = new StateGenerator();
  }

  public toNFA(r: RegExp): NFA {
    if (r === 0) {
      return genEmptyNFA(this.gen, this.sigma);
    }

    if (r === 'ε') {
      return genEpsilonNFA(this.gen, this.sigma);
    }

    if (typeof r === 'string' && r.length === 1) {
      return genCharNFA(this.gen, this.sigma, r);
    }

    if (r instanceof Tuple) {
      const val = r.raw;

      if (val.length === 2 && val[1] === '*') {
        const inner = val[0] as RegExp;
        return kleene(this.gen, this.toNFA(inner));
      }

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

    throw new Error(`Invalid RegExp structure: ${JSON.stringify(r)}`);
  }
}
