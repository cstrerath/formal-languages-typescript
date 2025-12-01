import { RecursiveSet } from "recursive-set";

// ============================================================
// 1. Type Definitions
// ============================================================

/** Abstract type for states (can be string or number) */
export type State = string | number;

/** Abstract type for characters (alphabet symbols) */
export type Char = string;

/** 
 * Transition relation for NFA: 
 * Maps a string key "state,char" to a set of reachable states.
 */
export type TransRel = Map<string, RecursiveSet<State>>;

/** 
 * Transition relation for DFA: 
 * Maps a string key "stateSet,char" to a single set of states (the target state in DFA).
 * Note: The target is a RecursiveSet<State>, which represents ONE state in the DFA.
 */
export type TransRelDet = Map<string, RecursiveSet<State>>;

/** Non-Deterministic Finite Automaton */
export type NFA = {
  Q: RecursiveSet<State>;
  Sigma: RecursiveSet<Char>;
  delta: TransRel;
  q0: State;
  A: RecursiveSet<State>;
};

/** Deterministic Finite Automaton */
export type DFA = {
  Q: RecursiveSet<RecursiveSet<State>>; // States are sets of NFA states
  Sigma: RecursiveSet<Char>;
  delta: TransRelDet;
  q0: RecursiveSet<State>;
  A: RecursiveSet<RecursiveSet<State>>;
};

// ============================================================
// 2. Helper Functions
// ============================================================

/** Helper to generate unique keys for transition maps */
export function key(q: State | RecursiveSet<State>, c: Char): string {
  return `${q.toString()},${c}`;
}

/** 
 * Computes the union of a set of sets.
 * bigUnion(M) = ⋃ { A | A ∈ M }
 */
export function bigUnion<T>(sets: RecursiveSet<RecursiveSet<T>>): RecursiveSet<T> {
  const result = new RecursiveSet<T>();
  
  for (const subset of sets) {
    const s = subset as RecursiveSet<T>;
    
    for (const x of s) {
      result.add(x as T); 
    }
  }
  return result;
}

// ============================================================
// 3. Core Algorithms
// ============================================================

/**
 * Computes the Epsilon-Closure of a state s using a fixed-point algorithm.
 */
export function epsClosure(s: State, delta: TransRel): RecursiveSet<State> {
  let result = new RecursiveSet<State>(s);

  while (true) {
    const setsToUnite = new RecursiveSet<RecursiveSet<State>>();
    
    for (const q of result) {
        const targets = delta.get(key(q as State, 'ε'));
        if (targets) {
            setsToUnite.add(targets);
        }
    }
    
    const newStates = bigUnion(setsToUnite);
      
    if (newStates.isSubset(result)) {
        return result;
    }
      
    result = result.union(newStates);
  }
}

/**
 * Extended transition function δ̂ (deltaHat).
 * Computes states reachable from s by reading c and then any number of ε-transitions.
 */
export function deltaHat(s: State, c: Char, delta: TransRel): RecursiveSet<State> {
  const directTargets = delta.get(key(s, c));
  
  if (!directTargets) {
      return new RecursiveSet<State>();
  }

  const closures = new RecursiveSet<RecursiveSet<State>>();
  
  for (const q of directTargets) {
      closures.add(epsClosure(q as State, delta));
  }

  return bigUnion(closures);
}

/**
 * Generalized transition function Δ (capitalDelta) for sets of states.
 * Δ(M, c) = ⋃ { δ̂(q, c) | q ∈ M }
 */
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

/**
 * Computes all reachable states of the DFA starting from Q0.
 * Uses a worklist algorithm (Queue/BFS) for efficiency.
 */
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

      if (!states.has(N)) {
        states.add(N);
        queue.push(N);
      }
    }
  }
  return states;
}

/**
 * Alternative Implementation: Fixed-Point Algorithm for allStates.
 * (Closer to mathematical definition, but less efficient than worklist)
 */
export function allStatesFixedPoint(
  Q0: RecursiveSet<State>, 
  delta: TransRel,
  Sigma: RecursiveSet<Char>
): RecursiveSet<RecursiveSet<State>> {
  let result = new RecursiveSet<RecursiveSet<State>>();
  result.add(Q0);

  while (true) {
    const newStates = new RecursiveSet<RecursiveSet<State>>();
    
    for (const M of result) {
       for (const rawC of Sigma) {
           const c = rawC as Char;
           newStates.add(capitalDelta(M as RecursiveSet<State>, c, delta));
       }
    }

    if (newStates.isSubset(result)) {
        return result;
    }
    result = result.union(newStates);
  }
}

/**
 * Main function: Converts an NFA to a DFA (Powerset Construction).
 */
export function nfa2dfa(nfa: NFA): DFA {
  const { Sigma, delta, q0, A } = nfa;

  // 1. Start State
  const newStart: RecursiveSet<State> = epsClosure(q0, delta);
  
  // 2. All Reachable States (using efficient worklist algorithm)
  const newStates: RecursiveSet<RecursiveSet<State>> = allStates(newStart, delta, Sigma);

  // 3. Transition Relation
  const newDelta: TransRelDet = new Map();
  
  for (const dfaState of newStates) {
    const M = dfaState as RecursiveSet<State>; 

    for (const symbol of Sigma) {
        const c = symbol as Char;
        const N = capitalDelta(M, c, delta);
        
        newDelta.set(key(M, c), N);
    }
  }

  // 4. Accepting States
  const newFinal = new RecursiveSet<RecursiveSet<State>>();
  
  for (const dfaState of newStates) {
    const M = dfaState as RecursiveSet<State>;
    
    // A state M is accepting if M ∩ A ≠ ∅
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
