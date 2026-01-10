import { RecursiveSet, Tuple } from 'recursive-set';
import { DFA, DFAState, State, Char, TransRelDet, key } from "./01-NFA-2-DFA";
import { RegExp, BinaryOp, UnaryOp, EmptySet, Epsilon } from "./03-RegExp-2-NFA";

function regexpSum(S: RecursiveSet<RegExp> | RegExp[]): RegExp {
  const elems: readonly RegExp[] = (S instanceof RecursiveSet) ? S.raw : S;
  const n = elems.length;

  if (n === 0) return 0;
  if (n === 1) return elems[0];

  const [r, ...rest] = elems;

  return new Tuple(
    r, 
    '+', 
    regexpSum(rest)
  );
}

function rpq(
  p1: DFAState,
  p2: DFAState,
  Sigma: RecursiveSet<Char>,
  delta: TransRelDet,
  Allowed: readonly DFAState[]
): RegExp {
  if (Allowed.length === 0) {
    const allChars: Char[] = [];
    
    for (const c of Sigma) {
      const target = delta.get(key(p1, c));
      
      if (target && target.equals(p2)) {
        allChars.push(c);
      }
    }

    const r = regexpSum(allChars);

    if (p1.equals(p2)) {
      return new Tuple('ε', '+', r);
    } else {
      return r;
    }
  }

  const [q, ...RestAllowed] = Allowed;

  const rp1p2 = rpq(p1, p2, Sigma, delta, RestAllowed);
  const rp1q  = rpq(p1, q,  Sigma, delta, RestAllowed);
  const rqq   = rpq(q,  q,  Sigma, delta, RestAllowed);
  const rqp2  = rpq(q,  p2, Sigma, delta, RestAllowed);

  const loop = new Tuple(rqq, '*');
  const concat1 = new Tuple(rp1q, '⋅', loop);
  const concat2 = new Tuple(concat1, '⋅', rqp2);

  return new Tuple(
    rp1p2, 
    '+', 
    concat2
  );
}

export function dfa2regexp(F: DFA): RegExp {
  const { Q, Sigma, delta, q0, A } = F;
  
  const allStates = Q.raw; 
  
  const parts: RegExp[] = [];

  for (const acc of A) {
    const r = rpq(q0, acc, Sigma, delta, allStates);
    parts.push(r);
  }

  return regexpSum(parts);
}


