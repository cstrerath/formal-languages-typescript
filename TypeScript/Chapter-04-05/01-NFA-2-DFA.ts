import { RecursiveSet } from "recursive-set";

// === Types ===

export type State = string | number;
export type Char = string;

/** Represents a set of NFA states. This acts as a single state in the DFA. */
export type DFAState = RecursiveSet<State>;

/** NFA Transitions: Map<"State,Char", Set<TargetStates>> */
export type TransRel = Map<string, RecursiveSet<State>>;

/** DFA Transitions: Map<"SetOfStates,Char", SetOfStates> */
export type TransRelDet = Map<string, DFAState>;

export type NFA = {
  Q: RecursiveSet<State>;
  Sigma: RecursiveSet<Char>;
  delta: TransRel;
  q0: State;
  A: RecursiveSet<State>;
};

export type DFA = {
  Q: RecursiveSet<DFAState>;
  Sigma: RecursiveSet<Char>;
  delta: TransRelDet;
  q0: DFAState;
  A: RecursiveSet<DFAState>;
};

// === Helper Functions ===

/** Generates a unique key for transition lookups. */
export function key(q: State | DFAState, c: Char): string {
  // v4.0.0: toString() on sets is deterministic (sorted), safe for keys.
  return `${q.toString()},${c}`;
}

/** 
 * Computes the union of a set of sets. 
 * ⋃ M = { x | ∃ A ∈ M : x ∈ A }
 */
export function bigUnion(sets: RecursiveSet<DFAState>): DFAState {
  const result = new RecursiveSet<State>();
  
  for (const subset of sets) {
    for (const x of subset) {
      result.add(x); 
    }
  }
  return result;
}

// === Algorithms ===

/**
 * Computes the Epsilon-Closure of a state s.
 * The set of all states reachable from s via ε-transitions.
 */
export function epsClosure(s: State, delta: TransRel): RecursiveSet<State> {
  let result = new RecursiveSet<State>(s);

  while (true) {
    const setsToUnite = new RecursiveSet<RecursiveSet<State>>();
    
    for (const q of result) {
        const targets = delta.get(key(q, 'ε'));
        if (targets) {
            setsToUnite.add(targets);
        }
    }
    
    const newStates = bigUnion(setsToUnite);
      
    // Optimization: isSubset is fast in v4.0.0
    if (newStates.isSubset(result)) {
        return result;
    }
      
    result = result.union(newStates);
  }
}

/**
 * Computes 𝛿ˆ(s, c).
 * Reachable states from s reading c, followed by any number of ε-transitions.
 */
export function deltaHat(s: State, c: Char, delta: TransRel): RecursiveSet<State> {
  const directTargets = delta.get(key(s, c));
  
  if (!directTargets) {
      return new RecursiveSet<State>();
  }

  const closures = new RecursiveSet<RecursiveSet<State>>();
  for (const q of directTargets) {
      closures.add(epsClosure(q, delta));
  }

  return bigUnion(closures);
}

/**
 * Computes Δ(M, c).
 * Generalization of 𝛿ˆ for a set of states M.
 */
export function capitalDelta(
  M: RecursiveSet<State>,
  c: Char,
  delta: TransRel
): RecursiveSet<State> {
  const partials = new RecursiveSet<RecursiveSet<State>>();
  
  for (const q of M) {
    partials.add(deltaHat(q, c, delta));
  }
  return bigUnion(partials);
}

/**
 * Computes all reachable DFA states using a Queue (Breadth-First Search).
 * Efficient: Checks !states.has(N) in O(1).
 */
export function allStates(
  Q0: RecursiveSet<State>, 
  delta: TransRel,
  Sigma: RecursiveSet<Char>
): RecursiveSet<DFAState> {
  
  const states = new RecursiveSet<DFAState>();
  const queue: DFAState[] = [Q0];
  
  states.add(Q0);

  while (queue.length > 0) {
    const M = queue.shift()!;

    for (const c of Sigma) {
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
 * Computes all reachable DFA states using a Fixed-Point Algorithm.
 * Matches the mathematical definition lfp(F).
 */
export function allStatesFixedPoint(
  Q0: RecursiveSet<State>, 
  delta: TransRel,
  Sigma: RecursiveSet<Char>
): RecursiveSet<DFAState> {
  let result = new RecursiveSet<DFAState>();
  result.add(Q0);

  while (true) {
    const newStates = new RecursiveSet<DFAState>();
    
    for (const M of result) {
       for (const c of Sigma) {
           newStates.add(capitalDelta(M, c, delta));
       }
    }

    if (newStates.isSubset(result)) {
        return result;
    }
    
    result = result.union(newStates);
  }
}

// === Main Conversion ===

/**
 * Converts a Non-Deterministic Finite Automaton (NFA) to a Deterministic Finite Automaton (DFA)
 * using the Powerset Construction (Subset Construction).
 */
export function nfa2dfa(nfa: NFA): DFA {
  const { Sigma, delta, q0, A } = nfa;

  const newStart: DFAState = epsClosure(q0, delta);  
  
  // Use Queue-based search for performance, or swap with allStatesFixedPoint for teaching
  const newStates: RecursiveSet<DFAState> = allStates(newStart, delta, Sigma);
  
  const newDelta: TransRelDet = new Map();
  
  for (const M of newStates) {
    for (const c of Sigma) {
        const N = capitalDelta(M, c, delta);
        newDelta.set(key(M, c), N);
    }
  }

  const newFinal = new RecursiveSet<DFAState>();
  
  for (const M of newStates) {
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
