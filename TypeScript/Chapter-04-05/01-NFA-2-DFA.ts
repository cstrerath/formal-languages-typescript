import { RecursiveSet, Value } from 'recursive-set';

export type State = string | number;

export type Char = string;

export type TransRel = Map<string, RecursiveSet<State>>;

export type TransRelDet = Map<string, RecursiveSet<State>>;

export type NFA = {
  Q: RecursiveSet<State>;
  Sigma: RecursiveSet<Char>;
  delta: TransRel;
  q0: State;
  A: RecursiveSet<State>;
};

export type DFAState = RecursiveSet<State>;

export type DFA = {
  Q: RecursiveSet<DFAState>;
  Sigma: RecursiveSet<Char>;
  delta: TransRelDet;
  q0: DFAState;
  A: RecursiveSet<DFAState>;
};

export function key(q: State | DFAState, c: Char): string {
  return `${q.toString()},${c}`;
}

function bigUnion(sets: RecursiveSet<DFAState>): DFAState {
  const allElements: State[] = [];

  for (const subset of sets) {
    for (const elem of subset.raw) {
      allElements.push(elem);
    }
  }
  return RecursiveSet.fromArray(allElements);
}

function epsClosure(s: State, delta: TransRel): RecursiveSet<State> {
  let result = new RecursiveSet<State>(s);

  while (true) {
    const nextStatesArr: State[] = [];

    for (const q of result) {
      const targets = delta.get(key(q, 'ε'));
      if (targets) {
        for (const t of targets.raw) nextStatesArr.push(t);
      }
    }

    const nextStates = RecursiveSet.fromArray(nextStatesArr);

    if (nextStates.isSubset(result)) {
      return result;
    }

    result = result.union(nextStates);
  }
}

function deltaHat(s: State, c: Char, delta: TransRel): RecursiveSet<State> {
  const directTargets = delta.get(key(s, c));

  if (!directTargets || directTargets.isEmpty()) {
    return new RecursiveSet<State>();
  }

  const closures = new RecursiveSet<RecursiveSet<State>>();

  for (const q of directTargets) {
    closures.add(epsClosure(q, delta));
  }

  return bigUnion(closures);
}

function capitalDelta(
  M: RecursiveSet<State>,
  c: Char,
  delta: TransRel
): RecursiveSet<State> {
  const partials = new RecursiveSet<RecursiveSet<State>>();

  for (const q of M) {
    partials.add(deltaHat(q, c, delta));
  }

  return bigUnion(partials);
}

function allStates(
  Q0: DFAState,
  delta: TransRel,
  Sigma: RecursiveSet<Char>
): RecursiveSet<DFAState> {
  const states = new RecursiveSet<DFAState>(Q0);
  const queue: DFAState[] = [Q0];

  let head = 0;
  while (head < queue.length) {
    const M = queue[head++];

    for (const c of Sigma) {
      const N = capitalDelta(M, c, delta);

      if (!states.has(N)) {
        states.add(N);
        queue.push(N);
      }
    }
  }
  return states;
}

function allStatesFixedPoint(
  Q0: DFAState,
  delta: TransRel,
  Sigma: RecursiveSet<Char>
): RecursiveSet<DFAState> {
  let result = new RecursiveSet<DFAState>(Q0);

  while (true) {
    const candidates: DFAState[] = [];

    for (const M of result) {
      for (const c of Sigma) {
        candidates.push(capitalDelta(M, c, delta));
      }
    }

    const newStates = RecursiveSet.fromArray(candidates);

    if (newStates.isSubset(result)) {
      return result;
    }

    result = result.union(newStates);
  }
}

export function nfa2dfa(nfa: NFA): DFA {
  const { Sigma, delta, q0, A } = nfa;

  const newStart: DFAState = epsClosure(q0, delta);

  const newStates: RecursiveSet<DFAState> = allStates(newStart, delta, Sigma);

  const newDelta: TransRelDet = new Map();

  for (const M of newStates) {
    for (const c of Sigma) {
      const N = capitalDelta(M, c, delta);
      newDelta.set(key(M, c), N);
    }
  }

  const newFinalArr: DFAState[] = [];

  for (const M of newStates) {
    const intersection = M.intersection(A);

    if (!intersection.isEmpty()) {
      newFinalArr.push(M);
    }
  }

  const newFinal = RecursiveSet.fromArray(newFinalArr);

  return {
    Q: newStates,
    Sigma,
    delta: newDelta,
    q0: newStart,
    A: newFinal,
  };
}
