import { RecursiveSet, RecursiveMap, Tuple, Value } from 'recursive-set';
import { NFA, State, Char, TransRel } from "./01-NFA-2-DFA";

// ============================================================================
// AST CLASS DEFINITIONS
// ============================================================================

/**
 * Base class for all Regular Expression Nodes.
 * All nodes are Tuples, ensuring structural equality and hashability.
 */
abstract class RegExpNode<T extends Value[]> extends Tuple<T> {}

// --- Atomic Types ---

/** Represents the Empty Set (∅). */
class EmptySet extends RegExpNode<[0]> {
    constructor() { super(0); }
}

/** Represents Epsilon (ε). */
class Epsilon extends RegExpNode<['ε']> {
    constructor() { super('ε'); }
}

/** Represents a single character (c ∈ Σ). */
class CharNode extends RegExpNode<[Char]> {
    constructor(c: Char) { super(c); }
    get value(): Char { return this.get(0); }
}

// --- Composite Types ---

type UnaryOp = '*';
type BinaryOp = '⋅' | '+';

/** * Represents the Kleene Star (r*).
 * We wrap the inner expression.
 */
class Star extends RegExpNode<[RegExp, UnaryOp]> {
    constructor(inner: RegExp) { super(inner, '*'); }
    get inner(): RegExp { return this.get(0); }
}

/** * Abstract base for Binary Operations to ensure type safety.
 */
abstract class BinaryRegExp<L extends RegExp, R extends RegExp> 
    extends RegExpNode<[L, BinaryOp, R]> {
    
    constructor(left: L, op: BinaryOp, right: R) {
        super(left, op, right);
    }

    get left(): L { return this.get(0); }
    get right(): R { return this.get(2); }
}

/** Represents Concatenation (r1 ⋅ r2). */
class Concat extends BinaryRegExp<RegExp, RegExp> {
    constructor(left: RegExp, right: RegExp) { super(left, '⋅', right); }
}

/** Represents Union (r1 + r2). */
class Union extends BinaryRegExp<RegExp, RegExp> {
    constructor(left: RegExp, right: RegExp) { super(left, '+', right); }
}

/** * The Union Type of all possible Regular Expression nodes.
 * This is the type used in function signatures.
 */
type RegExp = 
    | EmptySet 
    | Epsilon 
    | CharNode 
    | Star 
    | Concat 
    | Union;

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
    private Σ: RecursiveSet<Char>;

    constructor(Σ: RecursiveSet<Char>) {
        this.Σ = Σ;
        this.gen = new StateGenerator();
    }

    public toNFA(r: RegExp): NFA {
        if (r instanceof EmptySet) {
            return genEmptyNFA(this.gen, this.Σ);
        }

        if (r instanceof Epsilon) {
            return genEpsilonNFA(this.gen, this.Σ);
        }

        if (r instanceof CharNode) {
            return genCharNFA(this.gen, this.Σ, r.value);
        }
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

        throw new Error(`Unknown RegExp Node: ${r}`);
    }
}

export {
    RegExp,
    RegExp2NFA,
    EmptySet,
    Epsilon,
    CharNode,
    Star,
    Concat,
    Union
}