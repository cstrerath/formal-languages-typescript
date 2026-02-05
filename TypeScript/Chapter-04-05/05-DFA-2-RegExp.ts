import { RecursiveSet, RecursiveMap, Tuple } from "recursive-set";
import { DFA, DFAState, State, Char, TransRelDet } from "./01-NFA-2-DFA";
import {
    RegExp,
    EmptySet,
    Epsilon,
    CharNode,
    Star,
    Concat,
    Union
} from "./03-RegExp-2-NFA";

function regexpSum(S: RecursiveSet<RegExp> | RegExp[]): RegExp {
    const [head, ...tail] = S instanceof RecursiveSet ? [...S] : S;
    if (!head) return new EmptySet();
    if (tail.length === 0) return head;
    return new Union(head, regexpSum(tail));
}

function rpq( p1: DFAState, p2: DFAState, Sigma: RecursiveSet<Char>, delta: TransRelDet, Allowed: readonly DFAState[] ): RegExp {
    if (Allowed.length === 0) {
        const allChars = [...Sigma]
            .filter(c => delta.get(new Tuple(p1, c))?.equals(p2))
            .map(c => new CharNode(c));
        const r = regexpSum(allChars);
        return p1.equals(p2) ? new Union(new Epsilon(), r) : r;
    }
    const [q, ...rest] = Allowed;
    const rp1p2 = rpq(p1, p2, Sigma, delta, rest);
    const rp1q  = rpq(p1, q,  Sigma, delta, rest);
    const rqq   = rpq(q,  q,  Sigma, delta, rest);
    const rqp2  = rpq(q,  p2, Sigma, delta, rest);    
    return new Union(rp1p2, new Concat(new Concat(rp1q, new Star(rqq)), rqp2));
}

function dfa2regexp(F: DFA): RegExp {
    return regexpSum([...F.A].map(p => rpq(F.q0, p, F.Σ, F.δ, [...F.Q])));
}

export {dfa2regexp}