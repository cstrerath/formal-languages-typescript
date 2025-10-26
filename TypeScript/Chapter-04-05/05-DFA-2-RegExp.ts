// ---------------------------------------------------------------------------
// 05-DFA-2-RegExp.ts
// Converts a Deterministic Finite Automaton (DFA) into an equivalent
// Regular Expression according to the algorithm from the lecture.
// ---------------------------------------------------------------------------

// ---------- Basic Type Definitions -----------------------------------------

export type Char = string;

// Recursive Type for Regular Expressions
// Equivalent to: RegExp = int | Char | tuple[RegExp, ...]
export type RegExp = number | Char | [RegExp, ...RegExp[]];

// States are represented as numeric IDs
export type State = number;

// Transition Relation: (State, Char) → State
export type TransRel = Map<[State, Char], State>;

// DFA Definition: (Q, Σ, δ, q0, F)
export interface DFA {
  Q: Set<State>;
  Sigma: Set<Char>;
  delta: TransRel;
  q0: State;
  F: Set<State>;
}

// ---------- Conversion Functions -------------------------------------------

// Helper: Sum (union) of a set of regular expressions
export function regexp_sum(S: Set<RegExp> | RegExp[]): RegExp {
  const list = Array.from(S);
  const n = list.length;

  switch (n) {
    case 0:
      return 0; // empty language
    case 1:
      return list[0];
    default: {
      const [r, ...rest] = list;
      return [r, '+', regexp_sum(rest)] as RegExp;
    }
  }
}

// Recursive function rpq(p1, p2, Σ, δ, Allowed)
export function rpq(
  p1: State,
  p2: State,
  Sigma: Set<Char>,
  delta: TransRel,
  Allowed: State[] | Set<State>
): RegExp {
  const allowedList = Array.from(Allowed);

  // Case 1: Allowed is empty
  if (allowedList.length === 0) {
    // All characters that lead from p1 to p2
    const AllChars = new Set<RegExp>(
      Array.from(Sigma).filter((c) => {
        for (const [[q, sym], target] of delta.entries()) {
          if (q === p1 && sym === c && target === p2) {
            return true;
          }
        }
        return false;
      })
    );

    const r = regexp_sum(AllChars);

    if (p1 === p2) {
      // ε + r
      return ['ε', '+', r] as RegExp;
    } else {
      return r;
    }
  }

  // Case 2: Allowed = {q} ∪ RestAllowed
  const [q, ...RestAllowed] = allowedList;

  const rp1p2 = rpq(p1, p2, Sigma, delta, RestAllowed);
  const rp1q = rpq(p1, q, Sigma, delta, RestAllowed);
  const rqq = rpq(q, q, Sigma, delta, RestAllowed);
  const rqp2 = rpq(q, p2, Sigma, delta, RestAllowed);

  // rpq(p1,p2,Allowed) := rp1p2 + rp1q ⋅ rqq* ⋅ rqp2
  return [rp1p2, '+', [[rp1q, '⋅', [rqq, '*']], '⋅', rqp2]] as RegExp;
}

// Converts a DFA into an equivalent regular expression
export function dfa_2_regexp(F: DFA): RegExp {
  const States = F.Q;
  const Sigma = F.Sigma;
  const delta = F.delta;
  const q0 = F.q0;
  const Accepting = F.F;

  const regexSet = new Set<RegExp>();
  for (const p of Accepting) {
    regexSet.add(rpq(q0, p, Sigma, delta, Array.from(States)));
  }

  return regexp_sum(regexSet);
}
