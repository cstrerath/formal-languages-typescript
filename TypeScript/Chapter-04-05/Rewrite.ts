import { RecursiveSet, Tuple } from "recursive-set";

// === LOCAL TYPES ===
export type LocalBinaryOp = '⋅' | '+';
export type LocalUnaryOp = '*';

// Die rekursive Definition
export type MyRegExp = 
  | number      
  | string      
  | Tuple<[MyRegExp, LocalUnaryOp]>             
  | Tuple<[MyRegExp, LocalBinaryOp, MyRegExp]>; 

type Subst = Map<string, MyRegExp>;
type Rule = [MyRegExp, MyRegExp];

// === TYPE GUARDS ===
// Helfen TypeScript zu verstehen, welche Variante von MyRegExp vorliegt

function isAtom(r: MyRegExp): r is number | string {
    return typeof r === 'number' || typeof r === 'string';
}

function isVariable(r: MyRegExp): r is string {
    return typeof r === 'string' && r.length === 1 && r >= 'A' && r <= 'Z';
}

// Prüft, ob es ein Kleene Star Tuple ist: [RegExp, '*']
function isKleene(r: MyRegExp): r is Tuple<[MyRegExp, LocalUnaryOp]> {
    return r instanceof Tuple && r.length === 2 && r.values[1] === '*';
}

// Prüft, ob es eine binäre Operation ist: [RegExp, Op, RegExp]
function isBinary(r: MyRegExp): r is Tuple<[MyRegExp, LocalBinaryOp, MyRegExp]> {
    return r instanceof Tuple && r.length === 3;
}

// === HELPER FUNCTION T (Typsicher durch Overloads) ===

// 1. Signatur: Unary (Kleene)
function T(arg1: MyRegExp, op: LocalUnaryOp): MyRegExp;
// 2. Signatur: Binary (Concat/Union)
function T(arg1: MyRegExp, op: LocalBinaryOp, arg3: MyRegExp): MyRegExp;
// Implementation
function T(...args: (MyRegExp | string)[]): MyRegExp {
    // Wir wissen durch die Overloads, dass die Argumente korrekt sind.
    // Der Cast am Ende ist notwendig, da 'new Tuple' generisch ist und 
    // wir es auf unseren Union-Type reduzieren wollen.
    return new Tuple(...args) as unknown as MyRegExp;
}


// === MATCHING LOGIC ===

function deepEquals(a: MyRegExp, b: MyRegExp): boolean {
    if (a === b) return true;
    if (isAtom(a) || isAtom(b)) return a === b;
    
    // Hier nutzen wir Type Narrowing durch Checks
    if (isKleene(a) && isKleene(b)) {
        return deepEquals(a.values[0], b.values[0]);
    }

    if (isBinary(a) && isBinary(b)) {
        return a.values[1] === b.values[1] && // Operator check
               deepEquals(a.values[0], b.values[0]) && // Left
               deepEquals(a.values[2], b.values[2]);   // Right
    }

    return false;
}

function match(pattern: MyRegExp, term: MyRegExp, substitution: Subst): boolean {
    // 1. Variable Match
    if (isVariable(pattern)) {
        if (substitution.has(pattern)) {
            return deepEquals(substitution.get(pattern)!, term);
        } else {
            substitution.set(pattern, term);
            return true;
        }
    }

    // 2. Primitives Match
    if (isAtom(pattern) || isAtom(term)) {
        return pattern === term;
    }

    // 3. Tuple Match
    // Wenn Pattern Kleene ist, muss Term auch Kleene sein
    if (isKleene(pattern) && isKleene(term)) {
        return match(pattern.values[0], term.values[0], substitution);
    }

    // Wenn Pattern Binary ist, muss Term auch Binary sein
    if (isBinary(pattern) && isBinary(term)) {
        if (pattern.values[1] !== term.values[1]) return false;
        return match(pattern.values[0], term.values[0], substitution) &&
               match(pattern.values[2], term.values[2], substitution);
    }

    return false;
}

function apply(term: MyRegExp, substitution: Subst): MyRegExp {
    if (isVariable(term)) {
        if (substitution.has(term)) {
            return substitution.get(term)!; 
        }
        return term;
    }

    if (isAtom(term)) {
        return term;
    }

    if (isKleene(term)) {
        const inner = apply(term.values[0], substitution);
        return new Tuple(inner, term.values[1]) as unknown as MyRegExp;
    }

    if (isBinary(term)) {
        const left = apply(term.values[0], substitution);
        const right = apply(term.values[2], substitution);
        return new Tuple(left, term.values[1], right) as unknown as MyRegExp;
    }

    return term;
}

function rewrite(term: MyRegExp, rule: Rule): { simplified: boolean, result: MyRegExp } {
    const [lhs, rhs] = rule;
    const substitution: Subst = new Map();

    if (match(lhs, term, substitution)) {
        return { simplified: true, result: apply(rhs, substitution) };
    } else {
        return { simplified: false, result: term };
    }
}

// === THE RULES ===
// Durch die Overloads von T() oben meckert TS hier nicht mehr über Tuple-Typen
function getRules(): Rule[] {
    const rules: Rule[] = [
        // Addition
        [T('R', '+', 0), 'R'],
        [T(0, '+', 'R'), 'R'],
        [T('R', '+', 'R'), 'R'],

        // Kleene & Epsilon
        [T('ε', '+', T('R', '*')), T('R', '*')],
        [T(T('R', '*'), '+', 'ε'), T('R', '*')],
        [T('ε', '+', T('R', '⋅', T('R', '*'))), T('R', '*')],
        [T('ε', '+', T(T('R', '*'), '⋅', 'R')), T('R', '*')],
        [T(T('R', '⋅', T('R', '*')), '+', 'ε'), T('R', '*')],
        [T(T(T('R', '*'), '⋅', 'R'), '+', 'ε'), T('R', '*')],

        // Distributiv-ähnliche Regeln
        [T('S', '+', T('S', '⋅', 'T')), T('S', '⋅', T('ε', '+', 'T'))],
        [T('S', '+', T('T', '⋅', 'S')), T(T('ε', '+', 'T'), '⋅', 'S')],

        // Multiplikation
        [T(0, '⋅', 'R'), 0],
        [T('R', '⋅', 0), 0],
        [T('ε', '⋅', 'R'), 'R'],
        [T('R', '⋅', 'ε'), 'R'],

        // Absorption
        [T(T('ε', '+', 'R'), '⋅', T('R', '*')), T('R', '*')],
        [T(T('R', '+', 'ε'), '⋅', T('R', '*')), T('R', '*')],
        [T(T('R', '*'), '⋅', T('R', '+', 'ε')), T('R', '*')],
        [T(T('R', '*'), '⋅', T('ε', '+', 'R')), T('R', '*')],

        // Kleene Konstanten
        [T(0, '*'), 'ε'],
        [T('ε', '*'), 'ε'],
        
        // Nested Kleene
        [T(T('ε', '+', 'R'), '*'), T('R', '*')],
        [T(T('R', '+', 'ε'), '*'), T('R', '*')],

        // Assoziativität
        [T('R', '+', T('S', '+', 'T')), T(T('R', '+', 'S'), '+', 'T')],
        [T('R', '⋅', T('S', '⋅', 'T')), T(T('R', '⋅', 'S'), '⋅', 'T')],
        
        // Komplexere Absorption
        [T(T('R', '⋅', T('S', '*')), '⋅', T('ε', '+', 'S')), T('R', '⋅', T('S', '*'))]
    ];
    return rules;
}

function simplifyOnce(term: MyRegExp, rules: Rule[]): MyRegExp {
    if (isAtom(term)) return term;

    // 1. Try to rewrite current node
    for (const rule of rules) {
        const { simplified, result } = rewrite(term, rule);
        if (simplified) {
            return result;
        }
    }

    // 2. Recurse into children
    if (isKleene(term)) {
        const newInner = simplifyOnce(term.values[0], rules);
        return new Tuple(newInner, '*') as unknown as MyRegExp;
    }

    if (isBinary(term)) {
        const newLeft = simplifyOnce(term.values[0], rules);
        const newRight = simplifyOnce(term.values[2], rules);
        return new Tuple(newLeft, term.values[1], newRight) as unknown as MyRegExp;
    }

    return term;
}

/**
 * MAIN FUNCTION: Fixpoint iteration.
 */
export function simplify(t: MyRegExp): MyRegExp {
    const rules = getRules();
    let current = t;
    
    let iterations = 0;
    const MAX_ITERATIONS = 1000; 

    while (true) {
        const next = simplifyOnce(current, rules);
        
        if (deepEquals(current, next)) {
            return next;
        }
        
        current = next;
        iterations++;
        if (iterations > MAX_ITERATIONS) {
            console.warn("Simplification limit reached. Possible cycle.");
            return current;
        }
    }
}

// === STRING OUTPUT ===
export function regexpToString(r: MyRegExp): string {
    if (r === 0) return "0";
    if (r === "ε" || r === "𝜀") return "𝜀";
    if (typeof r === 'string') return r;
    if (typeof r === 'number') return r.toString();

    if (isKleene(r)) {
        const inner = r.values[0];
        const sInner = regexpToString(inner);

        if (isAtom(inner)) {
            return sInner + "*";
        } else {
            return "(" + sInner + ")*";
        }
    }

    if (isBinary(r)) {
        const left = r.values[0];
        const op = r.values[1];
        const right = r.values[2];

        const s1 = regexpToString(left);
        const s2 = regexpToString(right);

        if (op === "⋅") {
            return s1 + s2; 
        }

        if (op === "+") {
            return "(" + s1 + "+" + s2 + ")";
        }
    }

    return JSON.stringify(r);
}