import { RecursiveSet, RecursiveMap, Tuple, Value } from "recursive-set";
import { DFA, DFAState, Char, TransRelDet } from "./01-NFA-2-DFA";

type MinState = RecursiveSet<DFAState>; 

// Minimized Transition Relation uses MinState as Key/Value
// Key is Tuple<[MinState, Char]>
type MinTransRel = RecursiveMap<Tuple<[MinState, Char]>, MinState>;

type Pair = Tuple<[DFAState, DFAState]>;

type MinDFA = {
    Q: RecursiveSet<MinState>;
    Σ: RecursiveSet<Char>;
    δ: MinTransRel;
    q0: MinState;
    A: RecursiveSet<MinState>;
}

function arb<T extends Value>(M: RecursiveSet<T>): T {
    for (const e of M) return e;
    throw new Error("Unreachable");
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
    Σ: RecursiveSet<Char>,
    δ: TransRelDet,
): RecursiveSet<Pair> {
    const newPairs = new RecursiveSet<Pair>();
        
    for (const q1 of States) {
        for (const q2 of States) {
            for (const c of Σ) {
                const p1 = δ.get(new Tuple(q1, c));
                const p2 = δ.get(new Tuple(q2, c));
                
                if (p1 && p2) {
                    const targetPair = new Tuple(p1, p2);
                    if (Pairs.has(targetPair)) {
                        newPairs.add(new Tuple(q1, q2));
                        break;
                    }
                }
            }
        }
    }
    return newPairs;
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
    Σ: RecursiveSet<Char>,
    δ: TransRelDet,
): RecursiveSet<Pair> {
    const NonAccepting = Q.difference(A);
    const set1 = cartProd(NonAccepting, A);
    const set2 = cartProd(A, NonAccepting);
    let Separable = set1.union(set2);

    while (true) {
        const NewPairs = separate(Separable, Q, Σ, δ);
        if (NewPairs.isSubset(Separable)) return Separable;
        Separable = Separable.union(NewPairs);
    }
}

function reachable(
    q0: DFAState,
    Σ: RecursiveSet<Char>,
    δ: TransRelDet,
): RecursiveSet<DFAState> {
    let Result = new RecursiveSet<DFAState>(q0);
    while (true) {
        const NewStates = new RecursiveSet<DFAState>();
        for (const p of Result) {
            for (const c of Σ) {
                const target = δ.get(new Tuple(p, c));
                if (target) NewStates.add(target);
            }
        }
        if (NewStates.isSubset(Result)) return Result;
        Result = Result.union(NewStates);
    }
}

function minimize(F: DFA): MinDFA {
    let { Q, Σ, δ, q0, A } = F;

    // 1. Reachability
    Q = reachable(q0, Σ, δ);
    
    // Filter Accepting states to only include reachable ones
    const reachableA = new RecursiveSet<DFAState>();
    for (const q of Q) {
        if (A.has(q)) reachableA.add(q);
    }

    // 2. Distinguishability
    const Separable = allSeparable(Q, reachableA, Σ, δ);

    // 3. Equivalence Classes
    const AllPairs = cartProd(Q, Q);
    const Equivalent = AllPairs.difference(Separable);

    const EquivClasses = new RecursiveSet<MinState>();
    for (const q of Q) {
        const classForQ = new RecursiveSet<DFAState>();
        for (const p of Q) {
            // Check equivalence (p ~ q)
            const pair = new Tuple(p, q);
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
    const newAcceptSet = new RecursiveSet<MinState>();
    for (const M of EquivClasses) {
        const rep = arb(M);
        if (reachableA.has(rep)) newAcceptSet.add(M);
    }

    // 6. Transitions (Using Tuple keys for RecursiveMap)
    const newDelta = new RecursiveMap<Tuple<[MinState, Char]>, MinState>();

    for (const q of Q) {
        const classOfQ = findEquivalenceClass(q, EquivClasses);

        for (const c of Σ) {
            const p = δ.get(new Tuple(q, c));

            if (p) {
                const classOfP = findEquivalenceClass(p, EquivClasses);
                newDelta.set(new Tuple(classOfQ, c), classOfP);
            }
        }
    }

    return {
        Q: EquivClasses,
        Σ: Σ,
        δ: newDelta,
        q0: newQ0,
        A: newAcceptSet,
    };
}

export{minimize}