import { RecursiveSet, RecursiveMap, Tuple, Value } from 'recursive-set';
import { NFA, State, Char, TransRel } from "./01-NFA-2-DFA";

// ============================================================================
// 1. AST CLASS DEFINITIONS (The "Single Source of Truth")
// ============================================================================

/**
 * Base class for all Regular Expression Nodes.
 * Extends Tuple for structural equality and hashability.
 */
abstract class RegExpNode<T extends Value[]> extends Tuple<T> {}

// --- Atomic Types ---

class EmptySet extends RegExpNode<[0]> {
    constructor() { super(0); }
}

class Epsilon extends RegExpNode<['ε']> {
    constructor() { super('ε'); }
}

class CharNode extends RegExpNode<[Char]> {
    constructor(c: Char) { super(c); }
    get value(): Char { return this.get(0); }
}

/** * Represents a Variable (e.g., "R", "S").
 * We define it HERE so that composite types (Star, Union) accept it as a child.
 */
class Variable extends RegExpNode<[string]> {
    constructor(name: string) { super(name); }
    get name(): string { return this.get(0); }
}

// --- Composite Types ---

/** * The Union Type of all possible nodes.
 * Effectively, this is a "Pattern" type.
 */
type RegExp = 
    | EmptySet 
    | Epsilon 
    | CharNode 
    | Variable 
    | Star 
    | Concat 
    | Union;

type UnaryOp = '*';
type BinaryOp = '⋅' | '+';

class Star extends RegExpNode<[RegExp, UnaryOp]> {
    // Accepts RegExp (including Variable) -> Type safe for Rewrite System
    constructor(inner: RegExp) { super(inner, '*'); }
    get inner(): RegExp { return this.get(0); }
}

abstract class BinaryRegExp extends RegExpNode<[RegExp, BinaryOp, RegExp]> {
    constructor(left: RegExp, op: BinaryOp, right: RegExp) {
        super(left, op, right);
    }
    get left(): RegExp { return this.get(0); }
    get right(): RegExp { return this.get(2); }
}

class Concat extends BinaryRegExp {
    constructor(left: RegExp, right: RegExp) { super(left, '⋅', right); }
}

class Union extends BinaryRegExp {
    constructor(left: RegExp, right: RegExp) { super(left, '+', right); }
}

class StateGenerator {
    private stateCount: number = 0;

    getNewState(): State {
        return ++this.stateCount;
    }
}

function getOnlyElement(S: RecursiveSet<State>): State {
    for (const s of S) return s;
    throw new Error("Unreachable");
}

function genEmptyNFA(gen: StateGenerator, Sigma: RecursiveSet<Char>): NFA {
    const q0 = gen.getNewState();
    const q1 = gen.getNewState();
    
    return {
        Q: new RecursiveSet(q0, q1),
        Σ: Sigma,
        δ: new RecursiveMap<Tuple<[State,Char]>, RecursiveSet<State>>(),
        q0: q0,
        A: new RecursiveSet(q1)
    };
}

function genEpsilonNFA(gen: StateGenerator, Sigma: RecursiveSet<Char>): NFA {
    const q0 = gen.getNewState();
    const q1 = gen.getNewState();
    
    const delta = new RecursiveMap<Tuple<[State,Char]>, RecursiveSet<State>>();
    delta.set(new Tuple(q0, "ε"), new RecursiveSet(q1));
    
    return {
        Q: new RecursiveSet(q0, q1),
        Σ: Sigma,
        δ: delta,
        q0: q0,
        A: new RecursiveSet(q1)
    };
}

function genCharNFA(
    gen: StateGenerator,
    Sigma: RecursiveSet<Char>,
    c: Char,
): NFA {
    const q0 = gen.getNewState();
    const q1 = gen.getNewState();
    
    const delta = new RecursiveMap<Tuple<[State,Char]>, RecursiveSet<State>>();
    delta.set(new Tuple(q0, c), new RecursiveSet(q1));
    
    return {
        Q: new RecursiveSet(q0, q1),
        Σ: Sigma,
        δ: delta,
        q0: q0,
        A: new RecursiveSet(q1)
    };
}

function copyDelta(d1: TransRel, d2: TransRel): TransRel {
    const newDelta = new RecursiveMap<Tuple<[State, Char]>, RecursiveSet<State>>();    
    for (const [k, v] of d1) newDelta.set(k, v);
    for (const [k, v] of d2) newDelta.set(k, v);
    return newDelta;
}

function catenate(gen: StateGenerator, f1: NFA, f2: NFA): NFA {
    const q1 = f1.q0;
    const q3 = f2.q0;
    const q2 = getOnlyElement(f1.A);
    
    const delta = copyDelta(f1.δ, f2.δ);
    delta.set(new Tuple(q2, 'ε'), new RecursiveSet(q3));
    
    return {
        Q: f1.Q.union(f2.Q),
        Σ: f1.Σ,
        δ: delta,
        q0: q1,
        A: f2.A
    };
}

function disjunction(gen: StateGenerator, f1: NFA, f2: NFA): NFA {
    const q1 = f1.q0;
    const q2 = f2.q0;
    const q3 = getOnlyElement(f1.A);
    const q4 = getOnlyElement(f2.A);
    
    const q0 = gen.getNewState();
    const q5 = gen.getNewState();
    
    const delta = copyDelta(f1.δ, f2.δ);
    
    delta.set(new Tuple(q0, 'ε'), new RecursiveSet(q1, q2));
    
    const targetQ5 = new RecursiveSet(q5);
    delta.set(new Tuple(q3, 'ε'), targetQ5);
    delta.set(new Tuple(q4, 'ε'), targetQ5);
    
    return {
        Q: new RecursiveSet(q0, q5).union(f1.Q).union(f2.Q),
        Σ: f1.Σ,
        δ: delta,
        q0: q0,
        A: targetQ5
    };
}

function kleene(gen: StateGenerator, f: NFA): NFA {
    const q1 = f.q0;
    const q2 = getOnlyElement(f.A);
    
    const q0 = gen.getNewState();
    const q3 = gen.getNewState();
    
    const delta = new RecursiveMap<Tuple<[State, Char]>, RecursiveSet<State>>();
    for (const [k, v] of f.δ) delta.set(k, v);
    
    const targets = new RecursiveSet(q1, q3);
    
    delta.set(new Tuple(q0, 'ε'), targets);
    delta.set(new Tuple(q2, 'ε'), targets);
    
    return {
        Q: new RecursiveSet(q0, q3).union(f.Q),
        Σ: f.Σ,
        δ: delta,
        q0: q0,
        A: new RecursiveSet(q3)
    };
}

class RegExp2NFA {
    private gen: StateGenerator;
    private sigma: RecursiveSet<Char>;

    constructor(sigma: RecursiveSet<Char>) {
        this.sigma = sigma;
        this.gen = new StateGenerator();
    }

    public toNFA(r: RegExp): NFA {
        // Strict Type Guarding using instanceof
        
        if (r instanceof EmptySet) {
            return genEmptyNFA(this.gen, this.sigma);
        }

        if (r instanceof Epsilon) {
            return genEpsilonNFA(this.gen, this.sigma);
        }

        if (r instanceof CharNode) {
            return genCharNFA(this.gen, this.sigma, r.value);
        }

        // --- Composite Types ---
        
        if (r instanceof Star) {
            return kleene(this.gen, this.toNFA(r.inner));
        }

        if (r instanceof Concat) {
            return catenate(
                this.gen,
                this.toNFA(r.left),
                this.toNFA(r.right)
            );
        }

        if (r instanceof Union) {
            return disjunction(
                this.gen,
                this.toNFA(r.left),
                this.toNFA(r.right)
            );
        }

        // --- Error Case for Variables ---
        // This makes the system robust: The Type System allows Variables,
        // but the Logic Layer ensures we don't compile them.
        if (r instanceof Variable) {
            throw new Error(`Cannot convert Variable '${r.name}' to NFA. Resolve variables first.`);
        }

        // TypeScript now knows 'r' is never, but good to keep for runtime safety
        throw new Error(`Unknown RegExp Node: ${r}`);
    }
}


export {
    RegExp,
    RegExpNode,
    RegExp2NFA,
    EmptySet,
    Epsilon,
    CharNode,
    Star,
    Concat,
    Union,
    Variable
}