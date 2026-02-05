import { RecursiveSet, RecursiveMap, Tuple, Value } from "recursive-set";
import { DFA, DFAState, Char, TransRelDet } from "./01-NFA-2-DFA";

type MinState = RecursiveSet<DFAState>; 
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

function separate( Pairs: RecursiveSet<Pair>, States: RecursiveSet<DFAState>, Σ: RecursiveSet<Char>, δ: TransRelDet): RecursiveSet<Pair> {
    const next = new RecursiveSet<Pair>();
    for (const q1 of States) for (const q2 of States) {
        const isSeparable = [...Σ].some(c => {
            const p1 = δ.get(new Tuple(q1, c));
            const p2 = δ.get(new Tuple(q2, c));
            return p1 && p2 && Pairs.has(new Tuple(p1, p2));
        });
        if (isSeparable) next.add(new Tuple(q1, q2));
    }
    return next;
}

function findEquivalenceClass(p: DFAState, Partition: RecursiveSet<MinState>): MinState {
    for (const C of Partition) if (C.has(p)) return C;
    throw new Error(`State ${p} not found in partition`);
}

function allSeparable( Q: RecursiveSet<DFAState>, A: RecursiveSet<DFAState>, Σ: RecursiveSet<Char>, δ: TransRelDet ): RecursiveSet<Pair> {
    const NonA = Q.difference(A);
    let separable = NonA.cartesianProduct(A).union(A.cartesianProduct(NonA));
    while (true) {
        const next = separate(separable, Q, Σ, δ);
        if (next.isSubset(separable)) return separable;
        separable = separable.union(next);
    }
}

function reachable( q0: DFAState, Σ: RecursiveSet<Char>, δ: TransRelDet ): RecursiveSet<DFAState> {
    let result = new RecursiveSet<DFAState>(q0);
    while (true) {
        const next = new RecursiveSet<DFAState>();
        for (const p of result) for (const c of Σ) {
            const target = δ.get(new Tuple(p, c));
            if (target) next.add(target);
        }
        if (next.isSubset(result)) return result;
        result = result.union(next);
    }
}

function minimize(F: DFA): MinDFA {
    const Q = reachable(F.q0, F.Σ, F.δ);
    const A = Q.intersection(F.A); 

    const Separable = allSeparable(Q, A, F.Σ, F.δ);
    const Equivalent = Q.cartesianProduct(Q).difference(Separable);

    const Partition = new RecursiveSet<MinState>();
    for (const q of Q) {
        const equivalentStates = [...Q].filter(p => Equivalent.has(new Tuple(p, q)));
        Partition.add(new RecursiveSet<DFAState>(...equivalentStates));
    }

    const newQ0 = findEquivalenceClass(F.q0, Partition);
    
    const validBlocks = [...Partition].filter(C => A.has(arb(C)));
    const newA = new RecursiveSet<MinState>(...validBlocks);

    const newDelta = new RecursiveMap<Tuple<[MinState, Char]>, MinState>();
    for (const C of Partition) {
        const rep = arb(C);
        for (const c of F.Σ) {
            const target = F.δ.get(new Tuple(rep, c));
            if (target && Q.has(target)) {
                const targetBlock = findEquivalenceClass(target, Partition);
                newDelta.set(new Tuple(C, c), targetBlock);
            }
        }
    }

    return { Q: Partition, Σ: F.Σ, δ: newDelta, q0: newQ0, A: newA };
}


export{minimize}