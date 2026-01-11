import { display } from "tslab";
import { readFileSync } from "fs";

const css = readFileSync("../style.css", "utf8");
display.html(`<style>${css}</style>`);

import { RecursiveSet, Tuple } from "recursive-set";
import { NFA, State, Char, TransRel, key, TransitionKey } from "./01-NFA-2-DFA";

export type EmptySet = 0;
export type Epsilon = "ε";

export type BinaryOp = "⋅" | "+";
export type UnaryOp = "*";

export type RegExp =
    | EmptySet
    | Epsilon
    | Char
    | Tuple<[RegExp, UnaryOp]>
    | Tuple<[RegExp, BinaryOp, RegExp]>;

type RegExpView =
    | { kind: "EmptySet" }
    | { kind: "Epsilon" }
    | { kind: "Char"; value: Char }
    | { kind: "Star"; inner: RegExp }
    | { kind: "Concat"; left: RegExp; right: RegExp }
    | { kind: "Union"; left: RegExp; right: RegExp };

function getView(r: RegExp): RegExpView {
    // 1. Primitives
    if (r === 0) return { kind: "EmptySet" };
    if (r === "ε") return { kind: "Epsilon" };

    if (typeof r === "string") {
        return { kind: "Char", value: r };
    }

    // 2. Tuples (Composite)
    if (r instanceof Tuple) {
        const raw = r.raw;

        // Star: [RegExp, '*']
        if (raw.length === 2 && raw[1] === "*") {
            return { kind: "Star", inner: raw[0] as RegExp };
        }

        // Binary: [RegExp, Op, RegExp]
        if (raw.length === 3) {
            const left = raw[0] as RegExp;
            const op = raw[1];
            const right = raw[2] as RegExp;

            if (op === "⋅") return { kind: "Concat", left, right };
            if (op === "+") return { kind: "Union", left, right };
        }
    }

    throw new Error(`Unknown RegExp structure: ${r}`);
}

class StateGenerator {
    private stateCount: number = 0;

    getNewState(): State {
        return ++this.stateCount;
    }
}

function getOnlyElement(S: RecursiveSet<State>): State {
    if (S.isEmpty()) {
        throw new Error("Set is empty, expected at least one element.");
    }
    return S.raw[0];
}

function genEmptyNFA(gen: StateGenerator, Sigma: RecursiveSet<Char>): NFA {
    const q0 = gen.getNewState();
    const q1 = gen.getNewState();

    return {
        Q: new RecursiveSet(q0, q1),
        Sigma: Sigma,
        delta: new Map<TransitionKey, RecursiveSet<State>>(),
        q0: q0,
        A: new RecursiveSet(q1),
    };
}

function genEpsilonNFA(gen: StateGenerator, Sigma: RecursiveSet<Char>): NFA {
    const q0 = gen.getNewState();
    const q1 = gen.getNewState();

    const delta: TransRel = new Map();
    delta.set(key(q0, "ε"), new RecursiveSet(q1));

    return {
        Q: new RecursiveSet(q0, q1),
        Sigma: Sigma,
        delta: delta,
        q0: q0,
        A: new RecursiveSet(q1),
    };
}

function genCharNFA(
    gen: StateGenerator,
    Sigma: RecursiveSet<Char>,
    c: Char,
): NFA {
    const q0 = gen.getNewState();
    const q1 = gen.getNewState();

    const delta: TransRel = new Map();
    delta.set(key(q0, c), new RecursiveSet(q1));

    return {
        Q: new RecursiveSet(q0, q1),
        Sigma: Sigma,
        delta: delta,
        q0: q0,
        A: new RecursiveSet(q1),
    };
}

function copyDelta(d1: TransRel, d2: TransRel): TransRel {
    const newDelta = new Map<TransitionKey, RecursiveSet<State>>(d1);
    for (const [k, v] of d2) {
        newDelta.set(k, v);
    }
    return newDelta;
}

function catenate(gen: StateGenerator, f1: NFA, f2: NFA): NFA {
    const q1 = f1.q0;
    const q3 = f2.q0;
    const q2 = getOnlyElement(f1.A);

    const delta = copyDelta(f1.delta, f2.delta);

    delta.set(key(q2, "ε"), new RecursiveSet(q3));

    return {
        Q: f1.Q.union(f2.Q),
        Sigma: f1.Sigma,
        delta: delta,
        q0: q1,
        A: f2.A,
    };
}

function disjunction(gen: StateGenerator, f1: NFA, f2: NFA): NFA {
    const q1 = f1.q0;
    const q2 = f2.q0;
    const q3 = getOnlyElement(f1.A);
    const q4 = getOnlyElement(f2.A);

    const q0 = gen.getNewState();
    const q5 = gen.getNewState();

    const delta = copyDelta(f1.delta, f2.delta);

    delta.set(key(q0, "ε"), new RecursiveSet(q1, q2));

    const targetQ5 = new RecursiveSet(q5);
    delta.set(key(q3, "ε"), targetQ5);
    delta.set(key(q4, "ε"), targetQ5);

    return {
        Q: new RecursiveSet(q0, q5).union(f1.Q).union(f2.Q),
        Sigma: f1.Sigma,
        delta: delta,
        q0: q0,
        A: targetQ5,
    };
}

function kleene(gen: StateGenerator, f: NFA): NFA {
    const q1 = f.q0;
    const q2 = getOnlyElement(f.A);

    const q0 = gen.getNewState();
    const q3 = gen.getNewState();

    const delta = new Map(f.delta);

    const targets = new RecursiveSet(q1, q3);

    delta.set(key(q0, "ε"), targets);

    delta.set(key(q2, "ε"), targets);

    return {
        Q: new RecursiveSet(q0, q3).union(f.Q),
        Sigma: f.Sigma,
        delta: delta,
        q0: q0,
        A: new RecursiveSet(q3),
    };
}

export class RegExp2NFA {
    private gen: StateGenerator;
    private sigma: RecursiveSet<Char>;

    constructor(sigma: RecursiveSet<Char>) {
        this.sigma = sigma;
        this.gen = new StateGenerator();
    }

    public toNFA(r: RegExp): NFA {
        const view = getView(r);

        switch (view.kind) {
            case "EmptySet":
                return genEmptyNFA(this.gen, this.sigma);

            case "Epsilon":
                return genEpsilonNFA(this.gen, this.sigma);

            case "Char":
                return genCharNFA(this.gen, this.sigma, view.value);

            case "Star":
                return kleene(this.gen, this.toNFA(view.inner));

            case "Concat":
                return catenate(
                    this.gen,
                    this.toNFA(view.left),
                    this.toNFA(view.right),
                );

            case "Union":
                return disjunction(
                    this.gen,
                    this.toNFA(view.left),
                    this.toNFA(view.right),
                );
        }
    }
}
