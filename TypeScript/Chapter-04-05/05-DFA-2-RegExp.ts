import { RecursiveSet, Tuple } from 'recursive-set';

// === Types ===
export type State = string | number;
export type Char = string;

// Consistent with previous notebook: DFAState is a set of NFA states
export type DFAState = RecursiveSet<State>;

export type TransRelDet = Map<string, DFAState>;

export type DFA = {
  Q: RecursiveSet<DFAState>;
  Sigma: RecursiveSet<Char>;
  delta: TransRelDet;
  q0: DFAState;
  A: RecursiveSet<DFAState>;
};

// RegExp Definition
export type BinaryOp = '⋅' | '+';
export type UnaryOp = '*';

export type RegExp = 
  | number      // 0 (Empty Set)
  | string      // 'ε' or Char
  | Tuple<[RegExp, UnaryOp]>          // Kleene Star
  | Tuple<[RegExp, BinaryOp, RegExp]>; // Concatenation / Union


// === Helpers ===

export function key(q: DFAState, c: Char): string {
  // v4.0.0 safe key generation
  return `${q.toString()},${c}`;
}

/**
 * Helper to sum up a list of regular expressions (Union).
 * r1 + r2 + ... + rn
 */
export function regexpSum(S: RecursiveSet<RegExp> | RegExp[]): RegExp {
  const elems: RegExp[] = Array.isArray(S) ? S : Array.from(S);
  const n = elems.length;

  if (n === 0) return 0; // Empty Set
  if (n === 1) return elems[0];

  const [r, ...rest] = elems;

  return new Tuple<[RegExp, BinaryOp, RegExp]>(
    r, 
    '+', 
    regexpSum(rest)
  );
}

// === Main Algorithm: State Elimination (RPQ) ===

/**
 * Computes a regular expression for the language going from p1 to p2,
 * allowing only intermediate states from the set `Allowed`.
 * 
 * Implements the recursive formula:
 * R(p1, p2, {q} U Rest) = R(p1, p2, Rest) + R(p1, q, Rest) . R(q, q, Rest)* . R(q, p2, Rest)
 */
function rpq(
  p1: DFAState,
  p2: DFAState,
  Sigma: RecursiveSet<Char>,
  delta: TransRelDet,
  Allowed: DFAState[]
): RegExp {
  // Base Case: No intermediate states allowed (Direct transitions)
  if (Allowed.length === 0) {
    const allChars = new RecursiveSet<Char>();
    
    for (const c of Sigma) {
      // Direct lookup in deterministic transition table
      const target = delta.get(key(p1, c));
      
      // Check if transition leads to p2
      // v4.0.0 equality check is efficient
      if (target && target.equals(p2)) {
        allChars.add(c);
      }
    }

    const r = regexpSum(allChars);

    // If start == end, we accept epsilon as well
    if (p1.equals(p2)) {
      return new Tuple<[RegExp, BinaryOp, RegExp]>('ε', '+', r);
    } else {
      return r;
    }
  }

  // Recursive Step: Eliminate state q
  const [q, ...RestAllowed] = Allowed;

  // Compute sub-expressions recursively
  const rp1p2 = rpq(p1, p2, Sigma, delta, RestAllowed);
  const rp1q  = rpq(p1, q,  Sigma, delta, RestAllowed);
  const rqq   = rpq(q,  q,  Sigma, delta, RestAllowed);
  const rqp2  = rpq(q,  p2, Sigma, delta, RestAllowed);

  // Construct Term: (rp1q ⋅ rqq* ⋅ rqp2)
  
  // 1. Loop: rqq*
  const loop = new Tuple<[RegExp, UnaryOp]>(rqq, '*');

  // 2. Concat: rp1q ⋅ loop
  const concat1 = new Tuple<[RegExp, BinaryOp, RegExp]>(rp1q, '⋅', loop);

  // 3. Concat: concat1 ⋅ rqp2
  const concat2 = new Tuple<[RegExp, BinaryOp, RegExp]>(concat1, '⋅', rqp2);

  // Combine: Direct path + Path via q
  return new Tuple<[RegExp, BinaryOp, RegExp]>(
    rp1p2, 
    '+', 
    concat2
  );
}

/**
 * Converts a DFA into an equivalent Regular Expression.
 * L(A) = Union of rpq(q0, f, Q) for all final states f in A.
 */
export function dfa2regexp(F: DFA): RegExp {
  const { Q, Sigma, delta, q0, A } = F;
  
  // Convert Set of States to Array for recursion order
  // v4.0.0 ensures deterministic order in Array.from(Q) due to sorted storage!
  const allStates = Array.from(Q);
  const parts = new RecursiveSet<RegExp>();

  for (const acc of A) {
    // Calculate Regex for path from Start -> Accepting State
    const r = rpq(q0, acc, Sigma, delta, allStates);
    parts.add(r);
  }

  return regexpSum(parts);
}
