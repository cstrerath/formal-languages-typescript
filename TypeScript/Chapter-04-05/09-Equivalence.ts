import { RecursiveSet, Tuple } from 'recursive-set';
import {
  State,
  Char,
  DFA,
  DFAState,
  nfa2dfa,
  key as fsmKey,
} from './01-NFA-2-DFA';
import { RegExp, RegExp2NFA } from './03-RegExp-2-NFA';

export type StatePair = Tuple<[DFAState, DFAState]>;

export type ProductDFA = {
  Q: RecursiveSet<StatePair>;
  Sigma: RecursiveSet<Char>;
  delta: Map<string, StatePair>;
  q0: StatePair;
  A: RecursiveSet<StatePair>;
};

function genKeyPair(state: StatePair, c: Char): string {
  return `${state.toString()},${c}`;
}

export function fsm_complement(F1: DFA, F2: DFA): ProductDFA {
  // 1. New State Set: Q1 x Q2
  const newStates = F1.Q.cartesianProduct(F2.Q);

  const newDelta = new Map<string, StatePair>();

  // 2. Construct Transition Function
  for (const pair of newStates) {
    // === FIX: Cast explicit to DFAState ===
    // TS implies 'Value', but we know it's a DFAState because F1.Q contains DFAStates
    const p1 = pair.values[0] as DFAState;
    const p2 = pair.values[1] as DFAState;

    for (const c of F1.Sigma) {
      const next1 = F1.delta.get(fsmKey(p1, c));
      const next2 = F2.delta.get(fsmKey(p2, c));

      if (next1 && next2) {
        const nextPair = new Tuple<[DFAState, DFAState]>(next1, next2);
        newDelta.set(genKeyPair(pair, c), nextPair);
      }
    }
  }

  // 3. Start State
  const startPair = new Tuple<[DFAState, DFAState]>(F1.q0, F2.q0);

  // 4. Accepting States: A1 x (Q2 \ A2)
  const diffSet = F2.Q.difference(F2.A);
  const newAccepting = F1.A.cartesianProduct(diffSet);

  return {
    Q: newStates,
    Sigma: F1.Sigma,
    delta: newDelta,
    q0: startPair,
    A: newAccepting,
  };
}

export function regexp2DFA(r: RegExp, Sigma: RecursiveSet<Char>): DFA {
  const converter = new RegExp2NFA(Sigma);
  const nfa = converter.toNFA(r);
  return nfa2dfa(nfa);
}

export function is_empty(F: ProductDFA): boolean {
  // Start set: {q0}
  let reachable = new RecursiveSet<StatePair>(F.q0);

  while (true) {
    const newFound = new RecursiveSet<StatePair>();

    // Find all successors
    for (const q of reachable) {
      for (const c of F.Sigma) {
        const target = F.delta.get(genKeyPair(q, c));
        if (target) {
          newFound.add(target);
        }
      }
    }

    // Fixed-Point Check: If newFound is a subset of reachable,
    // we haven't found any new states.
    if (newFound.isSubset(reachable)) {
      break;
    }

    // Expand set: reachable = reachable U newFound
    reachable = reachable.union(newFound);
  }

  // Check if the intersection of reachable states and accepting states is empty
  // L(F) is empty <=> Intersection is empty
  return reachable.intersection(F.A).isEmpty();
}

export function regExpEquiv(
  r1: RegExp,
  r2: RegExp,
  Sigma: RecursiveSet<Char>
): boolean {
  // 1. Convert to DFAs
  const F1 = regexp2DFA(r1, Sigma);
  const F2 = regexp2DFA(r2, Sigma);

  // 2. Build Difference Automata
  // L(F1) \ L(F2)
  const r1MinusR2 = fsm_complement(F1, F2);
  // L(F2) \ L(F1)
  const r2MinusR1 = fsm_complement(F2, F1);

  // 3. Check if both differences are empty
  return is_empty(r1MinusR2) && is_empty(r2MinusR1);
}
