import { RecursiveSet } from "recursive-set";

// --- Types ---

export type State = string | number;
export type Char = string;

export type TransRel = Map<string, RecursiveSet<State>>;
export type TransRelDet = Map<string, RecursiveSet<State>>;

export type NFA = {
  Q: RecursiveSet<State>;
  Sigma: RecursiveSet<Char>;
  delta: TransRel;
  q0: State;
  A: RecursiveSet<State>;
};

export type DFA = {
  Q: RecursiveSet<RecursiveSet<State>>; // Menge der DFA-Zustände (Mengen von NFA-Zuständen)
  Sigma: RecursiveSet<Char>;
  delta: TransRelDet;
  q0: RecursiveSet<State>;
  A: RecursiveSet<RecursiveSet<State>>;
};

// --- Helper Functions ---

export function key(q: State | RecursiveSet<State>, c: Char): string {
  return `${q.toString()},${c}`;
}

export function bigUnion<T>(sets: RecursiveSet<RecursiveSet<T>>): RecursiveSet<T> {
  const result = new RecursiveSet<T>();
  
  for (const subset of sets) {
    // Explicit cast to help TS inference with nested recursive sets
    const s = subset as RecursiveSet<T>;
    for (const x of s) {
      result.add(x as T); 
    }
  }
  return result;
}

// --- Core Algorithms ---

export function epsClosure(s: State, delta: TransRel): RecursiveSet<State> {
  let result = new RecursiveSet<State>(s);

  while (true) {
    const newStates = new RecursiveSet<State>();
    for (const q of result) {
      // q is guaranteed to be a State (primitive) in this NFA context
      const targets = delta.get(key(q as State, 'ε'));
      if (targets) {
        for (const t of targets) newStates.add(t);
      }
    }
    
    const combined = result.union(newStates);

    // Fixed-point check: Size check is sufficient for monotonically growing sets
    if (combined.size === result.size) return result;
    result = combined;
  }
}

export function deltaHat(s: State, c: Char, delta: TransRel): RecursiveSet<State> {
  const reachable = new RecursiveSet<State>();
  const targets = delta.get(key(s, c));

  if (targets) {
    for (const q of targets) {
      const clos = epsClosure(q as State, delta);
      for (const r of clos) reachable.add(r);
    }
  }
  return reachable;
}

export function capitalDelta(
  M: RecursiveSet<State>,
  c: Char,
  delta: TransRel
): RecursiveSet<State> {
  const partials = new RecursiveSet<RecursiveSet<State>>();
  for (const q of M) {
    partials.add(deltaHat(q as State, c, delta));
  }
  return bigUnion(partials);
}

export function allStates(
  Q0: RecursiveSet<State>, 
  delta: TransRel,
  Sigma: RecursiveSet<Char>
): RecursiveSet<RecursiveSet<State>> {
  const states = new RecursiveSet<RecursiveSet<State>>();

  const queue: RecursiveSet<State>[] = [Q0];
  states.add(Q0);

  while (queue.length > 0) {
    const M = queue.shift()!;
    for (const rawC of Sigma) {
      const c = rawC as Char;
      const N = capitalDelta(M, c, delta); 

      // Efficient structural check handled by RecursiveSet
      if (!states.has(N)) {
        states.add(N);
        queue.push(N);
      }
    }
  }
  return states;
}

export function nfa2dfa(nfa: NFA): DFA {
  const { Sigma, delta, q0, A } = nfa;

  const newStart = epsClosure(q0, delta);
  const newStates = allStates(newStart, delta, Sigma);

  const newDelta: TransRelDet = new Map();
  
  // Iterate over DFA states (sets of NFA states)
  for (const rawM of newStates) {
    const M = rawM as RecursiveSet<State>; 

    for (const rawC of Sigma) {
        const c = rawC as Char; 

        const N = capitalDelta(M, c, delta);
        newDelta.set(key(M, c), N);
    }
  }

  const newFinal = new RecursiveSet<RecursiveSet<State>>();
  
  for (const rawM of newStates) {
    const M = rawM as RecursiveSet<State>;
    // Check if M contains any accepting state from NFA
    const intersection = M.intersection(A);
    
    if (!intersection.isEmpty()) {
      newFinal.add(M);
    }
  }

  return {
    Q: newStates,
    Sigma,
    delta: newDelta,
    q0: newStart,
    A: newFinal
  };
}
