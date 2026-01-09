import { RecursiveSet, Tuple, Value } from "recursive-set";
import { key } from "./05-DFA-2-RegExp";

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

// === Minimization Specific Types ===

type Pair = Tuple<[DFAState, DFAState]>;
type EquivClass = RecursiveSet<DFAState>;
export type Partition = RecursiveSet<RecursiveSet<DFAState>>

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
  
  const newPairsArr: Pair[] = [];
  
  const statesArr = States.raw;
  const sigmaArr = Sigma.raw;

  for (const q1 of statesArr) {
    for (const q2 of statesArr) {
      for (const c of sigmaArr) {
        const p1 = delta.get(key(q1, c));
        const p2 = delta.get(key(q2, c));
        
        if (p1 && p2) {
          const targetPair = new Tuple(p1, p2);
          
          if (Pairs.has(targetPair)) {
            newPairsArr.push(new Tuple(q1, q2));
          }
        }
      }
    }
  }
  return RecursiveSet.fromArray(newPairsArr);
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

export function computeMinimizationPartition(F: DFA): Partition {
  let { Q, Sigma, delta, q0, A } = F;
  
  Q = reachable(q0, Sigma, delta);
  const reachableA = A.intersection(Q);
  
  const Separable = allSeparable(Q, reachableA, Sigma, delta);
  
  const EquivClasses = new RecursiveSet<EquivClass>();
  const Processed = new RecursiveSet<DFAState>();

  for (const q of Q) {
    if (Processed.has(q)) continue;

    const cls = new RecursiveSet<DFAState>();
    for (const p of Q) {
      const pairToCheck = new Tuple(p, q);
      if (!Separable.has(pairToCheck)) {
        cls.add(p);
        Processed.add(p);
      }
    }
    EquivClasses.add(cls);
  }
  
  return EquivClasses;
}

export function minimize(F: DFA): DFA {
  const { q0, A, delta, Sigma } = F;
  
  const EquivClasses = computeMinimizationPartition(F);

  const classToNewState = new Map<string, DFAState>();
  const newStatesArr: DFAState[] = [];
  
  for (const cls of EquivClasses) {
      let mergedState = new RecursiveSet<State>();
      for (const oldState of cls) {
          mergedState = mergedState.union(oldState);
      }
      
      newStatesArr.push(mergedState);
      classToNewState.set(cls.toString(), mergedState);
  }

  const getNewStateForOld = (oldState: DFAState): DFAState => {
     for (const cls of EquivClasses) {
         if (cls.has(oldState)) {
             return classToNewState.get(cls.toString())!;
         }
     }
     throw new Error(`State ${oldState} lost during minimization`);
  };

  const newQ0 = getNewStateForOld(q0);

  const newAcceptArr: DFAState[] = [];
  for (const cls of EquivClasses) {
      const rep = arb(cls);
      if (A.has(rep)) {
          newAcceptArr.push(classToNewState.get(cls.toString())!);
      }
  }

  const newDelta: TransRelDet = new Map();
  for (const cls of EquivClasses) {
      const newState = classToNewState.get(cls.toString())!;
      const rep = arb(cls); 
      
      for (const c of Sigma) {
          const targetOld = delta.get(key(rep, c));
          if (targetOld) {
              const targetNew = getNewStateForOld(targetOld);
              newDelta.set(key(newState, c), targetNew);
          }
      }
  }
  
  return {
    Q: RecursiveSet.fromArray(newStatesArr),
    Sigma,
    delta: newDelta,
    q0: newQ0,
    A: RecursiveSet.fromArray(newAcceptArr)
  };
}
