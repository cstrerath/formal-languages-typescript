import { RecursiveSet, Tuple } from "recursive-set";
import { key } from "./05-DFA-2-RegExp";

// === Existing Types ===
export type State = string | number;
export type Char = string;

// A state in our current DFA (potentially formed by subset construction)
export type DFAState = RecursiveSet<State>; 

export type TransRelDet = Map<string, DFAState>;

export type DFA = {
  Q: RecursiveSet<DFAState>;
  Sigma: RecursiveSet<Char>;
  delta: TransRelDet;
  q0: DFAState;
  A: RecursiveSet<DFAState>;
};

// === New Types for Minimization ===

// A pair of states (p, q)
export type Pair = Tuple<[DFAState, DFAState]>;

// A state in the Minimized DFA is a set of original DFAStates (Equivalence Class)
export type MinState = RecursiveSet<DFAState>;

export type MinTransRel = Map<string, MinState>;

export type MinDFA = {
    Q: RecursiveSet<MinState>;
    Sigma: RecursiveSet<Char>;
    delta: MinTransRel;
    q0: MinState;
    A: RecursiveSet<MinState>;
}

// === Helper Functions ===

export function arb<T>(M: RecursiveSet<T>): T {
    // RecursiveSet is sorted internally, so this deterministically returns the "smallest" element.
    for (const x of M) {
        return x;
    }
    throw new Error("Error: arb called with empty set!");
}

export function cartProd<S, T>(A: RecursiveSet<S>, B: RecursiveSet<T>): RecursiveSet<Tuple<[S, T]>> {
    return A.cartesianProduct(B);
}

// === Minimization Logic ===

export function separate(
    Pairs: RecursiveSet<Pair>, 
    States: RecursiveSet<DFAState>, 
    Sigma: RecursiveSet<Char>, 
    delta: TransRelDet
): RecursiveSet<Pair> {
    
    const result = new RecursiveSet<Pair>();
    
    for (const q1 of States) {
        for (const q2 of States) {
            for (const c of Sigma) {
                // Get targets
                const p1 = delta.get(key(q1, c));
                const p2 = delta.get(key(q2, c));
                
                // If transitions exist
                if (p1 && p2) {
                    // Check if the pair of targets (p1, p2) is already in the Separable set
                    const targetPair = new Tuple(p1, p2);
                    
                    if (Pairs.has(targetPair)) {
                        result.add(new Tuple(q1, q2));
                    }
                }
            }
        }
    }
    
    return result;
}

export function findEquivalenceClass(
    p: DFAState, 
    Partition: RecursiveSet<MinState>
): MinState {
    // Find the set C in Partition such that p is in C
    for (const C of Partition) {
        if (C.has(p)) {
            return C;
        }
    }
    throw new Error(`State ${p} not found in partition`);
}

export function allSeparable(
    Q: RecursiveSet<DFAState>, 
    A: RecursiveSet<DFAState>, 
    Sigma: RecursiveSet<Char>, 
    delta: TransRelDet
): RecursiveSet<Pair> {
    
    // Q without A (Non-accepting states)
    const NonAccepting = new RecursiveSet<DFAState>();
    for(const q of Q) {
        if(!A.has(q)) NonAccepting.add(q);
    }

    // 1. Initial Separation: (NonAccept x Accept) U (Accept x NonAccept)
    const set1 = cartProd(NonAccepting, A);
    const set2 = cartProd(A, NonAccepting);
    
    // Combine them
    const Separable = new RecursiveSet<Pair>();
    for(const p of set1) Separable.add(p);
    for(const p of set2) Separable.add(p);

    // 2. Fixed Point Loop
    while (true) {
        const NewPairs = separate(Separable, Q, Sigma, delta);
        
        // Check if NewPairs is a subset of Separable
        let isSubset = true;
        for (const np of NewPairs) {
            if (!Separable.has(np)) {
                isSubset = false;
                break;
            }
        }
        
        if (isSubset) {
            return Separable;
        }
        
        // Union: Separable |= NewPairs
        for (const np of NewPairs) {
            Separable.add(np);
        }
    }
}

export function reachable(
    q0: DFAState, 
    Sigma: RecursiveSet<Char>, 
    delta: TransRelDet
): RecursiveSet<DFAState> {
    
    const Result = new RecursiveSet<DFAState>(q0);
    
    while (true) {
        const NewStates = new RecursiveSet<DFAState>();
        
        // Find all states reachable in one step from current set
        for (const p of Result) {
            for (const c of Sigma) {
                const target = delta.get(key(p, c));
                if (target) {
                    NewStates.add(target);
                }
            }
        }
        
        // Check for subset (Fixpoint check)
        let isSubset = true;
        for (const ns of NewStates) {
            if (!Result.has(ns)) {
                isSubset = false;
                break;
            }
        }
        
        if (isSubset) {
            return Result;
        }
        
        // Result |= NewStates
        for (const ns of NewStates) {
            Result.add(ns);
        }
    }
}

// Local helper to generate keys for the minimized states (Sets of Sets)
function minKey(q: MinState, c: Char): string {
    return `${q.toString()},${c}`;
}

export function minimize(F: DFA): MinDFA {
    let { Q, Sigma, delta, q0, A } = F;
    
    // 1. Filter Reachable States
    Q = reachable(q0, Sigma, delta);
    
    // 2. Calculate Separable Pairs
    const Separable = allSeparable(Q, A, Sigma, delta);
    
    // 3. Calculate Equivalent Pairs (Total - Separable)
    const EquivClasses = new RecursiveSet<MinState>();
    
    for (const q of Q) {
        const equivalenceClass = new RecursiveSet<DFAState>();
        for (const p of Q) {
            const pairToCheck = new Tuple(p, q);
            if (!Separable.has(pairToCheck)) {
                equivalenceClass.add(p);
            }
        }
        EquivClasses.add(equivalenceClass);
    }
    
    // 4. Construct New Start State
    let newQ0: MinState | undefined;
    for (const M of EquivClasses) {
        if (M.has(q0)) {
            newQ0 = M;
            break;
        }
    }
    if (!newQ0) throw new Error("Start state vanished!");

    // 5. Construct New Accepting States
    const newAccept = new RecursiveSet<MinState>();
    for (const M of EquivClasses) {
        const representative = arb(M);
        if (A.has(representative)) {
            newAccept.add(M);
        }
    }
    
    // 6. Construct New Delta
    const newDelta: MinTransRel = new Map();
    
    for (const q of Q) {
        for (const c of Sigma) {
            const p = delta.get(key(q, c));
            
            const classOfQ = findEquivalenceClass(q, EquivClasses);
            
            if (p) {
                const classOfP = findEquivalenceClass(p, EquivClasses);
                newDelta.set(minKey(classOfQ, c), classOfP);
            }
        }
    }
    
    return {
        Q: EquivClasses,
        Sigma: Sigma,
        delta: newDelta,
        q0: newQ0,
        A: newAccept
    };
}