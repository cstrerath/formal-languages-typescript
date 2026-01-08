import { display } from "tslab";
import { readFileSync } from "fs";

const css = readFileSync("../style.css", "utf8");
display.html(`<style>${css}</style>`);

import { RecursiveSet, Value, Tuple } from "recursive-set";

// === LOCAL TYPES ===
type LocalBinaryOp = '⋅' | '+';
type LocalUnaryOp = '*';

export type MyRegExp = 
  | number      
  | string      
  | Tuple<[MyRegExp, LocalUnaryOp]>             
  | Tuple<[MyRegExp, LocalBinaryOp, MyRegExp]>; 

type Subst = Map<string, MyRegExp>;
type Rule = [MyRegExp, MyRegExp];

// === THE VIEW PATTERN ===
type RegExpView = 
  | { kind: 'atom', value: number | string }
  | { kind: 'variable', name: string } // Spezialfall von Atom
  | { kind: 'unary', inner: MyRegExp }
  | { kind: 'binary', left: MyRegExp, op: LocalBinaryOp, right: MyRegExp };

function getView(r: MyRegExp): RegExpView {
    if (r instanceof Tuple) {
        const raw = r.raw;
        
        // Unary: [Inner, '*']
        if (raw.length === 2 && raw[1] === '*') {
            return { 
                kind: 'unary', 
                inner: raw[0] as MyRegExp 
            };
        }
        
        // Binary: [Left, Op, Right]
        if (raw.length === 3) {
            return { 
                kind: 'binary', 
                left: raw[0] as MyRegExp, 
                op: raw[1] as LocalBinaryOp, 
                right: raw[2] as MyRegExp 
            };
        }
    }
    
    // Primitives
    if (typeof r === 'string') {
        if (r.length === 1 && r >= 'A' && r <= 'Z') {
            return { kind: 'variable', name: r };
        }
        return { kind: 'atom', value: r };
    }
    
    if (typeof r === 'number') {
        return { kind: 'atom', value: r };
    }

    throw new Error(`Unknown RegExp structure: ${r}`);
}

function T(...args: (MyRegExp | string)[]): MyRegExp {
    return new Tuple(...args) as unknown as MyRegExp;
}

// === MATCHING LOGIC ===

function deepEquals(a: MyRegExp, b: MyRegExp): boolean {
    if (a === b) return true;

    const vA = getView(a);
    const vB = getView(b);

    // Wenn die Typen nicht gleich sind, können sie nicht gleich sein
    if (vA.kind !== vB.kind) return false;

    // TypeScript weiß jetzt durch "Narrowing", welche Felder existieren!
    if (vA.kind === 'atom' && vB.kind === 'atom') {
        return vA.value === vB.value;
    }
    if (vA.kind === 'variable' && vB.kind === 'variable') {
        return vA.name === vB.name;
    }
    if (vA.kind === 'unary' && vB.kind === 'unary') {
        return deepEquals(vA.inner, vB.inner);
    }
    if (vA.kind === 'binary' && vB.kind === 'binary') {
        return vA.op === vB.op && 
               deepEquals(vA.left, vB.left) && 
               deepEquals(vA.right, vB.right);
    }

    return false;
}

function match(pattern: MyRegExp, term: MyRegExp, substitution: Subst): boolean {
    const vPat = getView(pattern);

    // 1. Variable Match
    if (vPat.kind === 'variable') {
        const varName = vPat.name;
        if (substitution.has(varName)) {
            return deepEquals(substitution.get(varName)!, term);
        } else {
            substitution.set(varName, term);
            return true;
        }
    }

    const vTerm = getView(term);

    // 2. Structure Match
    if (vPat.kind !== vTerm.kind) return false;

    if (vPat.kind === 'atom' && vTerm.kind === 'atom') {
        return vPat.value === vTerm.value;
    }

    if (vPat.kind === 'unary' && vTerm.kind === 'unary') {
        return match(vPat.inner, vTerm.inner, substitution);
    }

    if (vPat.kind === 'binary' && vTerm.kind === 'binary') {
        if (vPat.op !== vTerm.op) return false;
        return match(vPat.left, vTerm.left, substitution) &&
               match(vPat.right, vTerm.right, substitution);
    }

    return false;
}

function apply(term: MyRegExp, substitution: Subst): MyRegExp {
    const v = getView(term);

    if (v.kind === 'variable') {
        return substitution.has(v.name) ? substitution.get(v.name)! : term;
    }

    if (v.kind === 'atom') {
        return term;
    }

    if (v.kind === 'unary') {
        const inner = apply(v.inner, substitution);
        return new Tuple(inner, '*') as unknown as MyRegExp;
    }

    if (v.kind === 'binary') {
        const left = apply(v.left, substitution);
        const right = apply(v.right, substitution);
        return new Tuple(left, v.op, right) as unknown as MyRegExp;
    }

    return term;
}

function rewrite(term: MyRegExp, rule: Rule): { simplified: boolean, result: MyRegExp } {
    const [lhs, rhs] = rule;
    // Neue Map für jeden Versuch
    const substitution: Subst = new Map();

    if (match(lhs, term, substitution)) {
        return { simplified: true, result: apply(rhs, substitution) };
    } else {
        return { simplified: false, result: term };
    }
}

// === THE RULES ===

function getRules(): Rule[] {
    const rules: Rule[] = [
        // Addition (Identity & Idempotence)
        [T('R', '+', 0), 'R'],
        [T(0, '+', 'R'), 'R'],
        [T('R', '+', 'R'), 'R'],

        // Kleene Star & Epsilon Simplifications
        [T('ε', '+', T('R', '*')), T('R', '*')],
        [T(T('R', '*'), '+', 'ε'), T('R', '*')],
        [T('ε', '+', T('R', '⋅', T('R', '*'))), T('R', '*')],
        [T('ε', '+', T(T('R', '*'), '⋅', 'R')), T('R', '*')],
        [T(T('R', '⋅', T('R', '*')), '+', 'ε'), T('R', '*')],
        [T(T(T('R', '*'), '⋅', 'R'), '+', 'ε'), T('R', '*')],

        // Distributive Laws (Arden's Rule specifics)
        [T('S', '+', T('S', '⋅', 'T')), T('S', '⋅', T('ε', '+', 'T'))],
        [T('S', '+', T('T', '⋅', 'S')), T(T('ε', '+', 'T'), '⋅', 'S')],

        // Multiplication (Annihilator & Identity)
        [T(0, '⋅', 'R'), 0],
        [T('R', '⋅', 0), 0],
        [T('ε', '⋅', 'R'), 'R'],
        [T('R', '⋅', 'ε'), 'R'],

        // Absorption
        [T(T('ε', '+', 'R'), '⋅', T('R', '*')), T('R', '*')],
        [T(T('R', '+', 'ε'), '⋅', T('R', '*')), T('R', '*')],
        [T(T('R', '*'), '⋅', T('R', '+', 'ε')), T('R', '*')],
        [T(T('R', '*'), '⋅', T('ε', '+', 'R')), T('R', '*')],

        // Constant Kleene Stars
        [T(0, '*'), 'ε'],
        [T('ε', '*'), 'ε'],
        
        // Nested Kleene Stars
        [T(T('ε', '+', 'R'), '*'), T('R', '*')],
        [T(T('R', '+', 'ε'), '*'), T('R', '*')],

        // Associativity (Rebalancing to the right)
        [T('R', '+', T('S', '+', 'T')), T(T('R', '+', 'S'), '+', 'T')],
        [T('R', '⋅', T('S', '⋅', 'T')), T(T('R', '⋅', 'S'), '⋅', 'T')],
        
        // Complex Absorption
        [T(T('R', '⋅', T('S', '*')), '⋅', T('ε', '+', 'S')), T('R', '⋅', T('S', '*'))]
    ];
    return rules;
}

function simplifyOnce(term: MyRegExp, rules: Rule[]): MyRegExp {
    const v = getView(term);
    
    if (v.kind === 'atom' || v.kind === 'variable') return term;

    // 1. Try to rewrite current node
    for (const rule of rules) {
        const { simplified, result } = rewrite(term, rule);
        if (simplified) {
            return result;
        }
    }

    // 2. Recurse into children
    if (v.kind === 'unary') {
        const newInner = simplifyOnce(v.inner, rules);
        return new Tuple(newInner, '*') as unknown as MyRegExp;
    }

    if (v.kind === 'binary') {
        const newLeft = simplifyOnce(v.left, rules);
        const newRight = simplifyOnce(v.right, rules);
        return new Tuple(newLeft, v.op, newRight) as unknown as MyRegExp;
    }

    return term;
}

export function simplify(t: MyRegExp): MyRegExp {
    const rules = getRules();
    let current = t;
    let iterations = 0;
    const MAX = 1000;

    while (true) {
        const next = simplifyOnce(current, rules);
        if (deepEquals(current, next)) return next;
        
        current = next;
        if (++iterations > MAX) {
            console.warn("Limit reached");
            return current;
        }
    }
}

export function regexpToString(r: MyRegExp): string {
    const v = getView(r);

    if (v.kind === 'atom') {
        if (v.value === 0) return "0";
        if (v.value === "ε") return "ε";
        return v.value.toString();
    }
    
    if (v.kind === 'variable') {
        return v.name;
    }

    if (v.kind === 'unary') {
        const sInner = regexpToString(v.inner);
        // Prüfe ob inner atomar ist (Klammern sparen)
        const vInner = getView(v.inner);
        if (vInner.kind === 'atom' || vInner.kind === 'variable') {
            return sInner + "*";
        } else {
            return "(" + sInner + ")*";
        }
    }

    if (v.kind === 'binary') {
        const s1 = regexpToString(v.left);
        const s2 = regexpToString(v.right);

        if (v.op === "⋅") return s1 + s2;
        if (v.op === "+") return "(" + s1 + "+" + s2 + ")";
    }

    return JSON.stringify(r);
}


