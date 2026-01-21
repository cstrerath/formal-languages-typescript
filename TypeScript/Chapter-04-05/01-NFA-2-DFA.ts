import { RecursiveSet, RecursiveMap, Tuple } from "./recursive-set";

type State = string | number;

type Char = string;

type DFAState = RecursiveSet<State>;

type TransRel = RecursiveMap<Tuple<[State,Char]>, RecursiveSet<State>>;

type TransRelDet = RecursiveMap<Tuple<[DFAState,Char]>, DFAState>;

type NFA = {
    Q: RecursiveSet<State>;
    Σ: RecursiveSet<Char>;
    δ: TransRel;
    q0: State;
    A: RecursiveSet<State>;
};

type DFA = {
    Q: RecursiveSet<DFAState>;
    Σ: RecursiveSet<Char>;
    δ: TransRelDet;
    q0: DFAState;
    A: RecursiveSet<DFAState>;
};

const bigUnion = (M: RecursiveSet<DFAState>): DFAState => {
    const res = new RecursiveSet<State>();
    for (const A of M) for (const x of A) res.add(x);
    return res;
};

const input = new RecursiveSet<DFAState>(
    new RecursiveSet(1, 2, 3),
    new RecursiveSet(2, 3, 4),
    new RecursiveSet(3, 4, 5),
);
bigUnion(input);

const epsClosure = (s: State, δ: TransRel): DFAState => {
    let Res = new RecursiveSet(s);
    while (true) {
        const Reachable = new RecursiveSet<DFAState>();
        for (const q of Res) {
            const targets = δ.get(new Tuple(q, "ε"));
            if (targets) Reachable.add(targets);
        }
        
        const New = bigUnion(Reachable);
        if (New.isSubset(Res)) return Res;
        Res = Res.union(New);
    }
};

const deltaHat = (s: State, c: Char, δ: TransRel): DFAState => {
    const targets = δ.get(new Tuple(s, c));
    if (!targets) return new RecursiveSet();
    
    const closures = new RecursiveSet<DFAState>();
    for (const q of targets) closures.add(epsClosure(q, δ));
    return bigUnion(closures);
};

const capitalDelta = (M: DFAState, c: Char, δ: TransRel): DFAState => {
    const sets = new RecursiveSet<DFAState>();
    for (const q of M) sets.add(deltaHat(q, c, δ));
    return bigUnion(sets);
};

const allStates = (Q0: DFAState, δ: TransRel, Σ: RecursiveSet<Char>): RecursiveSet<DFAState> => {
    let Res = new RecursiveSet(Q0);
    while (true) {
        const New = new RecursiveSet<DFAState>();
        for (const M of Res) {
            for (const c of Σ) {
                New.add(capitalDelta(M, c, δ));
            }
        }
        if (New.isSubset(Res)) return Res;
        Res = Res.union(New);
    }
};

const nfa2dfa = (nfa: NFA): DFA => {
    const { Σ, δ, q0, A } = nfa;
    const start = epsClosure(q0, δ);
    const Q_DFA = allStates(start, δ, Σ);
    
    const δ_DFA = new RecursiveMap<Tuple<[DFAState, Char]>, DFAState>();
    
    for (const M of Q_DFA) {
        for (const c of Σ) {
            δ_DFA.set(new Tuple(M, c), capitalDelta(M, c, δ));
        }
    }

    const A_DFA = new RecursiveSet<DFAState>();
    for (const M of Q_DFA) {
        if (!M.intersection(A).isEmpty()) A_DFA.add(M);
    }

    return { Q: Q_DFA, Σ, δ: δ_DFA, q0: start, A: A_DFA };
};

export { Char, State, DFAState, NFA, DFA, nfa2dfa, TransRel, TransRelDet }
