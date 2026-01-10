import { RecursiveSet, Value } from "recursive-set";

// ============================================================
// 1. Basic Types
// ============================================================

export type State = string | number;

export type Char = string;

// DFA State: A set of atomic NFA states (subset construction)
export type DFAState = RecursiveSet<State>;

// ============================================================
// 2. Transition Keys (Branded Type)
// ============================================================

declare const TransitionKeyBrand: unique symbol;

export type TransitionKey = string & { [TransitionKeyBrand]: true };

/**
 * Universal Key Generator.
 * Accepts atomic states (NFA) or sets of states (DFA/MinDFA).
 */
export function key(q: Value, c: Char): TransitionKey {
    return `${q.toString()},${c}` as TransitionKey;
}

// ============================================================
// 3. Transition Relations
// ============================================================

// NFA: (State, Char) -> Set of States
export type TransRel = Map<TransitionKey, RecursiveSet<State>>;

// DFA: (DFAState, Char) -> DFAState
export type TransRelDet = Map<TransitionKey, DFAState>;

// ============================================================
// 4. Automata Definitions
// ============================================================

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

// ============================================================
// 5. Helper Functions & Algorithms
// ============================================================

export function bigUnion(sets: RecursiveSet<DFAState>): DFAState {
    const allElements: State[] = [];

    for (const subset of sets) {
        for (const elem of subset.raw) {
            allElements.push(elem);
        }
    }
    return RecursiveSet.fromArray(allElements);
}

export function epsClosure(s: State, delta: TransRel): RecursiveSet<State> {
    let result = new RecursiveSet<State>(s);

    while (true) {
        const newStatesParts = new RecursiveSet<DFAState>();

        for (const q of result) {
            const targets = delta.get(key(q, "ε"));
            if (targets) {
                newStatesParts.add(targets);
            }
        }
        const newStates = bigUnion(newStatesParts);

        if (newStates.isSubset(result)) {
            return result;
        }

        result = result.union(newStates);
    }
}

export function deltaHat(
    s: State,
    c: Char,
    delta: TransRel,
): RecursiveSet<State> {
    const directTargets = delta.get(key(s, c));

    if (!directTargets || directTargets.isEmpty()) {
        return new RecursiveSet<State>();
    }

    const closures = new RecursiveSet<RecursiveSet<State>>();

    for (const q of directTargets) {
        closures.add(epsClosure(q, delta));
    }

    return bigUnion(closures);
}

export function capitalDelta(
    M: RecursiveSet<State>,
    c: Char,
    delta: TransRel,
): RecursiveSet<State> {
    const partials = new RecursiveSet<RecursiveSet<State>>();

    for (const q of M) {
        partials.add(deltaHat(q, c, delta));
    }

    return bigUnion(partials);
}

export function allStates(
    Q0: DFAState,
    delta: TransRel,
    Sigma: RecursiveSet<Char>,
): RecursiveSet<DFAState> {
    let result = new RecursiveSet<DFAState>(Q0);

    while (true) {
        const candidates: DFAState[] = [];

        for (const M of result) {
            for (const c of Sigma) {
                candidates.push(capitalDelta(M, c, delta));
            }
        }

        const newStates = RecursiveSet.fromArray(candidates);

        if (newStates.isSubset(result)) {
            return result;
        }

        result = result.union(newStates);
    }
}

export function nfa2dfa(nfa: NFA): DFA {
    const { Sigma, delta, q0, A } = nfa;

    const newStart: DFAState = epsClosure(q0, delta);

    const newStates: RecursiveSet<DFAState> = allStates(newStart, delta, Sigma);

    const newDelta: TransRelDet = new Map();

    for (const M of newStates) {
        for (const c of Sigma) {
            const N = capitalDelta(M, c, delta);
            newDelta.set(key(M, c), N);
        }
    }

    const newFinalArr: DFAState[] = [];

    for (const M of newStates) {
        const intersection = M.intersection(A);

        if (!intersection.isEmpty()) {
            newFinalArr.push(M);
        }
    }

    const newFinal = RecursiveSet.fromArray(newFinalArr);

    return {
        Q: newStates,
        Sigma,
        delta: newDelta,
        q0: newStart,
        A: newFinal,
    };
}
