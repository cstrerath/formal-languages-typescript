import { TreeCursor } from "@lezer/common";

export type Operator = string;
export type AST = string | number | 
           [Operator, AST]                |
           [Operator, AST, AST]           |
           [Operator, AST, AST, AST]      |
           [Operator, AST, AST, AST, AST];

// Tokens that should be ignored during AST construction
const NOISE = new Set(["(", ")", ";", ",", "{", "}", "LineComment", "BlockComment"]);

/**
 * Transforms a Lezer TreeCursor into a generic AST tuple structure.
 * * @param cursor    - The Lezer TreeCursor starting at the node to transform
 * @param input     - The original source string (for extracting values)
 * @param operators - A list of token names that act as structural pivots (e.g. "+", ":=")
 * @param listVars  - A list of grammar variables that should be treated as linked lists
 */
export const cst2ast = (cursor: TreeCursor, input: string, operators: Operator[], listVars: string[]): AST => {
    const name = cursor.name;

    // 1. Leaf Nodes (Terminals)
    // If the node has no children, it's a raw value (Number or String/Identifier)
    if (!cursor.firstChild()) {
        const text = input.slice(cursor.from, cursor.to);
        if (name === "Number") return Number(text);
        return text;
    }
    cursor.parent(); // Reset cursor position after checking children

    // 2. Special Case: Script (Root Wrapper)
    // The grammar defines "@top Script { Program }". We treat this root as the outer block.
    if (name === "Script") {
        let body: AST = "";
        if (cursor.firstChild()) {
            do {
                // Look for the primary Program node within the Script
                if (cursor.name === "Program") {
                    body = cst2ast(cursor.node.cursor(), input, operators, listVars);
                    break;
                }
            } while (cursor.nextSibling());
            cursor.parent();
        }
        // Return as a block tuple to initialize the scope
        const scriptBlock: [Operator, AST] = ["block", body];
        return scriptBlock;
    }

    // 3. Block Detection
    // Check if the current statement is wrapped in curly braces { ... }
    let isBlock = false;
    if (name === "Stmnt" || name === "Statement") {
        if (cursor.firstChild()) {
            do {
                if (cursor.name === "{") {
                    isBlock = true;
                    break;
                }
            } while (cursor.nextSibling());
            cursor.parent();
        }
    }

    // 4. List Handling (Recursive & Iterative)
    // Transforms grammar sequences (like "Statement+") into a Linked List ['.', Head, Tail]
    if (listVars.includes(name)) {
        if (cursor.to - cursor.from === 0) return "";

        // Collect all valid child cursors, skipping noise/comments
        const childrenCursors: TreeCursor[] = [];
        if (cursor.firstChild()) {
            do {
                if (!["LineComment", "BlockComment"].includes(cursor.name)) {
                    childrenCursors.push(cursor.node.cursor());
                }
            } while (cursor.nextSibling());
            cursor.parent();
        }

        if (childrenCursors.length === 0) return "";

        // Detect if the grammar is defined recursively (e.g. Program -> Stmnt Program)
        const isRecursive = childrenCursors.some(c => c.name === name);

        if (isRecursive) {
            // Recursive case: Standard Head/Tail split
            const head = cst2ast(childrenCursors[0], input, operators, listVars);
            const tail = childrenCursors.length > 1 
                ? cst2ast(childrenCursors[1], input, operators, listVars) 
                : "";
            const listNode: [Operator, AST, AST] = [".", head, tail];
            return listNode;
        } else {
            // Iterative case (Lezer "Statement+"): 
            // Manual "fold right" to create a linked list from the flat child array
            let listNode: AST = "";
            for (let i = childrenCursors.length - 1; i >= 0; i--) {
                const childAST = cst2ast(childrenCursors[i], input, operators, listVars);
                const newNode: [Operator, AST, AST] = [".", childAST, listNode];
                listNode = newNode;
            }
            return listNode;
        }
    }

    // Helper: Constructs a typesafe Tuple [Op, Arg1, ...] based on argument count
    const buildNode = (op: Operator, args: AST[]): AST => {
        if (args.length === 1) { const n: [Operator, AST] = [op, args[0]]; return n; }
        if (args.length === 2) { const n: [Operator, AST, AST] = [op, args[0], args[1]]; return n; }
        if (args.length === 3) { const n: [Operator, AST, AST, AST] = [op, args[0], args[1], args[2]]; return n; }
        
        // Fallback for larger argument lists
        const arg0 = args.length > 0 ? args[0] : "";
        const arg1 = args.length > 1 ? args[1] : "";
        const arg2 = args.length > 2 ? args[2] : "";
        const arg3 = args.length > 3 ? args[3] : "";
        const n: [Operator, AST, AST, AST, AST] = [op, arg0, arg1, arg2, arg3];
        return n;
    };

    // 5. Structural Nodes (Prefix Operators / Defined Operators)
    // If the node name itself is in the operator list, treat children as arguments.
    if (operators.includes(name)) {
        const nodes: AST[] = [];
        if (cursor.firstChild()) {
            do {
                if (["LineComment", "BlockComment"].includes(cursor.name)) continue;
                const res = cst2ast(cursor.node.cursor(), input, operators, listVars);
                // Filter noise like brackets or separators
                if (typeof res === "string" && NOISE.has(res)) continue;
                nodes.push(res);
            } while (cursor.nextSibling());
            cursor.parent();
        }
        return buildNode(name, nodes);
    }

    // 6. Infix Operator Promotion (Pivot)
    // Scan children for a token that exists in the 'operators' list.
    // That token becomes the root (pivot) of the current AST node.
    let pivotOp: string | null = null;
    const childrenAST: AST[] = [];
    if (cursor.firstChild()) {
        do {
            if (["LineComment", "BlockComment"].includes(cursor.name)) continue;
            
            // A pivot is an operator token that is a direct leaf child
            const isPivot = operators.includes(cursor.name) && !cursor.node.firstChild;
            if (isPivot) {
                pivotOp = cursor.name;
                continue;
            }
            childrenAST.push(cst2ast(cursor.node.cursor(), input, operators, listVars));
        } while (cursor.nextSibling());
        cursor.parent();
    }

    // Build the promoted node if a pivot was identified
    if (pivotOp !== null) {
        const filtered = childrenAST.filter(c => {
            if (typeof c === "string" && (NOISE.has(c) || c === "")) return false;
            return true;
        });
        return buildNode(pivotOp, filtered);
    }

    // 7. Smart Pass-Through & Implicit Call Detection
    
    // Check context BEFORE filtering noise: Did we see explicit parentheses?
    // This distinguishes "read" (Variable) from "read()" (Call with empty args).
    let hasParens = false;
    if (cursor.firstChild()) {
        do {
            if (cursor.name === "(") {
                hasParens = true;
                break;
            }
        } while (cursor.nextSibling());
        cursor.parent();
    }

    // Now filter the children to get the meaningful parts
    const validChildren = childrenAST.filter(c => {
        if (c === "") return false; // Keep empty lists? Usually we drop them, but see below.
        if (typeof c === "string" && NOISE.has(c)) return false;
        return true;
    });

    // Logic Switch:
    
    // Case A: It has parentheses AND starts with an Identifier -> It's a Call!
    // Covers: "read()" -> validChildren=["read"] (but hasParens=true)
    // Covers: "print(x)" -> validChildren=["print", x]
    if (hasParens && validChildren.length > 0 && typeof validChildren[0] === "string") {
        const fnName = validChildren[0];
        // If there is a second child, those are the args. If not, args are empty.
        const args = validChildren.length > 1 ? validChildren[1] : "";
        return buildNode("Call", [fnName, args]);
    }

    // Case B: Standard Pass-Through (e.g. parens around expression "( 1 + 2 )")
    // If it has parens but first child is NOT a string (or just one child that is a number), 
    // it's likely just grouping.
    if (validChildren.length === 1) {
        return validChildren[0];
    }

    // Fallback
    return validChildren.length > 0 ? validChildren[0] : "";
};