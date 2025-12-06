import { RecursiveSet, Tuple } from 'recursive-set';
import { DFA, State, Char, key } from './01-NFA-2-DFA';

// ============================================================
// 1. Type Definitions
// ============================================================

/** Char is an alias for string */
// (Bereits durch ./01-NFA-2-DFA importiert, aber hier der Vollständigkeit halber erwähnt)

/**
 * Level 2: Ein DFA-Zustand ist eine Menge von NFA-Zuständen
 * (entspricht RecursiveSet<State> in deinem System)
 */
export type DfaState = RecursiveSet<State>;

/**
 * Level 3: Ein Zustand im minimierten DFA ist eine Menge von DFA-Zuständen (Äquivalenzklasse)
 * Dies entspricht dem Typ SetState im Notebook.
 */
export type DfaStateSet = RecursiveSet<DfaState>;

/**
 * Pair is a pair of states.
 * Wir nutzen Tuple<[DfaState, DfaState]> für ein Paar (q1, q2).
 */
export type StatePair = Tuple<[DfaState, DfaState]>;

/**
 * Transition Relation für den minimierten Automaten
 * Key: "DfaStateSet,Char" -> Value: DfaStateSet
 */
export type TransRelMin = Map<string, DfaStateSet>;

/**
 * Der minimierte DFA (entspricht MinDFA im Notebook)
 * Er unterscheidet sich vom normalen DFA durch die tiefer verschachtelten Zustände.
 */
export type MinDFA = {
  Q: RecursiveSet<DfaStateSet>;
  Sigma: RecursiveSet<Char>;
  delta: TransRelMin;
  q0: DfaStateSet;
  A: RecursiveSet<DfaStateSet>;
};

// ============================================================
// 2. Helper Functions
// ============================================================

/**
 * The function arbM takes a non-empty set M and returns an arbitrary element.
 */
export function arbM<S>(M: RecursiveSet<S>): S {
  for (const x of M) {
    // Cast notwendig, da Iterator theoretisch auch geschachtelte Sets liefern könnte
    return x as S;
  }
  throw new Error('Error: arb called with empty set!');
}

/**
 * The function cartprod computes the Cartesian product A x B.
 * Rückgabetyp ist präzise ein Set von Tuples [S, T].
 */
export function cartprod<S, T>(
  A: RecursiveSet<S>,
  B: RecursiveSet<T>
): RecursiveSet<Tuple<[S, T]>> {
  const result = new RecursiveSet<Tuple<[S, T]>>();
  for (const x of A) {
    for (const y of B) {
      // Casts notwendig für saubere Typisierung bei Generics
      result.add(new Tuple(x as S, y as T));
    }
  }
  return result;
}

/**
 * Beispiel aus Zelle 14: cartprod({1, 2}, {'a', 'b', 'c'})
 * Dies dient als Demonstration/Test.
 */
export function runCartProdExample() {
  const A = new RecursiveSet(1, 2);
  const B = new RecursiveSet('a', 'b', 'c');
  const result = cartprod(A, B);
  console.log(`cartprod({1, 2}, {'a', 'b', 'c'}) result:`);
  console.log(result.toString());
}

/**
 * The function separatePairs computes the set of pairs of states (q1, q2) that are separable.
 * Two states are separable if they transition to states (p1, p2) that are already known to be separable.
 */
export function separatePairs(
  Pairs: RecursiveSet<StatePair>,
  States: RecursiveSet<DfaState>,
  Sigma: RecursiveSet<Char>,
  delta: Map<string, DfaState>
): RecursiveSet<StatePair> {
  const Result = new RecursiveSet<StatePair>();

  // Explizite Iteration mit Casts für Typsicherheit
  for (const rawQ1 of States) {
    const q1 = rawQ1 as DfaState;
    for (const rawQ2 of States) {
      const q2 = rawQ2 as DfaState;

      for (const rawC of Sigma) {
        const c = rawC as Char;

        // Wir greifen auf die ursprüngliche delta-Funktion zu
        const p1 = delta.get(key(q1, c));
        const p2 = delta.get(key(q2, c));

        if (p1 && p2) {
          const successorPair = new Tuple(p1, p2);
          if (Pairs.has(successorPair)) {
            Result.add(new Tuple(q1, q2));
            // Optimierung: Ein Trenner reicht
            break;
          }
        }
      }
    }
  }
  return Result;
}

/**
 * Returns the equivalence class of p (the set of states in Partition that contains p).
 */
export function findEquivalenceClass(
  p: DfaState,
  Partition: RecursiveSet<DfaStateSet>
): DfaStateSet {
  for (const rawC of Partition) {
    const C = rawC as DfaStateSet;
    if (C.has(p)) return C;
  }
  throw new Error(`State ${p} not found in any equivalence class`);
}

/**
 * Returns the set of all states that can be reached from the start state q0.
 * Uses fixed point computation.
 */
export function reachable(
  q0: DfaState,
  Sigma: RecursiveSet<Char>,
  delta: Map<string, DfaState>
): RecursiveSet<DfaState> {
  let Result = new RecursiveSet<DfaState>(q0);

  while (true) {
    const NewStates = new RecursiveSet<DfaState>();

    for (const rawP of Result) {
      const p = rawP as DfaState;
      for (const rawC of Sigma) {
        const c = rawC as Char;
        const target = delta.get(key(p, c));
        if (target) NewStates.add(target);
      }
    }

    if (NewStates.isSubset(Result)) return Result;
    Result = Result.union(NewStates);
  }
}

/**
 * Computes the set of all Pairs (p, q) such that p and q are separable.
 * Uses fixed point computation starting with (Accepting, Non-Accepting).
 */
export function allSeparable(
  Q: RecursiveSet<DfaState>,
  A: RecursiveSet<DfaState>,
  Sigma: RecursiveSet<Char>,
  delta: Map<string, DfaState>
): RecursiveSet<StatePair> {
  const nonAccepting = Q.difference(A);

  let Separable = cartprod(nonAccepting, A);
  const Separable2 = cartprod(A, nonAccepting);

  Separable = Separable.union(Separable2);

  while (true) {
    const NewPairs = separatePairs(Separable, Q, Sigma, delta);
    if (NewPairs.isSubset(Separable)) return Separable;
    Separable = Separable.union(NewPairs);
  }
}

// ============================================================
// 3. Main Minimization Function
// ============================================================

/**
 * Minimizes a DFA by identifying equivalent states.
 * Returns a MinDFA structure where states are sets of original DFA states.
 */
export function minimizeDFA(F: DFA): MinDFA {
  const { Q, Sigma, delta, q0, A } = F;

  const inputQ = Q as RecursiveSet<DfaState>;
  const inputQ0 = q0 as DfaState;
  const inputA = A as RecursiveSet<DfaState>;

  // 1. Unreachable states are eliminated.
  const ReachableQ = reachable(inputQ0, Sigma, delta);
  const ReachableA = inputA.intersection(ReachableQ);

  // 2/3. States are separated as long as possible.
  const Separable = allSeparable(ReachableQ, ReachableA, Sigma, delta);

  // 4. States that are not separable are equivalent.
  const allPairs = cartprod(ReachableQ, ReachableQ);
  const Equivalent = allPairs.difference(Separable);

  // Build Equivalence Classes
  const EquivClasses = new RecursiveSet<DfaStateSet>();

  for (const rawQ of ReachableQ) {
    const q = rawQ as DfaState;
    const equivalenceClass = new RecursiveSet<DfaState>();

    for (const rawP of ReachableQ) {
      const p = rawP as DfaState;
      const pair = new Tuple(p, q);
      if (Equivalent.has(pair)) {
        equivalenceClass.add(p);
      }
    }
    EquivClasses.add(equivalenceClass);
  }

  // New Start State
  const newQ0 = findEquivalenceClass(inputQ0, EquivClasses);

  // New Accepting States
  const newAccept = new RecursiveSet<DfaStateSet>();
  for (const rawM of EquivClasses) {
    const M = rawM as DfaStateSet;
    const representative = arbM(M);
    if (ReachableA.has(representative)) {
      newAccept.add(M);
    }
  }

  // New Transitions
  const newDelta: TransRelMin = new Map();

  for (const rawQ of ReachableQ) {
    const q = rawQ as DfaState;
    const classOfQ = findEquivalenceClass(q, EquivClasses);

    for (const rawC of Sigma) {
      const c = rawC as Char;
      const target = delta.get(key(q, c));

      if (target) {
        const classOfP = findEquivalenceClass(target, EquivClasses);

        // Hier nutzen wir `any` NUR für den Key-Generator, da key() streng typisiert ist
        // und wir hier "Level 3"-Zustände haben. Das ist laufzeit-sicher.
        newDelta.set(key(classOfQ as any, c), classOfP);
      }
    }
  }

  return {
    Q: EquivClasses,
    Sigma: Sigma,
    delta: newDelta,
    q0: newQ0,
    A: newAccept,
  };
}
