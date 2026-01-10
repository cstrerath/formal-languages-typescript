import { display } from "tslab";
import { readFileSync } from "fs";

const css = readFileSync("../style.css", "utf8");
display.html(`<style>${css}</style>`);

import { RecursiveSet, Tuple } from "recursive-set";
import {
    RegExp,
    UnaryOp,
    BinaryOp,
    EmptySet,
    Epsilon,
} from "./03-RegExp-2-NFA";

export type PatternRegExp =
    | RegExp
    | string
    | Tuple<[PatternRegExp, UnaryOp]>
    | Tuple<[PatternRegExp, BinaryOp, PatternRegExp]>;

export type Subst = Map<string, PatternRegExp>;
export type Rule = [PatternRegExp, PatternRegExp];

type PatternView =
    | { kind: "EmptySet" }
    | { kind: "Epsilon" }
    | { kind: "Char"; value: string }
    | { kind: "Variable"; name: string }
    | { kind: "Star"; inner: PatternRegExp }
    | { kind: "Concat"; left: PatternRegExp; right: PatternRegExp }
    | { kind: "Union"; left: PatternRegExp; right: PatternRegExp };

function getPatternView(r: PatternRegExp): PatternView {
    // 1. Primitives & Variables
    if (r === 0) return { kind: "EmptySet" };
    if (r === "ε") return { kind: "Epsilon" };

    if (typeof r === "string") {
        // Convention: Uppercase single letter = Variable
        if (r.length === 1 && r >= "A" && r <= "Z") {
            return { kind: "Variable", name: r };
        }
        return { kind: "Char", value: r };
    }

    // 2. Tuples
    if (r instanceof Tuple) {
        const raw = r.raw;

        if (raw.length === 2 && raw[1] === "*") {
            return { kind: "Star", inner: raw[0] as PatternRegExp };
        }

        if (raw.length === 3) {
            const left = raw[0] as PatternRegExp;
            const op = raw[1];
            const right = raw[2] as PatternRegExp;

            if (op === "⋅") return { kind: "Concat", left, right };
            if (op === "+") return { kind: "Union", left, right };
        }
    }

    throw new Error(`Unknown Pattern Structure: ${r}`);
}

// Helper to build tuples easily
function T(...args: any[]): PatternRegExp {
    return new Tuple(...args) as unknown as PatternRegExp;
}

function deepEquals(a: PatternRegExp, b: PatternRegExp): boolean {
    if (a === b) return true;

    const vA = getPatternView(a);
    const vB = getPatternView(b);

    if (vA.kind !== vB.kind) return false;

    switch (vA.kind) {
        case "Char":
            return vA.value === (vB as any).value;
        case "Variable":
            return vA.name === (vB as any).name;
        case "Star":
            return deepEquals(vA.inner, (vB as any).inner);
        case "Concat":
        case "Union":
            return (
                deepEquals(vA.left, (vB as any).left) &&
                deepEquals(vA.right, (vB as any).right)
            );
        default:
            return true;
    }
}

function match(
    pattern: PatternRegExp,
    term: PatternRegExp,
    substitution: Subst,
): boolean {
    const vPat = getPatternView(pattern);

    // 1. Variable Match (The core of rewriting)
    if (vPat.kind === "Variable") {
        const varName = vPat.name;
        if (substitution.has(varName)) {
            return deepEquals(substitution.get(varName)!, term);
        } else {
            substitution.set(varName, term);
            return true;
        }
    }

    const vTerm = getPatternView(term);

    // 2. Structure Match
    if (vPat.kind !== vTerm.kind) return false;

    switch (vPat.kind) {
        case "Char":
            return vPat.value === (vTerm as any).value;
        case "Star":
            return match(vPat.inner, (vTerm as any).inner, substitution);
        case "Concat":
        case "Union":
            return (
                match(vPat.left, (vTerm as any).left, substitution) &&
                match(vPat.right, (vTerm as any).right, substitution)
            );
        default:
            return true;
    }
}

function apply(term: PatternRegExp, substitution: Subst): PatternRegExp {
    const v = getPatternView(term);

    if (v.kind === "Variable") {
        return substitution.has(v.name) ? substitution.get(v.name)! : term;
    }

    if (v.kind === "Star") {
        return new Tuple(
            apply(v.inner, substitution),
            "*",
        ) as unknown as PatternRegExp;
    }

    if (v.kind === "Concat" || v.kind === "Union") {
        const left = apply(v.left, substitution);
        const right = apply(v.right, substitution);
        const op = v.kind === "Concat" ? "⋅" : "+";
        return new Tuple(left, op, right) as unknown as PatternRegExp;
    }

    return term; // Atoms
}

function rewrite(
    term: PatternRegExp,
    rule: Rule,
): { simplified: boolean; result: PatternRegExp } {
    const [lhs, rhs] = rule;
    const substitution: Subst = new Map();

    if (match(lhs, term, substitution)) {
        return { simplified: true, result: apply(rhs, substitution) };
    }
    return { simplified: false, result: term };
}

// === THE RULES ===

function getRules(): Rule[] {
    const rules: Rule[] = [
        // Addition (Identity & Idempotence)
        [T("R", "+", 0), "R"],
        [T(0, "+", "R"), "R"],
        [T("R", "+", "R"), "R"],

        // Kleene Star & Epsilon Simplifications
        [T("ε", "+", T("R", "*")), T("R", "*")],
        [T(T("R", "*"), "+", "ε"), T("R", "*")],
        [T("ε", "+", T("R", "⋅", T("R", "*"))), T("R", "*")],
        [T("ε", "+", T(T("R", "*"), "⋅", "R")), T("R", "*")],
        [T(T("R", "⋅", T("R", "*")), "+", "ε"), T("R", "*")],
        [T(T(T("R", "*"), "⋅", "R"), "+", "ε"), T("R", "*")],

        // Distributive Laws (Arden's Rule specifics)
        [T("S", "+", T("S", "⋅", "T")), T("S", "⋅", T("ε", "+", "T"))],
        [T("S", "+", T("T", "⋅", "S")), T(T("ε", "+", "T"), "⋅", "S")],

        // Multiplication (Annihilator & Identity)
        [T(0, "⋅", "R"), 0],
        [T("R", "⋅", 0), 0],
        [T("ε", "⋅", "R"), "R"],
        [T("R", "⋅", "ε"), "R"],

        // Absorption
        [T(T("ε", "+", "R"), "⋅", T("R", "*")), T("R", "*")],
        [T(T("R", "+", "ε"), "⋅", T("R", "*")), T("R", "*")],
        [T(T("R", "*"), "⋅", T("R", "+", "ε")), T("R", "*")],
        [T(T("R", "*"), "⋅", T("ε", "+", "R")), T("R", "*")],

        // Constant Kleene Stars
        [T(0, "*"), "ε"],
        [T("ε", "*"), "ε"],

        // Nested Kleene Stars
        [T(T("ε", "+", "R"), "*"), T("R", "*")],
        [T(T("R", "+", "ε"), "*"), T("R", "*")],

        // Associativity (Rebalancing to the right)
        [T("R", "+", T("S", "+", "T")), T(T("R", "+", "S"), "+", "T")],
        [T("R", "⋅", T("S", "⋅", "T")), T(T("R", "⋅", "S"), "⋅", "T")],

        // Complex Absorption
        [
            T(T("R", "⋅", T("S", "*")), "⋅", T("ε", "+", "S")),
            T("R", "⋅", T("S", "*")),
        ],
    ];
    return rules;
}

export function simplify(t: PatternRegExp): PatternRegExp {
    const rules = getRules();
    let current = t;
    let iterations = 0;
    const MAX = 1000;

    // Fixed-Point Iteration
    while (true) {
        const next = simplifyOnce(current, rules);
        if (deepEquals(current, next)) return next;

        current = next;
        if (++iterations > MAX) {
            console.warn("Rewrite limit reached");
            return current;
        }
    }
}

function simplifyOnce(term: PatternRegExp, rules: Rule[]): PatternRegExp {
    // Try top-level rewrite
    for (const rule of rules) {
        const { simplified, result } = rewrite(term, rule);
        if (simplified) return result;
    }

    // Recurse
    const v = getPatternView(term);
    if (v.kind === "Star") {
        return new Tuple(
            simplifyOnce(v.inner, rules),
            "*",
        ) as unknown as PatternRegExp;
    }
    if (v.kind === "Concat" || v.kind === "Union") {
        const op = v.kind === "Concat" ? "⋅" : "+";
        return new Tuple(
            simplifyOnce(v.left, rules),
            op,
            simplifyOnce(v.right, rules),
        ) as unknown as PatternRegExp;
    }
    return term;
}

export function regexpToString(r: PatternRegExp): string {
    const v = getPatternView(r);

    switch (v.kind) {
        case "EmptySet":
            return "∅";
        case "Epsilon":
            return "ε";
        case "Char":
            return v.value;
        case "Variable":
            return v.name;
        case "Star": {
            const inner = regexpToString(v.inner);
            const vInner = getPatternView(v.inner);
            const needsParens = !(
                vInner.kind === "Char" ||
                vInner.kind === "Variable" ||
                vInner.kind === "EmptySet"
            );
            return needsParens ? `(${inner})*` : `${inner}*`;
        }
        case "Concat":
            return regexpToString(v.left) + regexpToString(v.right);
        case "Union":
            return `(${regexpToString(v.left)}+${regexpToString(v.right)})`;
    }
    return "?";
}
