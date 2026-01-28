import { RecursiveSet, RecursiveMap, Tuple, Structural } from "recursive-set";
import { Char, DFA, nfa2dfa } from "./01-NFA-2-DFA";
import { RegExp, RegExp2NFA } from "./03-RegExp-2-NFA";
import { GenericDFA } from "./FSM-2-Dot";

type StatePair<S1 extends Structural, S2 extends Structural> = Tuple<[S1, S2]>;
type ProductDFA<S1 extends Structural, S2 extends Structural> = GenericDFA<StatePair<S1, S2>>;

function fsm_complement<S1 extends Structural, S2 extends Structural>(
    F1: GenericDFA<S1>, 
    F2: GenericDFA<S2>
): ProductDFA<S1, S2> {
    const newStates = F1.Q.cartesianProduct(F2.Q);
    const newDelta = new RecursiveMap<Tuple<[Tuple<[S1, S2]>, Char]>, Tuple<[S1, S2]>>();

    for (const pair of newStates) {
        const p1 = pair.get(0);
        const p2 = pair.get(1);

        for (const c of F1.Σ) {
            const next1 = F1.δ.get(new Tuple(p1, c));
            const next2 = F2.δ.get(new Tuple(p2, c));

            if (next1 && next2) {
                const nextPair = new Tuple(next1, next2);
                newDelta.set(new Tuple(pair, c), nextPair);
            }
        }
    }

    const startPair = new Tuple(F1.q0, F2.q0);
    const diffSet = F2.Q.difference(F2.A);
    const newAccepting = F1.A.cartesianProduct(diffSet);

    return {
        Q: newStates,
        Σ: F1.Σ, 
        δ: newDelta,
        q0: startPair,
        A: newAccepting,
    };
}

function regexp2DFA(r: RegExp, Sigma: RecursiveSet<Char>): DFA {
    const converter = new RegExp2NFA(Sigma);
    const nfa = converter.toNFA(r);
    return nfa2dfa(nfa);
}

function is_empty<S extends Structural>(F: GenericDFA<S>): boolean {
    let reachable = new RecursiveSet<S>(F.q0);
    while (true) {
        const newFound = new RecursiveSet<S>();
        for (const q of reachable) {
            for (const c of F.Σ) {
                const target = F.δ.get(new Tuple(q, c));
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

function findWitness<S extends Structural>(F: GenericDFA<S>): string | null {
    const queue: { state: S; word: string }[] = [
        { state: F.q0, word: "" },
    ];
    
    const visited = new RecursiveSet<S>(F.q0);

    let head = 0;
    while (head < queue.length) {
        const { state, word } = queue[head++];

        if (F.A.has(state)) {
            return word === "" ? "ε" : word;
        }

        for (const c of F.Σ) { 
            const nextState = F.δ.get(new Tuple(state, c)); 

            if (nextState && !visited.has(nextState)) {
                visited.add(nextState);
                queue.push({ state: nextState, word: word + c });
            }
        }
    }
    return null;
}

function regExpEquiv(
    r1: RegExp,
    r2: RegExp,
    Sigma: RecursiveSet<Char>,
): boolean {
    const toDFA = (r: RegExp) => {
        const converter = new RegExp2NFA(Sigma);
        return nfa2dfa(converter.toNFA(r));
    };

    const F1 = toDFA(r1);
    const F2 = toDFA(r2);

    const r1MinusR2 = fsm_complement(F1, F2);
    if (!is_empty(r1MinusR2)) return false;

    const r2MinusR1 = fsm_complement(F2, F1);
    if (!is_empty(r2MinusR1)) return false;

    return true;
}


export {
    regExpEquiv,
    regexp2DFA,
    fsm_complement,
    ProductDFA,
    StatePair,
    findWitness
}