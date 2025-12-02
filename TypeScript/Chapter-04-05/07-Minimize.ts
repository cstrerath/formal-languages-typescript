import { RecursiveSet } from 'recursive-set';

export type Char = string;

export type TransRel<S> = Map<string, S>;

export interface DFA<S> {
  Q: RecursiveSet<S>;
  Sigma: RecursiveSet<Char>;
  delta: TransRel<S>;
  q0: S;
  A: RecursiveSet<S>;
}

export type SetState<S> = RecursiveSet<S>;

export type MinDFA<S> = DFA<SetState<S>>;

export function key<S>(q: S, c: Char): string {
  return `${q instanceof RecursiveSet ? q.toString() : q},${c}`;
}

function makePair<S>(a: S, b: S): RecursiveSet<RecursiveSet<S>> {
  const sa = new RecursiveSet<S>(a);
  const sab = new RecursiveSet<S>(a, b);
  return new RecursiveSet<RecursiveSet<S>>(sa, sab);
}

export function arb<T>(M: RecursiveSet<T>): T {
  for (const x of M) {
    return x as T;
  }
  throw new Error('Error: arb called with empty set!');
}

export function cart_prod<S, T>(
  A: RecursiveSet<S>,
  B: RecursiveSet<T>
): RecursiveSet<RecursiveSet<S | T>> {
  return A.cartesianProduct(B);
}

export function separate<S>(
  Pairs: RecursiveSet<RecursiveSet<S>>,
  States: RecursiveSet<S>,
  Sigma: RecursiveSet<Char>,
  delta: TransRel<S>
): RecursiveSet<RecursiveSet<S>> {
  const Result = new RecursiveSet<RecursiveSet<S>>();

  for (const q1_raw of States) {
    const q1 = q1_raw as S;
    for (const q2_raw of States) {
      const q2 = q2_raw as S;
      for (const c_raw of Sigma) {
        const c = c_raw as Char;

        const p1 = delta.get(key(q1, c));
        const p2 = delta.get(key(q2, c));

        if (p1 !== undefined && p2 !== undefined) {
          const targetPair = makePair(p1, p2);
          if (Pairs.has(targetPair)) {
            Result.add(makePair(q1, q2));
          }
        }
      }
    }
  }
  return Result;
}

export function find_equivalence_class<S>(
  p: S,
  Partition: RecursiveSet<RecursiveSet<S>>
): RecursiveSet<S> {
  const candidates = new RecursiveSet<RecursiveSet<S>>();
  for (const C_raw of Partition) {
    const C = C_raw as RecursiveSet<S>;
    if (C.has(p)) {
      candidates.add(C);
    }
  }
  return arb(candidates);
}

export function reachable<S>(
  q0: S,
  Sigma: RecursiveSet<Char>,
  delta: TransRel<S>
): RecursiveSet<S> {
  let Result = new RecursiveSet<S>(q0);

  while (true) {
    const NewStates = new RecursiveSet<S>();
    for (const p_raw of Result) {
      const p = p_raw as S;
      for (const c_raw of Sigma) {
        const c = c_raw as Char;
        const target = delta.get(key(p, c));
        if (target !== undefined) {
          NewStates.add(target);
        }
      }
    }

    if (NewStates.isSubset(Result)) {
      return Result;
    }
    Result = Result.union(NewStates);
  }
}

export function all_separable<S>(
  Q: RecursiveSet<S>,
  A: RecursiveSet<S>,
  Sigma: RecursiveSet<Char>,
  delta: TransRel<S>
): RecursiveSet<RecursiveSet<S>> {
  const NonAccepting = Q.difference(A);

  let Separable = cart_prod(NonAccepting, A).union(cart_prod(A, NonAccepting));

  while (true) {
    const NewPairs = separate(Separable, Q, Sigma, delta);
    if (NewPairs.isSubset(Separable)) {
      return Separable;
    }
    Separable = Separable.union(NewPairs);
  }
}

export function minimize<S>(F: DFA<S>): MinDFA<S> {
  const { Sigma, delta, q0, A } = F;

  const Q = reachable(q0, Sigma, delta);

  const Separable = all_separable(Q, A, Sigma, delta);

  const AllPairs = cart_prod(Q, Q);
  const Equivalent = AllPairs.difference(Separable);

  const EquivClasses = new RecursiveSet<RecursiveSet<S>>();

  for (const q_raw of Q) {
    const q = q_raw as S;
    const eqClass = new RecursiveSet<S>();
    for (const p_raw of Q) {
      const p = p_raw as S;
      if (Equivalent.has(makePair(p, q))) {
        eqClass.add(p);
      }
    }
    EquivClasses.add(eqClass);
  }

  const q0Candidates = new RecursiveSet<RecursiveSet<S>>();
  for (const M_raw of EquivClasses) {
    const M = M_raw as RecursiveSet<S>;
    if (M.has(q0)) {
      q0Candidates.add(M);
    }
  }
  const newQ0 = arb(q0Candidates);

  const newAccept = new RecursiveSet<RecursiveSet<S>>();
  for (const M_raw of EquivClasses) {
    const M = M_raw as RecursiveSet<S>;
    const representative = arb(M);

    if (A.has(representative)) {
      newAccept.add(M);
    }
  }

  const newDelta = new Map<string, RecursiveSet<S>>();
  for (const q_raw of Q) {
    const q = q_raw as S;
    for (const c_raw of Sigma) {
      const c = c_raw as Char;

      const p = delta.get(key(q, c));

      const classOfQ = find_equivalence_class(q, EquivClasses);

      if (p !== undefined) {
        const classOfP = find_equivalence_class(p, EquivClasses);
        newDelta.set(key(classOfQ, c), classOfP);
      } else {
        newDelta.set(key(classOfQ, c), new RecursiveSet<S>());
      }
    }
  }

  return {
    Q: EquivClasses,
    Sigma: Sigma,
    delta: newDelta,
    q0: newQ0,
    A: newAccept,
  };
}
