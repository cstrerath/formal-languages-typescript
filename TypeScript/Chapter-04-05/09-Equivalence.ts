// 09-Equivalence.ts

import { RecursiveSet, Tuple } from 'recursive-set';
import {
  Char,
  DFA,
  DFAState,
  nfa2dfa,
  key as dfaKey,
  NFA,
} from './01-NFA-2-DFA';
import { RegExp, RegExp2NFA } from './03-RegExp-2-NFA';

/**
 * Zustände im Produktautomaten: Paare von DFA-Zuständen.
 */
export type StatePair = Tuple<[DFAState, DFAState]>;

/**
 * Produkt-DFA für Sprachen der Form L(F1)\L(F2).
 */
export type ProductDFA = {
  Q: RecursiveSet<StatePair>;
  Sigma: RecursiveSet<Char>;
  delta: Map<string, StatePair>;
  q0: StatePair;
  A: RecursiveSet<StatePair>;
};

/**
 * Key-Funktion für Produktzustände.
 */
function keyPair(state: StatePair, c: Char): string {
  return `${state.toString()},${c}`;
}

/**
 * Von RegExp nach DFA über RegExp2NFA + nfa2dfa.
 */
export function regexp2DFA(r: RegExp, Sigma: RecursiveSet<Char>): DFA {
  const converter = new RegExp2NFA(Sigma);
  const nfa: NFA = converter.toNFA(r);
  return nfa2dfa(nfa);
}

/**
 * Konstruiert den Produkt-DFA für L(F1) \ L(F2).
 * Alphabet wird aus F1 übernommen (beide sollten dasselbe Sigma haben).
 */
export function fsm_complement(F1: DFA, F2: DFA): ProductDFA {
  const newStates: RecursiveSet<StatePair> = F1.Q.cartesianProduct(F2.Q);
  const newDelta: Map<string, StatePair> = new Map();

  for (const pair of newStates) {
    const p1: DFAState = pair.values[0];
    const p2: DFAState = pair.values[1];

    for (const c of F1.Sigma) {
      const next1 = F1.delta.get(dfaKey(p1, c));
      const next2 = F2.delta.get(dfaKey(p2, c));

      if (next1 && next2) {
        const nextPair: StatePair = new Tuple<[DFAState, DFAState]>(
          next1,
          next2
        );
        newDelta.set(keyPair(pair, c), nextPair);
      }
    }
  }

  const startPair: StatePair = new Tuple<[DFAState, DFAState]>(F1.q0, F2.q0);

  const diffSet: RecursiveSet<DFAState> = F2.Q.difference(F2.A);
  const newAccepting: RecursiveSet<StatePair> = F1.A.cartesianProduct(diffSet);

  return {
    Q: newStates,
    Sigma: F1.Sigma,
    delta: newDelta,
    q0: startPair,
    A: newAccepting,
  };
}

/**
 * Prüft, ob die von einem Produkt-DFA akzeptierte Sprache leer ist.
 */
export function is_empty(F: ProductDFA): boolean {
  let reachable: RecursiveSet<StatePair> = new RecursiveSet<StatePair>(F.q0);

  while (true) {
    const newFound: RecursiveSet<StatePair> = new RecursiveSet<StatePair>();

    for (const q of reachable) {
      for (const c of F.Sigma) {
        const target = F.delta.get(keyPair(q, c));
        if (target) {
          newFound.add(target);
        }
      }
    }

    if (newFound.isSubset(reachable)) {
      break;
    }

    reachable = reachable.union(newFound);
  }

  return reachable.intersection(F.A).isEmpty();
}

/**
 * Hauptfunktion: Prüft die Äquivalenz zweier RegExp über einem Alphabet Σ.
 */
export function regExpEquiv(
  r1: RegExp,
  r2: RegExp,
  Sigma: RecursiveSet<Char>
): boolean {
  const F1: DFA = regexp2DFA(r1, Sigma);
  const F2: DFA = regexp2DFA(r2, Sigma);

  const r1MinusR2: ProductDFA = fsm_complement(F1, F2);
  const r2MinusR1: ProductDFA = fsm_complement(F2, F1);

  return is_empty(r1MinusR2) && is_empty(r2MinusR1);
}
