import { RecursiveSet, RecursiveMap, Tuple, Value } from 'recursive-set';
import { NFA, State, Char, TransRel } from "./01-NFA-2-DFA";

abstract class RegExpNode<T extends Value[]> extends Tuple<T> {}

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

class Variable extends RegExpNode<[string]> {
    constructor(name: string) { super(name); }
    get name(): string { return this.get(0); }
}

// 1. The Recursive Union Type
type RegExp = 
    | EmptySet 
    | Epsilon 
    | CharNode 
    | Variable 
    | Star 
    | Concat 
    | Union;

// 2. Operator Types
type UnaryOp = '*';
type BinaryOp = '⋅' | '+';

// 3. Composite Class Implementations

class Star extends RegExpNode<[RegExp, UnaryOp]> {
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

function catenate(gen: StateGenerator, f1: NFA, f2: NFA): NFA {
    const q1 = f1.q0, q3 = f2.q0;
    if (f1.A.size !== 1) throw new Error("Thompson NFA must have exactly 1 accepting state");
    const [q2] = f1.A; 
    const delta = f1.δ.mutableCopy();
    for (const [k, v] of f2.δ) { delta.set(k, v); }
    delta.set(new Tuple(q2, 'ε'), new RecursiveSet(q3));

    return { Q: f1.Q.union(f2.Q), Σ: f1.Σ, δ: delta, q0: q1, A: f2.A };
}

function disjunction(gen: StateGenerator, f1: NFA, f2: NFA): NFA {
    const q1 = f1.q0, q2 = f2.q0;
    if (f1.A.size !== 1 || f2.A.size !== 1) throw new Error("Invalid NFA structure");
    const [q3] = f1.A;
    const [q4] = f2.A;
    const q0 = gen.getNewState();
    const q5 = gen.getNewState();
    const delta = f1.δ.mutableCopy();
    for (const [k, v] of f2.δ) { delta.set(k, v); }
    delta.set(new Tuple(q0, 'ε'), new RecursiveSet(q1, q2));
    const endState = new RecursiveSet(q5);
    delta.set(new Tuple(q3, 'ε'), new RecursiveSet(q5));
    delta.set(new Tuple(q4, 'ε'), new RecursiveSet(q5));

    return { Q: new RecursiveSet(q0, q5).union(f1.Q).union(f2.Q), Σ: f1.Σ, δ: delta, q0: q0, A: new RecursiveSet(q5) };
}

function kleene(gen: StateGenerator, f: NFA): NFA {
    const q1 = f.q0;
    if (f.A.size !== 1) throw new Error("Invalid NFA structure");
    const [q2] = f.A;
    const q0 = gen.getNewState();
    const q3 = gen.getNewState();
    const delta = f.δ.mutableCopy();
    delta.set(new Tuple(q0, 'ε'), new RecursiveSet(q1, q3));
    delta.set(new Tuple(q2, 'ε'), new RecursiveSet(q1, q3));

    return { Q: new RecursiveSet(q0, q3).union(f.Q), Σ: f.Σ, δ: delta, q0: q0, A: new RecursiveSet(q3) };
}

class RegExp2NFA {
    private gen = new StateGenerator();
    constructor(private sigma: RecursiveSet<Char>) {}

    public toNFA(r: RegExp): NFA {
        if (r instanceof EmptySet)
            return genEmptyNFA(this.gen, this.sigma);
        if (r instanceof Epsilon)
            return genEpsilonNFA(this.gen, this.sigma);
        if (r instanceof CharNode)
            return genCharNFA(this.gen, this.sigma, r.value);
        if (r instanceof Star)
            return kleene(this.gen, this.toNFA(r.inner));
        if (r instanceof Concat) 
            return catenate(this.gen, this.toNFA(r.left), this.toNFA(r.right));
        if (r instanceof Union) 
            return disjunction(this.gen, this.toNFA(r.left), this.toNFA(r.right));
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