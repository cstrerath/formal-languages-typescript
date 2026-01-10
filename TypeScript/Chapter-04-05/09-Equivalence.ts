import { RecursiveSet, Tuple } from "recursive-set";
import {
    State,
    Char,
    DFA,
    DFAState,
    nfa2dfa,
    key,
    TransitionKey,
} from "./01-NFA-2-DFA";
import { RegExp, RegExp2NFA } from "./03-RegExp-2-NFA";

export type StatePair = Tuple<[DFAState, DFAState]>;

export type ProductDFA = {
    Q: RecursiveSet<StatePair>;
    Sigma: RecursiveSet<Char>;
    delta: Map<TransitionKey, StatePair>;
    q0: StatePair;
    A: RecursiveSet<StatePair>;
};

function unwrapPair(pair: StatePair): [DFAState, DFAState] {
    const raw = pair.raw;
    return [raw[0] as DFAState, raw[1] as DFAState];
}

export function fsm_complement(F1: DFA, F2: DFA): ProductDFA {
    const newStates = F1.Q.cartesianProduct(F2.Q);

    const newDelta = new Map<TransitionKey, StatePair>();

    for (const pair of newStates) {
        const [p1, p2] = unwrapPair(pair);

        for (const c of F1.Sigma) {
            const next1 = F1.delta.get(key(p1, c));
            const next2 = F2.delta.get(key(p2, c));

            if (next1 && next2) {
                const nextPair = new Tuple(next1, next2);
                newDelta.set(key(pair, c), nextPair);
            }
        }
    }

    const startPair = new Tuple(F1.q0, F2.q0);

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

function is_empty(F: ProductDFA): boolean {
    let reachable = new RecursiveSet<StatePair>(F.q0);

    while (true) {
        const newFoundArr: StatePair[] = [];

        for (const q of reachable) {
            for (const c of F.Sigma) {
                const target = F.delta.get(key(q, c));
                if (target) {
                    newFoundArr.push(target);
                }
            }
        }

        const newFound = RecursiveSet.fromArray(newFoundArr);

        if (newFound.isSubset(reachable)) {
            break;
        }

        reachable = reachable.union(newFound);
    }

    return reachable.intersection(F.A).isEmpty();
}

export function regExpEquiv(
    r1: RegExp,
    r2: RegExp,
    Sigma: RecursiveSet<Char>,
): boolean {
    const F1 = regexp2DFA(r1, Sigma);
    const F2 = regexp2DFA(r2, Sigma);

    const r1MinusR2 = fsm_complement(F1, F2);
    const r2MinusR1 = fsm_complement(F2, F1);

    return is_empty(r1MinusR2) && is_empty(r2MinusR1);
}
