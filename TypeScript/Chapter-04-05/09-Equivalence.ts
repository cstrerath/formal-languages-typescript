import { RecursiveSet, Tuple } from 'recursive-set';
import { State, Char, DFA, nfa2dfa } from './01-NFA-2-DFA';
import { RegExp, RegExp2NFA } from './03-RegExp-2-NFA';

// === Types ===

export type DFAState = RecursiveSet<State>;
export type StatePair = Tuple<[DFAState, DFAState]>;

export type GenericDFA<S> = {
    Q: RecursiveSet<S>;
    Sigma: RecursiveSet<Char>;
    delta: Map<string, S>;
    q0: S;
    A: RecursiveSet<S>;
};

// === Helpers ===

export function genKey<S>(state: S, c: Char): string {
    return `${state.toString()},${c}`;
}

/**
 * Computes a Product Automaton to check L(F1) \ L(F2)
 * States = Q1 x Q2
 * Accepting = A1 x (Q2 \ A2)
 */
export function fsm_complement(
    F1: GenericDFA<DFAState>, 
    F2: GenericDFA<DFAState>
): GenericDFA<StatePair> {
    const newStates = F1.Q.cartesianProduct(F2.Q); 
    const newDelta = new Map<string, StatePair>();

    for (const pair of newStates) {
        const p1 = pair.values[0];
        const p2 = pair.values[1];

        for (const c of F1.Sigma) {
            const next1 = F1.delta.get(genKey(p1, c));
            const next2 = F2.delta.get(genKey(p2, c));

            if (next1 && next2) {
                const nextPair: StatePair = new Tuple<[DFAState, DFAState]>(next1, next2);
                newDelta.set(genKey(pair, c), nextPair);
            }
        }
    }

    const startPair: StatePair = new Tuple<[DFAState, DFAState]>(F1.q0, F2.q0);

    const diffSet = F2.Q.difference(F2.A); // Q2 \ A2
    const newAccepting = F1.A.cartesianProduct(diffSet);

    return {
        Q: newStates,
        Sigma: F1.Sigma,
        delta: newDelta,
        q0: startPair,
        A: newAccepting
    };
}

/**
 * Converts a RegExp directly to a DFA
 */
export function regexp2DFA(r: RegExp, Sigma: RecursiveSet<Char>): DFA {
    const converter = new RegExp2NFA(Sigma);
    const nfa = converter.toNFA(r);
    return nfa2dfa(nfa);
}

/**
 * Checks if the Language of a Generic DFA is empty.
 * Uses Breadth-First-Search / Reachability analysis.
 */
export function is_empty<S>(F: GenericDFA<S>): boolean {
    let reachable = new RecursiveSet<S>(F.q0);

    while (true) {
        const newFound = new RecursiveSet<S>();

        for (const q of reachable) {
            for (const c of F.Sigma) {
                const target = F.delta.get(genKey(q, c));
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
 * Main function to check if two Regular Expressions are equivalent.
 * r1 ≡ r2 iff (L(r1) \ L(r2) = ∅) AND (L(r2) \ L(r1) = ∅)
 */
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
