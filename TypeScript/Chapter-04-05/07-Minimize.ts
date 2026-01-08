import { RecursiveSet, Tuple, Value } from "recursive-set";
import { key } from "./05-DFA-2-RegExp";

// === Basic Types ===
export type State = string | number;
type Char = string;

// A state in a DFA is a Set of original atomic states
export type DFAState = RecursiveSet<State>; 

// Standard DFA Transition Map
export type TransRelDet = Map<string, DFAState>;

// The Standard DFA structure
export type DFA = {
  Q: RecursiveSet<DFAState>;
  Sigma: RecursiveSet<Char>;
  delta: TransRelDet;
  q0: DFAState;
  A: RecursiveSet<DFAState>;
};

// === Minimization Specific Types ===

// A pair of states (p, q)
type Pair = Tuple<[DFAState, DFAState]>;

// Intermediate: An equivalence class is a set of DFAStates
type EquivClass = RecursiveSet<DFAState>;

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

export function minimize(F: DFA): DFA {
  let { Q, Sigma, delta, q0, A } = F;
  
  // 1. Filter Reachable States
  Q = reachable(q0, Sigma, delta);
  const reachableA = A.intersection(Q);
  
  // 2. Calculate Separable Pairs
  const Separable = allSeparable(Q, reachableA, Sigma, delta);
  
  // 3. Identify Equivalent Classes
  const EquivClasses = new RecursiveSet<EquivClass>();
  const Processed = new RecursiveSet<DFAState>();

  // Map each old state to its Equivalence Class (for fast lookup)
  // Since we can't use object keys for Sets, we assume partitioning works correctly
  // and build the classes list first.
  for (const q of Q) {
    if (Processed.has(q)) continue;

    const cls = new RecursiveSet<DFAState>();
    // Find all p equivalent to q
    for (const p of Q) {
      const pairToCheck = new Tuple(p, q);
      if (!Separable.has(pairToCheck)) {
        cls.add(p);
        Processed.add(p);
      }
    }
    EquivClasses.add(cls);
  }

  // === FLATTENING / RENAMING STEP ===
  // To verify strict DFA type, we map each EquivClass (Set of Sets)
  // to a new simple DFAState (Set of a single Number).
  // Example: Class {{1,2}, {3,4}} -> becomes State {1} (new ID)

  const classToNewState = new Map<string, DFAState>();
  const newStatesArr: DFAState[] = [];
  
  // Generate IDs deterministically
  let idCounter = 0;
  // Sorting EquivClasses by their string representation ensures deterministic numbering
  // RecursiveSet iterator is sorted, so this loop is deterministic.
  for (const cls of EquivClasses) {
      // Create a singleton set as the new state identifier (e.g. {0}, {1}, {2})
      const newState = RecursiveSet.fromSortedUnsafe([idCounter++]);
      newStatesArr.push(newState);
      
      // Map the CLASS to this new state
      // Key: cls.toString() is safe in v7 (canonical representation)
      classToNewState.set(cls.toString(), newState);
  }

  // Helper to find which new state an OLD state belongs to
  const getNewStateForOld = (oldState: DFAState): DFAState => {
     for (const cls of EquivClasses) {
         if (cls.has(oldState)) {
             return classToNewState.get(cls.toString())!;
         }
     }
     throw new Error(`State ${oldState} lost during minimization`);
  };

  // 4. Construct New Start State
  const newQ0 = getNewStateForOld(q0);

  // 5. Construct New Accepting States
  const newAcceptArr: DFAState[] = [];
  for (const cls of EquivClasses) {
      // If any element in the class was accepting, the new state is accepting
      // (Consistency implies all or none are accepting)
      const rep = arb(cls);
      if (A.has(rep)) {
          newAcceptArr.push(classToNewState.get(cls.toString())!);
      }
  }

  // 6. Construct New Delta
  const newDelta: TransRelDet = new Map();
  
  for (const cls of EquivClasses) {
      const newState = classToNewState.get(cls.toString())!;
      const rep = arb(cls); // Representative from original DFA
      
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




