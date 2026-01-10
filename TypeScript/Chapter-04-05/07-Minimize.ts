import { RecursiveSet, Tuple, Value } from "recursive-set";
import {
    DFA,
    DFAState,
    State,
    Char,
    TransRelDet,
    key,
    TransitionKey,
} from "./01-NFA-2-DFA";

export type MinState = RecursiveSet<DFAState>;

export type MinTransRel = Map<TransitionKey, MinState>;
export type Pair = Tuple<[DFAState, DFAState]>;

export type MinDFA = {
    Q: RecursiveSet<MinState>;
    Sigma: RecursiveSet<Char>;
    delta: MinTransRel;
    q0: MinState;
    A: RecursiveSet<MinState>;
};

function arb<T extends Value>(M: RecursiveSet<T>): T {
    if (M.isEmpty()) throw new Error("Error: arb called with empty set!");
    return M.raw[0];
}

function cartProd<S extends Value, T extends Value>(
    A: RecursiveSet<S>,
    B: RecursiveSet<T>,
): RecursiveSet<Tuple<[S, T]>> {
    return A.cartesianProduct(B);
}

function separate(
    Pairs: RecursiveSet<Pair>,
    States: RecursiveSet<DFAState>,
    Sigma: RecursiveSet<Char>,
    delta: TransRelDet,
): RecursiveSet<Pair> {
    const newPairs: Pair[] = [];
    const statesArr = States.raw;

    for (const q1 of statesArr) {
        for (const q2 of statesArr) {
            for (const c of Sigma) {
                const p1 = delta.get(key(q1, c));
                const p2 = delta.get(key(q2, c));
                if (p1 && p2) {
                    const targetPair = new Tuple<[DFAState, DFAState]>(p1, p2);
                    if (Pairs.has(targetPair)) {
                        newPairs.push(new Tuple<[DFAState, DFAState]>(q1, q2));
                        break;
                    }
                }
            }
        }
    }
    return RecursiveSet.fromArray(newPairs);
}

function findEquivalenceClass(
    p: DFAState,
    Partition: RecursiveSet<MinState>,
): MinState {
    for (const C of Partition) {
        if (C.has(p)) return C;
    }
    throw new Error(`State ${p} not found in partition`);
}

function allSeparable(
    Q: RecursiveSet<DFAState>,
    A: RecursiveSet<DFAState>,
    Sigma: RecursiveSet<Char>,
    delta: TransRelDet,
): RecursiveSet<Pair> {
    const NonAccepting = Q.difference(A);
    const set1 = cartProd(NonAccepting, A);
    const set2 = cartProd(A, NonAccepting);
    let Separable = set1.union(set2);

    while (true) {
        const NewPairs = separate(Separable, Q, Sigma, delta);
        if (NewPairs.isSubset(Separable)) return Separable;
        Separable = Separable.union(NewPairs);
    }
}

function reachable(
    q0: DFAState,
    Sigma: RecursiveSet<Char>,
    delta: TransRelDet,
): RecursiveSet<DFAState> {
    let Result = new RecursiveSet<DFAState>(q0);
    while (true) {
        const NewStates = new RecursiveSet<DFAState>();
        for (const p of Result) {
            for (const c of Sigma) {
                const target = delta.get(key(p, c));
                if (target) NewStates.add(target);
            }
        }
        if (NewStates.isSubset(Result)) return Result;
        Result = Result.union(NewStates);
    }
}

export function minimize(F: DFA): MinDFA {
    let { Q, Sigma, delta, q0, A } = F;

    // 1. Reachability
    Q = reachable(q0, Sigma, delta);
    const reachableA = new RecursiveSet<DFAState>();
    for (const q of Q) {
        if (A.has(q)) reachableA.add(q);
    }

    // 2. Distinguishability
    const Separable = allSeparable(Q, reachableA, Sigma, delta);

    // 3. Equivalence Classes
    const AllPairs = cartProd(Q, Q);
    const Equivalent = AllPairs.difference(Separable);

    const EquivClasses = new RecursiveSet<MinState>();
    for (const q of Q) {
        const classForQ = new RecursiveSet<DFAState>();
        for (const p of Q) {
            const pair = new Tuple<[DFAState, DFAState]>(p, q);
            if (Equivalent.has(pair)) {
                classForQ.add(p);
            }
        }
        EquivClasses.add(classForQ);
    }

    // 4. Start State
    let newQ0: MinState | undefined;
    for (const M of EquivClasses) {
        if (M.has(q0)) {
            newQ0 = M;
            break;
        }
    }
    if (!newQ0) throw new Error("Start state vanished!");

    // 5. Accepting States
    const newAcceptArr: MinState[] = [];
    for (const M of EquivClasses) {
        const rep = arb(M);
        if (reachableA.has(rep)) newAcceptArr.push(M);
    }

    // 6. Transitions (Reusing generic 'key')
    const newDelta = new Map<TransitionKey, MinState>();

    for (const q of Q) {
        const classOfQ = findEquivalenceClass(q, EquivClasses);

        for (const c of Sigma) {
            const p = delta.get(key(q, c));

            if (p) {
                const classOfP = findEquivalenceClass(p, EquivClasses);
                newDelta.set(key(classOfQ, c), classOfP);
            }
        }
    }

    return {
        Q: EquivClasses,
        Sigma,
        delta: newDelta,
        q0: newQ0,
        A: RecursiveSet.fromArray(newAcceptArr),
    };
}
