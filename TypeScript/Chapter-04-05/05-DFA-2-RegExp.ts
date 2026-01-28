import { display } from "tslab";
import { readFileSync } from "fs";

const css = readFileSync("../style.css", "utf8");
display.html(`<style>${css}</style>`);

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
    const elems: RegExp[] = S instanceof RecursiveSet ? [...S] : S;
    const n = elems.length;

    if (n === 0) return new EmptySet();
    if (n === 1) return elems[0];

    const [r, ...rest] = elems;

    return new Union(r, regexpSum(rest));
}

function rpq(
    p1: DFAState,
    p2: DFAState,
    Sigma: RecursiveSet<Char>,
    delta: TransRelDet,
    Allowed: readonly DFAState[],
): RegExp {
    if (Allowed.length === 0) {
        const allChars: RegExp[] = [];

        for (const c of Sigma) {
            const target = delta.get(new Tuple(p1, c));

            if (target && target.equals(p2)) {
                allChars.push(new CharNode(c));
            }
        }

        const r = regexpSum(allChars);

        if (p1.equals(p2)) {
            return new Union(new Epsilon(), r);
        } else {
            return r;
        }
    }

    const [q, ...RestAllowed] = Allowed;

    const rp1p2 = rpq(p1, p2, Sigma, delta, RestAllowed);
    const rp1q = rpq(p1, q, Sigma, delta, RestAllowed);
    const rqq = rpq(q, q, Sigma, delta, RestAllowed);
    const rqp2 = rpq(q, p2, Sigma, delta, RestAllowed);

    const loop = new Star(rqq);
    const concat1 = new Concat(rp1q, loop);
    const concat2 = new Concat(concat1, rqp2);

    return new Union(rp1p2, concat2);
}

function dfa2regexp(F: DFA): RegExp {
    const { Q, Σ, δ, q0, A } = F;

    const allStates: DFAState[] = [...Q];

    const parts: RegExp[] = [];

    for (const acc of A) {
        const r = rpq(q0, acc, Σ, δ, allStates);
        parts.push(r);
    }

    return regexpSum(parts);
}

export {dfa2regexp}