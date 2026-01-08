import { RecursiveSet, Tuple, Value } from 'recursive-set';
import { key } from './05-DFA-2-RegExp';

// === Existing Types ===
export type State = string | number;
export type Char = string;

// A state in our current DFA (potentially formed by subset construction)
export type DFAState = RecursiveSet<State>;

export type TransRelDet = Map<string, DFAState>;

export type DFA = {
  Q: RecursiveSet<DFAState>;
  Sigma: RecursiveSet<Char>;
  delta: TransRelDet;
  q0: DFAState;
  A: RecursiveSet<DFAState>;
};

// === New Types for Minimization ===

// A pair of states (p, q)
export type Pair = Tuple<[DFAState, DFAState]>;

// A state in the Minimized DFA is a set of original DFAStates (Equivalence Class)
export type MinState = RecursiveSet<DFAState>;

export type MinTransRel = Map<string, MinState>;

export type MinDFA = {
  Q: RecursiveSet<MinState>;
  Sigma: RecursiveSet<Char>;
  delta: MinTransRel;
  q0: MinState;
  A: RecursiveSet<MinState>;
};

// === Helper Functions ===

export function arb<T extends Value>(M: RecursiveSet<T>): T {
  for (const x of M) {
    return x;
  }
  throw new Error('Error: arb called with empty set!');
}

export function cartProd<S extends Value, T extends Value>(
  A: RecursiveSet<S>,
  B: RecursiveSet<T>
): RecursiveSet<Tuple<[S, T]>> {
  return A.cartesianProduct(B);
}

// === Separation Logic ===

export function separate(
  Pairs: RecursiveSet<Pair>,
  States: RecursiveSet<DFAState>,
  Sigma: RecursiveSet<Char>,
  delta: TransRelDet
): RecursiveSet<Pair> {
  const result = new RecursiveSet<Pair>();

  for (const q1 of States) {
    for (const q2 of States) {
      for (const c of Sigma) {
        // Get targets
        const p1 = delta.get(key(q1, c));
        const p2 = delta.get(key(q2, c));

        // If transitions exist
        if (p1 && p2) {
          // Check if the pair of targets (p1, p2) is already in the Separable set
          // We must construct the tuple to check existence in RecursiveSet
          const targetPair = new Tuple<[DFAState, DFAState]>(p1, p2);

          if (Pairs.has(targetPair)) {
            result.add(new Tuple<[DFAState, DFAState]>(q1, q2));
          }
        }
      }
    }
  }
  return result;
}

export function findEquivalenceClass(
  p: DFAState,
  Partition: RecursiveSet<MinState>
): MinState {
  // Find the set C in Partition such that p is in C
  for (const C of Partition) {
    if (C.has(p)) {
      return C;
    }
  }
  throw new Error(`State ${p} not found in partition`);
}

export function allSeparable(
  Q: RecursiveSet<DFAState>,
  A: RecursiveSet<DFAState>,
  Sigma: RecursiveSet<Char>,
  delta: TransRelDet
): RecursiveSet<Pair> {
  // Q without A (Non-accepting states)
  const NonAccepting = Q.difference(A);

  // Base Case: Pairs (NonAccepting, Accepting) and vice versa
  const set1 = cartProd(NonAccepting, A);
  const set2 = cartProd(A, NonAccepting);

  // Initial distinguishable pairs
  let Separable = set1.union(set2);

  // Fixed Point Loop
  while (true) {
    // Find new pairs that lead to already separable pairs in one step
    const NewPairs = separate(Separable, Q, Sigma, delta);

    // Check if NewPairs is a subset of Separable (Fixpoint check)
    if (NewPairs.isSubset(Separable)) {
      return Separable;
    }

    // Expand the set (Separable |= NewPairs)
    Separable = Separable.union(NewPairs);
  }
}

export function reachable(
  q0: DFAState,
  Sigma: RecursiveSet<Char>,
  delta: TransRelDet
): RecursiveSet<DFAState> {
  let Result = new RecursiveSet<DFAState>(q0);

  while (true) {
    const NewStates = new RecursiveSet<DFAState>();

    // Find all states reachable in one step from current set
    for (const p of Result) {
      for (const c of Sigma) {
        const target = delta.get(key(p, c));
        if (target) {
          NewStates.add(target);
        }
      }
    }

    // Check for subset (Fixpoint check)
    if (NewStates.isSubset(Result)) {
      return Result;
    }

    // Result |= NewStates
    Result = Result.union(NewStates);
  }
}

// Local helper to generate keys for the minimized states (Sets of Sets)
function minKey(q: MinState, c: Char): string {
  return `${q.toString()},${c}`;
}

export function minimize(F: DFA): MinDFA {
  let { Q, Sigma, delta, q0, A } = F;

  // 1. Filter Reachable States
  Q = reachable(q0, Sigma, delta);

  // 2. Calculate Separable Pairs (Restrict A to reachable states)
  const reachableA = A.intersection(Q);
  const Separable = allSeparable(Q, reachableA, Sigma, delta);

  // 3. Identify Equivalent Pairs (Total Pairs minus Separable Pairs)
  const EquivClasses = new RecursiveSet<MinState>();

  // To avoid duplicates, track processed states
  const Processed = new RecursiveSet<DFAState>();

  for (const q of Q) {
    if (Processed.has(q)) continue;

    const equivalenceClass = new RecursiveSet<DFAState>();

    // Find all p equivalent to q (i.e., pair (p,q) is NOT in Separable)
    for (const p of Q) {
      const pairToCheck = new Tuple<[DFAState, DFAState]>(p, q);
      if (!Separable.has(pairToCheck)) {
        equivalenceClass.add(p);
        Processed.add(p);
      }
    }
    EquivClasses.add(equivalenceClass);
  }

  // 4. Construct New Start State
  let newQ0: MinState | undefined;
  for (const M of EquivClasses) {
    if (M.has(q0)) {
      newQ0 = M;
      break;
    }
  }
  if (!newQ0) throw new Error('Start state vanished!');

  // 5. Construct New Accepting States
  const newAccept = new RecursiveSet<MinState>();
  for (const M of EquivClasses) {
    const representative = arb(M);
    // If the representative is accepting, the whole class is accepting
    if (A.has(representative)) {
      newAccept.add(M);
    }
  }

  // 6. Construct New Delta
  const newDelta: MinTransRel = new Map();
  for (const M of EquivClasses) {
    // Pick a representative
    const q = arb(M);
    for (const c of Sigma) {
      const target = delta.get(key(q, c));

      if (target) {
        // Find which class the target belongs to
        const targetClass = findEquivalenceClass(target, EquivClasses);
        // Use minKey here instead of imported key
        newDelta.set(minKey(M, c), targetClass);
      }
    }
  }

  return {
    Q: EquivClasses,
    Sigma,
    delta: newDelta,
    q0: newQ0,
    A: newAccept,
  };
}
