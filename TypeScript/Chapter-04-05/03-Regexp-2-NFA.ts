import { RecursiveSet, Tuple } from 'recursive-set';

// === Types ===

export type BinaryOp = '⋅' | '+';
export type UnaryOp  = '*';

export type State = number;
export type Char = string;

export type RegExp = 
  | number      // 0 (Empty Set)
  | string      // 'ε' or Char
  | Tuple<[RegExp, UnaryOp]>          // Kleene Star
  | Tuple<[RegExp, BinaryOp, RegExp]>; // Concatenation / Union

// Note: Key generation is now safe due to sorted set toString()
function key(q: State, c: Char): string {
  return `${q},${c}`;
}

export type Delta = Map<string, RecursiveSet<State>>;

export type NFA = {
    Q: RecursiveSet<State>;
    Sigma: RecursiveSet<Char>;
    delta: Delta;
    q0: State;
    A: RecursiveSet<State>;
};

// === Helper Class: State Generator ===

export class StateGenerator {
    private stateCount: number = 0;

    getNewState(): State {
        this.stateCount += 1;
        return this.stateCount;
    }
}

// === Helper: Get Single Element (Clean way) ===

/** Get an arbitrary element from a set (Used to get unique start/end states) */
function getOnlyElement(S: RecursiveSet<State>): State {
    for (const s of S) return s;
    throw new Error("Set is empty, expected one element.");
}

// === NFA Construction Primitives ===

export function genEmptyNFA(gen: StateGenerator, Sigma: RecursiveSet<Char>): NFA {
    const q0 = gen.getNewState();
    const q1 = gen.getNewState();
    
    return {
        Q: new RecursiveSet(q0, q1),
        Sigma: Sigma,
        delta: new Map(),
        q0: q0,
        A: new RecursiveSet(q1)
    };
}

export function genEpsilonNFA(gen: StateGenerator, Sigma: RecursiveSet<Char>): NFA {
    const q0 = gen.getNewState();
    const q1 = gen.getNewState();
    
    const delta: Delta = new Map();
    delta.set(key(q0, 'ε'), new RecursiveSet(q1));
    
    return {
        Q: new RecursiveSet(q0, q1),
        Sigma: Sigma,
        delta: delta,
        q0: q0,
        A: new RecursiveSet(q1)
    };
}

export function genCharNFA(gen: StateGenerator, Sigma: RecursiveSet<Char>, c: Char): NFA {
    const q0 = gen.getNewState();
    const q1 = gen.getNewState();
    
    const delta: Delta = new Map();
    delta.set(key(q0, c), new RecursiveSet(q1));
    
    return {
        Q: new RecursiveSet(q0, q1),
        Sigma: Sigma,
        delta: delta,
        q0: q0,
        A: new RecursiveSet(q1)
    };
}

// === Combination Logic ===

function copyDelta(d1: Delta, d2: Delta): Delta {
    const newDelta = new Map(d1);
    for (const [k, v] of d2) {
        newDelta.set(k, v);
    }
    return newDelta;
}

export function catenate(gen: StateGenerator, f1: NFA, f2: NFA): NFA {
    const { Q: Q1, Sigma, delta: delta1, q0: q1, A: A1 } = f1;
    const { Q: Q2, delta: delta2, q0: q3, A: A2 } = f2;
    
    // Connect End of F1 (q2) -> Start of F2 (q3) via Epsilon
    const q2 = getOnlyElement(A1);
    
    const delta = copyDelta(delta1, delta2);
    delta.set(key(q2, 'ε'), new RecursiveSet(q3));
    
    return {
        Q: Q1.union(Q2),
        Sigma: Sigma,
        delta: delta,
        q0: q1,
        A: A2
    };
}

export function disjunction(gen: StateGenerator, f1: NFA, f2: NFA): NFA {
    const { Q: Q1, Sigma, delta: delta1, q0: q1, A: A1 } = f1;
    const { Q: Q2, delta: delta2, q0: q2, A: A2 } = f2;
    
    const q3 = getOnlyElement(A1);
    const q4 = getOnlyElement(A2);
    
    const q0 = gen.getNewState();
    const q5 = gen.getNewState();
    
    const delta = copyDelta(delta1, delta2);
    
    // Split: q0 -> q1 (Start F1) and q0 -> q2 (Start F2)
    delta.set(key(q0, 'ε'), new RecursiveSet(q1, q2));
    
    // Join: q3 (End F1) -> q5 and q4 (End F2) -> q5
    delta.set(key(q3, 'ε'), new RecursiveSet(q5));
    delta.set(key(q4, 'ε'), new RecursiveSet(q5));
    
    return {
        Q: new RecursiveSet(q0, q5).union(Q1).union(Q2),
        Sigma: Sigma,
        delta: delta,
        q0: q0,
        A: new RecursiveSet(q5)
    };
}

export function kleene(gen: StateGenerator, f: NFA): NFA {
    const { Q: M, Sigma, delta: delta0, q0: q1, A } = f;
    
    const q2 = getOnlyElement(A);
    
    const q0 = gen.getNewState();
    const q3 = gen.getNewState();
    
    const delta = new Map(delta0);
    
    // Loop Logic:
    // q0 -> q1 (Enter)
    // q0 -> q3 (Skip/Empty)
    // q2 -> q1 (Loop back)
    // q2 -> q3 (Exit)
    delta.set(key(q0, 'ε'), new RecursiveSet(q1, q3));
    delta.set(key(q2, 'ε'), new RecursiveSet(q1, q3));
    
    return {
        Q: new RecursiveSet(q0, q3).union(M),
        Sigma: Sigma,
        delta: delta,
        q0: q0,
        A: new RecursiveSet(q3)
    };
}

// === Main Class ===

export class RegExp2NFA {
  private gen: StateGenerator;
  private sigma: RecursiveSet<Char>;

  constructor(sigma: RecursiveSet<Char>) {
    this.sigma = sigma;
    this.gen = new StateGenerator();
  }

  public toNFA(r: RegExp): NFA {
    // Base Case: Empty Set
    if (r === 0) {
      return genEmptyNFA(this.gen, this.sigma);
    }

    // Base Case: Epsilon
    if (r === 'ε') {
      return genEpsilonNFA(this.gen, this.sigma);
    }

    // Base Case: Character
    if (typeof r === 'string' && r.length === 1) {
      return genCharNFA(this.gen, this.sigma, r);
    }

    // Recursive Step: Tuple (Operations)
    if (r instanceof Tuple) {
      const val = r.values; 

      // Kleene Star: [RegExp, '*']
      if (val.length === 2 && val[1] === '*') {
        const inner = val[0] as RegExp;
        return kleene(this.gen, this.toNFA(inner));
      }

      // Binary Ops: [RegExp, Op, RegExp]
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
    
    // If we reach here, the input was not a valid RegExp structure
    throw new Error(`Invalid RegExp structure: ${JSON.stringify(r)}`);
  }
}
