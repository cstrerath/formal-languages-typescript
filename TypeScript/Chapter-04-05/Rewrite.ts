import { 
    RegExp, Variable, EmptySet, Epsilon, CharNode, Star, Concat, Union, RegExpNode 
} from "./03-RegExp-2-NFA";

// A substitution maps variable names to complete RegExp trees
type Subst = Map<string, RegExp>;
type Rule = [RegExp, RegExp];

function deepEquals(a: RegExp, b: RegExp): boolean {
    if (a === b) return true;
    if (a.constructor !== b.constructor) return false;

    if (a instanceof CharNode && b instanceof CharNode) return a.value === b.value;
    if (a instanceof Variable && b instanceof Variable) return a.name === b.name;
    
    // Recursive Checks
    if (a instanceof Star && b instanceof Star) {
        return deepEquals(a.inner, b.inner);
    }
    if ((a instanceof Concat && b instanceof Concat) || 
        (a instanceof Union && b instanceof Union)) {
        return deepEquals(a.left, b.left) && deepEquals(a.right, b.right);
    }
    
    // Singletons (EmptySet, Epsilon) match if constructors match
    return true; 
}

function match(pattern: RegExp, term: RegExp, substitution: Subst): boolean {
    // A. Variable Match (The logic hook)
    if (pattern instanceof Variable) {
        const name = pattern.name;
        if (substitution.has(name)) {
            // Variable already bound: must match the existing binding exactly
            return deepEquals(substitution.get(name)!, term);
        } else {
            // Bind variable
            substitution.set(name, term);
            return true;
        }
    }

    // B. Structure Match (Must be same class)
    if (pattern.constructor !== term.constructor) return false;

    // C. Recursive Descent
    if (pattern instanceof Star && term instanceof Star) {
        return match(pattern.inner, term.inner, substitution);
    }
    
    if ((pattern instanceof Concat && term instanceof Concat) || 
        (pattern instanceof Union && term instanceof Union)) {
        return match(pattern.left, term.left, substitution) &&
               match(pattern.right, term.right, substitution);
    }

    if (pattern instanceof CharNode && term instanceof CharNode) {
        return pattern.value === term.value;
    }

    return true; // EmptySet, Epsilon
}

function apply(term: RegExp, substitution: Subst): RegExp {
    if (term instanceof Variable) {
        return substitution.has(term.name) ? substitution.get(term.name)! : term;
    }

    // Reconstruct with simplified children
    // NO CASTING NEEDED because Star accepts RegExp!
    if (term instanceof Star) {
        return new Star(apply(term.inner, substitution));
    }

    if (term instanceof Concat) {
        return new Concat(
            apply(term.left, substitution),
            apply(term.right, substitution)
        );
    }

    if (term instanceof Union) {
        return new Union(
            apply(term.left, substitution),
            apply(term.right, substitution)
        );
    }

    return term; // Primitives unchanged
}

function rewrite(term: RegExp, rule: Rule): { simplified: boolean, result: RegExp } {
    const [lhs, rhs] = rule;
    const substitution: Subst = new Map();

    if (match(lhs, term, substitution)) {
        return { simplified: true, result: apply(rhs, substitution) };
    }
    return { simplified: false, result: term };
}

// Ein "Input" für unser DSL kann ein fertiges RegExp-Objekt, 
// die Zahl 0, das Epsilon-Symbol oder ein String (Char/Variable) sein.
type DSLInput = RegExp | 0 | string;

// 1. Overloads: Definieren die erlaubten Signaturen
function T(arg: DSLInput): RegExp;
function T(inner: DSLInput, op: '*'): RegExp;
function T(left: DSLInput, op: '+' | '⋅', right: DSLInput): RegExp;

// 2. Implementation: Die Logik, die alle Fälle abdeckt
function T(arg0: DSLInput, arg1?: string, arg2?: DSLInput): RegExp {
    
    // Case 1: Atom (nur arg0 ist gesetzt)
    if (arg1 === undefined) {
        if (arg0 instanceof RegExpNode) return arg0 as RegExp; // Pass-through
        if (arg0 === 0) return new EmptySet();
        if (arg0 === "ε") return new Epsilon();
        
        if (typeof arg0 === "string") {
            // Convention: Uppercase = Variable, Lowercase = Char
            // (einfache Prüfung auf Großbuchstaben A-Z)
            return (arg0.length === 1 && arg0 >= "A" && arg0 <= "Z")
                ? new Variable(arg0)
                : new CharNode(arg0);
        }
        
        throw new Error(`Invalid Atom: ${arg0}`);
    }

    // Case 2: Kleene Star (arg1 ist '*')
    if (arg1 === '*') {
        // Wir rufen T rekursiv auf, um sicherzustellen, dass arg0 ein RegExp wird
        return new Star(T(arg0));
    }

    // Case 3: Binary Operation (arg1 ist '+' oder '⋅', arg2 muss existieren)
    if ((arg1 === '+' || arg1 === '⋅') && arg2 !== undefined) {
        const left = T(arg0);
        const right = T(arg2); // Hier meckert TS nicht mehr, weil arg2 undefined gecheckt ist
        
        if (arg1 === '+') return new Union(left, right);
        if (arg1 === '⋅') return new Concat(left, right);
    }

    throw new Error(`Invalid Rule Template: ${arg0}, ${arg1}, ${arg2}`);
}

// === THE RULES ===

function getRules(): Rule[] {
    const rules: Rule[] = [
        [T("R", "+", 0), T("R")], 
        [T(0, "+", "R"), T("R")],
        [T("R", "+", "R"), T("R")],

        [T("ε", "+", T("R", "*")), T("R", "*")],
        [T(T("R", "*"), "+", "ε"), T("R", "*")],
        [T("ε", "+", T("R", "⋅", T("R", "*"))), T("R", "*")],
        [T("ε", "+", T(T("R", "*"), "⋅", "R")), T("R", "*")],
        [T(T("R", "⋅", T("R", "*")), "+", "ε"), T("R", "*")],
        [T(T(T("R", "*"), "⋅", "R"), "+", "ε"), T("R", "*")],

        [T("S", "+", T("S", "⋅", "T")), T("S", "⋅", T("ε", "+", "T"))],
        [T("S", "+", T("T", "⋅", "S")), T(T("ε", "+", "T"), "⋅", "S")],

        [T(0, "⋅", "R"), T(0)],
        [T("R", "⋅", 0), T(0)],
        [T("ε", "⋅", "R"), T("R")],
        [T("R", "⋅", "ε"), T("R")],

        [T(T("ε", "+", "R"), "⋅", T("R", "*")), T("R", "*")],
        [T(T("R", "+", "ε"), "⋅", T("R", "*")), T("R", "*")],
        [T(T("R", "*"), "⋅", T("R", "+", "ε")), T("R", "*")],
        [T(T("R", "*"), "⋅", T("ε", "+", "R")), T("R", "*")],

        [T(0, "*"), T("ε")],
        [T("ε", "*"), T("ε")],

        [T(T("ε", "+", "R"), "*"), T("R", "*")],
        [T(T("R", "+", "ε"), "*"), T("R", "*")],

        [T("R", "+", T("S", "+", "T")), T(T("R", "+", "S"), "+", "T")],
        [T("R", "⋅", T("S", "⋅", "T")), T(T("R", "⋅", "S"), "⋅", "T")],

        [
            T(T("R", "⋅", T("S", "*")), "⋅", T("ε", "+", "S")),
            T("R", "⋅", T("S", "*")),
        ],
    ];
    return rules;
}

// ============================================================================
// 5. MAIN SIMPLIFICATION ALGORITHM
// ============================================================================

function simplifyOnce(term: RegExp, rules: Rule[]): RegExp {
    // 1. Try top-level rewrite
    for (const rule of rules) {
        const { simplified, result } = rewrite(term, rule);
        if (simplified) return result;
    }

    // 2. Recurse into children (Inductive Step)
    // No casting needed: The constructors accept 'RegExp', which includes all nodes.
    
    if (term instanceof Star) {
        return new Star(simplifyOnce(term.inner, rules));
    }

    if (term instanceof Concat) {
        return new Concat(
            simplifyOnce(term.left, rules),
            simplifyOnce(term.right, rules)
        );
    }

    if (term instanceof Union) {
        return new Union(
            simplifyOnce(term.left, rules),
            simplifyOnce(term.right, rules)
        );
    }

    // 3. Base cases (EmptySet, Epsilon, CharNode, Variable) are leaves
    return term;
}

function simplify(t: RegExp): RegExp {
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

function regexpToString(r: RegExp): string {
    // 1. Atomic Cases
    if (r instanceof EmptySet) return "∅";
    if (r instanceof Epsilon) return "ε";
    if (r instanceof CharNode) return r.value;
    if (r instanceof Variable) return r.name;

    if (r instanceof Star) {
        const inner = regexpToString(r.inner);
        
        const isAtomic = 
            r.inner instanceof CharNode || 
            r.inner instanceof Variable || 
            r.inner instanceof EmptySet ||
            r.inner instanceof Epsilon;
            
        return isAtomic ? `${inner}*` : `(${inner})*`;
    }

    if (r instanceof Concat) {
        return regexpToString(r.left) + regexpToString(r.right);
    }

    if (r instanceof Union) {
        return `(${regexpToString(r.left)}+${regexpToString(r.right)})`;
    }

    return "?";
}


export {
    simplify,
    regexpToString
}