import { display } from "tslab";
import { readFileSync } from "fs";

const css = readFileSync("../style.css", "utf8");
display.html(`<style>${css}</style>`);

import { RecursiveSet, Tuple, Value } from "recursive-set";
import { key } from "./05-DFA-2-RegExp";

// === Existing Types ===
export type State = string | number;
type Char = string;
export type DFAState = RecursiveSet<State>; 
export type TransRelDet = Map<string, DFAState>;

export type DFA = {
  Q: RecursiveSet<DFAState>;
  Sigma: RecursiveSet<Char>;
  delta: TransRelDet;
  q0: DFAState;
  A: RecursiveSet<DFAState>;
};

// === New Types for Minimization (Mathematical View) ===

type Pair = Tuple<[DFAState, DFAState]>;
type MinState = RecursiveSet<DFAState>;
type MinTransRel = Map<string, MinState>;

type MinDFA = {
    Q: RecursiveSet<MinState>;
    Sigma: RecursiveSet<Char>;
    delta: MinTransRel;
    q0: MinState;
    A: RecursiveSet<MinState>;
}

function arb<T extends Value>(M: RecursiveSet<T>): T {
  if (M.isEmpty()) throw new Error("Error: arb called with empty set!");
  return M.raw[0];
}

function cartProd<S extends Value, T extends Value>(
  A: RecursiveSet<S>, 
  B: RecursiveSet<T>
): RecursiveSet<Tuple<[S, T]>> {
  return A.cartesianProduct(B);
}

function separate(
  Pairs: RecursiveSet<Pair>, 
  States: RecursiveSet<DFAState>, 
  Sigma: RecursiveSet<Char>, 
  delta: TransRelDet
): RecursiveSet<Pair> {
  
  const newPairs: Pair[] = [];
  
  const statesArr = States.raw;
  const sigmaArr = Sigma.raw;

  for (const q1 of statesArr) {
    for (const q2 of statesArr) {
      for (const c of sigmaArr) {
        const p1 = delta.get(key(q1, c));
        const p2 = delta.get(key(q2, c));
        
        if (p1 && p2) {
          const targetPair = new Tuple<[DFAState, DFAState]>(p1, p2);
          
          if (Pairs.has(targetPair)) {
            newPairs.push(new Tuple<[DFAState, DFAState]>(q1, q2));
            break;
          }
        }
      }
    }
  }
  return RecursiveSet.fromArray(newPairs);
}

function findEquivalenceClass(
  p: DFAState, 
  Partition: RecursiveSet<MinState>
): MinState {
  for (const C of Partition) {
    if (C.has(p)) return C;
  }
  throw new Error(`State ${p} not found in partition`);
}

function allSeparable(
  Q: RecursiveSet<DFAState>, 
  A: RecursiveSet<DFAState>, 
  Sigma: RecursiveSet<Char>, 
  delta: TransRelDet
): RecursiveSet<Pair> {
  
  const NonAccepting = Q.difference(A);

  const set1 = cartProd(NonAccepting, A);
  const set2 = cartProd(A, NonAccepting);
  
  let Separable = set1.union(set2);

  while (true) {
    const NewPairs = separate(Separable, Q, Sigma, delta);
    
    if (NewPairs.isSubset(Separable)) {
      return Separable;
    }
    
    Separable = Separable.union(NewPairs);
  }
}

function reachable(
  q0: DFAState, 
  Sigma: RecursiveSet<Char>, 
  delta: TransRelDet
): RecursiveSet<DFAState> {
  
  const visited = new RecursiveSet<DFAState>(q0);
  const queue: DFAState[] = [q0];
  
  let head = 0;
  while(head < queue.length) {
      const p = queue[head++];
      
      for (const c of Sigma) {
          const target = delta.get(key(p, c));
          if (target && !visited.has(target)) {
              visited.add(target);
              queue.push(target);
          }
      }
  }
  return visited;
}

function reachableFixedPoint(
  q0: DFAState, 
  Sigma: RecursiveSet<Char>, 
  delta: TransRelDet
): RecursiveSet<DFAState> {
  
  let Result = new RecursiveSet<DFAState>(q0);
  
  while (true) {
    const NewStates = new RecursiveSet<DFAState>();
    
    for (const p of Result) {
      for (const c of Sigma) {
        const target = delta.get(key(p, c));
        if (target) {
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

// Local helper for MinKeys
function minKey(q: MinState, c: Char): string {
  return `${q.toString()},${c}`;
}

export function minimize(F: DFA): MinDFA {
  let { Q, Sigma, delta, q0, A } = F;
  
  Q = reachable(q0, Sigma, delta);
  const reachableA = A.intersection(Q);
  
  const Separable = allSeparable(Q, reachableA, Sigma, delta);
  
  const EquivClasses = new RecursiveSet<MinState>();
  const Processed = new RecursiveSet<DFAState>();

  for (const q of Q) {
    if (Processed.has(q)) continue;

    const equivalenceClass = new RecursiveSet<DFAState>();
    
    for (const p of Q) {
      const pairToCheck = new Tuple<[DFAState, DFAState]>(p, q);
      if (!Separable.has(pairToCheck)) {
        equivalenceClass.add(p);
        Processed.add(p);
      }
    }
    EquivClasses.add(equivalenceClass);
  }
  
  let newQ0: MinState | undefined;
  
  const stateToClass = new Map<string, MinState>();
  
  for (const M of EquivClasses) {
      if (M.has(q0)) newQ0 = M;
      
      for (const state of M) {
          stateToClass.set(state.toString(), M);
      }
  }
  
  if (!newQ0) throw new Error("Start state vanished!");

  const newAcceptArr: MinState[] = [];
  for (const M of EquivClasses) {
    const representative = arb(M);
    if (A.has(representative)) {
      newAcceptArr.push(M);
    }
  }
  
  const newDelta: MinTransRel = new Map();
  
  for (const M of EquivClasses) {
    const q = arb(M); 
    for (const c of Sigma) {
      const target = delta.get(key(q, c));
      
      if (target) {
        const targetClass = stateToClass.get(target.toString());
        
        if (targetClass) {
             newDelta.set(minKey(M, c), targetClass);
        }
      }
    }
  }
  
  return {
    Q: EquivClasses,
    Sigma,
    delta: newDelta,
    q0: newQ0,
    A: RecursiveSet.fromArray(newAcceptArr)
  };
}


