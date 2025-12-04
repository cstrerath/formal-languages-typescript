import { RecursiveSet, Tuple } from 'recursive-set';
import { State, Char, DFA, NFA, nfa2dfa } from './01-NFA-2-DFA';
import { RegExp, RegExp2NFA } from './03-RegExp-2-NFA';

// === Type Definitions ===

// Tuple erwartet ein Array-Format für Generics: Tuple<[S, S]>
export type StatePair<S> = Tuple<[S, S]>;

export type GenericDFA<S> = {
  Q: RecursiveSet<S>;
  Sigma: RecursiveSet<Char>;
  delta: Map<string, S>;
  q0: S;
  A: RecursiveSet<S>;
};

// === Helper Functions ===

export function genKey<S>(state: S, c: Char): string {
  return `${String(state)},${c}`;
}

// === Core Functions ===

export function fsm_complement<S>(
  F1: GenericDFA<S>,
  F2: GenericDFA<S>
): GenericDFA<StatePair<S>> {
  // Wir weisen Variablen einzeln zu, um Destructuring-Konflikte mit "exports" zu vermeiden
  const Q1 = F1.Q;
  const Sigma = F1.Sigma;
  const delta1 = F1.delta;
  const q1 = F1.q0;
  const A1 = F1.A;

  const Q2 = F2.Q;
  const delta2 = F2.delta;
  const q2 = F2.q0;
  const A2 = F2.A;

  // Casten des Rückgabewerts auf den erwarteten Typ
  const newStates = Q1.cartesianProduct(Q2) as RecursiveSet<StatePair<S>>;

  const newDelta = new Map<string, StatePair<S>>();

  for (const element of newStates) {
    // ASSERTION: Wir wissen, dass element ein Tuple ist
    const statePair = element as StatePair<S>;

    const p1 = statePair.get(0);
    const p2 = statePair.get(1);

    if (p1 === undefined || p2 === undefined) continue;

    for (const sigmaElement of Sigma) {
      // ASSERTION: Wir wissen, dass sigmaElement ein Char ist
      const c = sigmaElement as unknown as Char;

      const next1 = delta1.get(genKey(p1, c));
      const next2 = delta2.get(genKey(p2, c));

      if (next1 !== undefined && next2 !== undefined) {
        const nextPair = new Tuple(next1, next2);
        newDelta.set(genKey(statePair, c), nextPair);
      }
    }
  }

  const startPair = new Tuple(q1, q2);

  const diffSet = Q2.difference(A2);
  const newAccepting = A1.cartesianProduct(diffSet) as RecursiveSet<
    StatePair<S>
  >;

  return {
    Q: newStates,
    Sigma: Sigma,
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

export function is_empty<S>(F: GenericDFA<S>): boolean {
  const Sigma = F.Sigma;
  const delta = F.delta;
  const q0 = F.q0;
  const A = F.A;

  let reachable = new RecursiveSet<S>(q0);

  while (true) {
    const newFound = new RecursiveSet<S>();

    for (const q of reachable) {
      const state = q as S;

      for (const sigmaElement of Sigma) {
        const c = sigmaElement as unknown as Char;

        const target = delta.get(genKey(state, c));
        if (target !== undefined) {
          newFound.add(target);
        }
      }
    }

    if (newFound.isSubset(reachable)) {
      break;
    }
    reachable = reachable.union(newFound);
  }

  return reachable.intersection(A).isEmpty();
}

export function regExpEquiv(
  r1: RegExp,
  r2: RegExp,
  Sigma: RecursiveSet<Char>
): boolean {
  const F1 = regexp2DFA(r1, Sigma);
  const F2 = regexp2DFA(r2, Sigma);

  const r1MinusR2 = fsm_complement(F1, F2);
  const r2MinusR1 = fsm_complement(F2, F1);

  return is_empty(r1MinusR2) && is_empty(r2MinusR1);
}
