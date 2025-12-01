import { RecursiveSet } from "recursive-set";
import { NFA, DFA, State, Char, TransRel, TransRelDet, key } from "./01-NFA-2-DFA";

// Helper: Set formatting
function pySetStr(s: RecursiveSet<any> | Set<any>): string {
  if (!s || s.size === 0) return "{}";
  const elements: string[] = Array.from(s).map((x: any) => String(x)).sort();
  return `{${elements.join(", ")}}`;
}

// ============================================================
// 1. DFA to String
// ============================================================
export function dfa2string(dfa: DFA): string {
  const { Q, Sigma, delta, q0, A } = dfa;
  let result: string = "";
  let n: number = 0;
  
  const statesList: RecursiveSet<State>[] = Array.from(Q) as RecursiveSet<State>[];
  const statesToNames = new Map<RecursiveSet<State>, string>();
  
  for (const q of statesList) {
    statesToNames.set(q, `S${n}`);
    n++;
  }

  result += `states: {S0, ..., S${n - 1}}\n\n`;
  result += `start state: ${statesToNames.get(q0)!}\n\n`;
  
  result += "state encoding:\n";
  for (const q of statesList) {
    result += `${statesToNames.get(q)!} = ${pySetStr(q)}\n`;
  }

  result += "\ntransitions:\n";
  for (const q of statesList) {
    for (const rawC of Sigma) {
      const c: string = rawC as string;
      const k: string = key(q, c); 
      const target: RecursiveSet<State> | undefined = delta.get(k);
      
      if (target) {
        let targetName: string | undefined = statesToNames.get(target);
        
        if (!targetName) {
            for (const [s, name] of statesToNames) {
                if (s.equals(target)) { 
                    targetName = name; 
                    break; 
                }
            }
        }
        
        if (targetName) {
            result += `delta(${statesToNames.get(q)!}, ${c}) = ${targetName}\n`;
        }
      }
    }
  }

  result += "\nset of accepting states: {";
  const acceptingNames: string[] = [];
  for (const q of statesList) {
      if (A.has(q)) {
          acceptingNames.push(statesToNames.get(q)!);
      }
  }
  result += acceptingNames.join(", ");
  result += "}\n";

  return result;
}


// ============================================================
// 2. DFA to DOT
// ============================================================
export function dfa2dot(dfa: DFA): { dot: string, statesToNames: Map<RecursiveSet<State>, string> } {
  const { Q, Sigma, delta, q0, A } = dfa;
  const lines: string[] = [];
  
  lines.push('digraph "Deterministic FSM" {');
  lines.push('  rankdir=LR;');

  let n: number = 0;
  const statesList: RecursiveSet<State>[] = Array.from(Q) as RecursiveSet<State>[];
  const statesToNames = new Map<RecursiveSet<State>, string>();

  for (const q of statesList) {
    statesToNames.set(q, `S${n}`);
    n++;
  }

  const startName: string = statesToNames.get(q0)!;
  
  lines.push('  "1" [label="", width="0.1", height="0.1", style="filled", color="blue"];');
  lines.push(`  "1" -> "${startName}";`);

  for (const q of statesList) {
    const name: string = statesToNames.get(q)!;
    if (A.has(q)) {
      lines.push(`  "${name}" [peripheries="2"];`);
    } else {
      lines.push(`  "${name}";`);
    }
  }

  for (const q of statesList) {
    const sourceName: string = statesToNames.get(q)!;
    for (const rawC of Sigma) {
      const c: string = rawC as string;
      const target: RecursiveSet<State> | undefined = delta.get(key(q, c));
      
      if (target) {
        let targetName: string | undefined = statesToNames.get(target);
        if (!targetName) {
             for (const [s, name] of statesToNames) {
                if (s.equals(target)) { targetName = name; break; }
            }
        }
        
        if (targetName) {
            lines.push(`  "${sourceName}" -> "${targetName}" [label="${c}"];`);
        }
      }
    }
  }

  lines.push("}");
  return { dot: lines.join("\n"), statesToNames };
}


// ============================================================
// 3. NFA to String
// ============================================================
export function nfa2string(nfa: NFA): string {
  const { Q, Sigma, delta, q0, A } = nfa;
  let result: string = "";
  
  result += `states: ${pySetStr(Q)}\n\n`;
  result += `start state: ${q0}\n\n`;
  result += "transitions:\n";

  const sortedStates: string[] = Array.from(Q).map(String).sort();
  const sortedSigma: string[] = Array.from(Sigma).map(String).sort();

  for (const q of sortedStates) {
      for (const c of sortedSigma) {
          const targets: RecursiveSet<State> | undefined = delta.get(key(q, c));
          if (targets) {
              for (const p of targets) {
                  result += `[${q}, ${c}] |-> ${p}\n`;
              }
          }
      }
      
      const targetsEps: RecursiveSet<State> | undefined = delta.get(key(q, "ε"));
      if (targetsEps) {
          for (const p of targetsEps) {
               result += `[${q}, ""] |-> ${p}\n`;
          }
      }
  }

  result += `\nset of accepting states: ${pySetStr(A)}\n`;
  return result;
}


// ============================================================
// 4. NFA to DOT
// ============================================================
export function nfa2dot(nfa: NFA): string {
  const { Q, Sigma, delta, q0, A } = nfa;
  const lines: string[] = [];
  
  lines.push('digraph "Non-Deterministic FSM" {');
  lines.push('  rankdir=LR;');
  
  const startName: string = q0.toString();
  const statesList: State[] = Array.from(Q) as State[];
  
  lines.push('  "0" [label="", width="0.1", height="0.1", style="filled", color="blue"];');
  lines.push(`  "0" -> "${startName}";`);

  for (const q of statesList) {
      if (A.has(q)) {
          lines.push(`  "${q}" [peripheries="2"];`);
      } else {
          lines.push(`  "${q}";`);
      }
  }

  for (const q of statesList) {
      const targets: RecursiveSet<State> | undefined = delta.get(key(q, "ε"));
      if (targets) {
          for (const p of targets) {
              lines.push(`  "${q}" -> "${p}" [label="ε", weight="0.1"];`);
          }
      }
  }

  for (const q of statesList) {
      for (const rawC of Sigma) {
          const c: string = rawC as string;
          const targets: RecursiveSet<State> | undefined = delta.get(key(q, c));
          if (targets) {
              for (const p of targets) {
                  lines.push(`  "${q}" -> "${p}" [label="${c}", weight="10"];`);
              }
          }
      }
  }

  lines.push("}");
  return lines.join("\n");
}
