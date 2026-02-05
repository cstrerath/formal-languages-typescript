import { Structural, Tuple } from "recursive-set";
import { TreeCursor } from "@lezer/common";

// --- 1. Base Logic & Types ---

export type Operator = "+" | "-" | "*" | "**" | "^" | "/" | "%" | "==" | "!=" | "<" | ">" | "<=" | ">=";

/**
 * Base class for all AST nodes.
 * Uses Tuple internally to guarantee structural equality and hashability.
 */
export abstract class ASTNode<T extends Structural> implements Structural {
    constructor(protected readonly data: T) {}

    get hashCode(): number { return this.data.hashCode; }

    equals(other: unknown): boolean {
        // Type narrowing via instanceof (no 'as' needed)
        if (!(other instanceof ASTNode)) return false;
        if (this.constructor !== other.constructor) return false;
        return this.data.equals(other.data);
    }

    abstract toString(): string;
}

// --- 2. Leaf Nodes ---

export class NumNode extends ASTNode<Tuple<[number]>> {
    constructor(val: number) { super(new Tuple(val)); }
    get value(): number { return this.data.get(0); }
    toString() { return this.value.toString(); }
}

export class VarNode extends ASTNode<Tuple<[string]>> {
    constructor(name: string) { super(new Tuple(name)); }
    get name(): string { return this.data.get(0); }
    toString() { return this.name; }
}

/** Represents a missing branch, e.g., an omitted 'else' block */
export class NilNode extends ASTNode<Tuple<[]>> {
    constructor() { super(new Tuple()); }
    toString() { return "∅"; }
}

// --- 3. Composite Nodes ---

export class BinaryExpr extends ASTNode<Tuple<[AST, string, AST]>> {
    constructor(left: AST, op: string, right: AST) { 
        super(new Tuple(left, op, right)); 
    }
    get left(): AST { return this.data.get(0); }
    get op(): string { return this.data.get(1); }
    get right(): AST { return this.data.get(2); }
    toString() { return `(${this.left} ${this.op} ${this.right})`; }
}

export class AssignNode extends ASTNode<Tuple<[string, AST]>> {
    constructor(id: string, expr: AST) { super(new Tuple(id, expr)); }
    get id(): string { return this.data.get(0); }
    get expr(): AST { return this.data.get(1); }
    toString() { return `${this.id} := ${this.expr}`; }
}

export class IfNode extends ASTNode<Tuple<[AST, AST, AST]>> {
    constructor(cond: AST, thenB: AST, elseB?: AST) {
        super(new Tuple(cond, thenB, elseB ?? new NilNode())); 
    }
    get cond(): AST { return this.data.get(0); }
    get thenB(): AST { return this.data.get(1); }
    get elseB(): AST { return this.data.get(2); }
    toString() { return "if"; }
}

export class WhileNode extends ASTNode<Tuple<[AST, AST]>> {
    constructor(cond: AST, body: AST) { super(new Tuple(cond, body)); }
    get cond(): AST { return this.data.get(0); }
    get body(): AST { return this.data.get(1); }
    toString() { return "while"; }
}

export class CallNode extends ASTNode<Tuple<[string, Tuple<AST[]>]>> {
    // Nested Tuple für korrekte Structural Implementierung bei Arrays
    constructor(fn: string, args: AST[]) { super(new Tuple(fn, new Tuple(...args))); }
    get fn(): string { return this.data.get(0); }
    get args(): AST[] { return [...this.data.get(1)]; } // Spread zurück zu Array
    toString() { return `${this.fn}(...)`; }
}

export class ExprStmtNode extends ASTNode<Tuple<[AST]>> {
    constructor(expr: AST) { super(new Tuple(expr)); }
    get expr(): AST { return this.data.get(0); }
    toString() { return "stmt"; }
}

export class BlockNode extends ASTNode<Tuple<AST[]>> {
    constructor(stmts: AST[]) { super(new Tuple(...stmts)); }
    get statements(): AST[] { return [...this.data]; }
    toString() { return "{...}"; }
}

export class ListNode extends ASTNode<Tuple<AST[]>> {
    constructor(items: AST[]) { super(new Tuple(...items)); }
    get items(): AST[] { return [...this.data]; }
    toString() { return `List(${this.items.length})`; }
}

// Recursive Union Type
export type AST = 
    | NumNode | VarNode | NilNode 
    | BinaryExpr | AssignNode | IfNode | WhileNode 
    | CallNode | ExprStmtNode | BlockNode | ListNode;


// --- 3.5 Safe Access Helpers (Type Guards) ---
// Diese ersetzen "as VarNode" und "as BlockNode" im Parser

export function getVarName(node: AST): string {
    if (node instanceof VarNode) return node.name;
    throw new Error(`AST Error: Expected VarNode, got ${node.constructor.name}`);
}

export function getBlockStmts(node: AST): AST[] {
    if (node instanceof BlockNode) return node.statements;
    throw new Error(`AST Error: Expected BlockNode, got ${node.constructor.name}`);
}


// --- 4. Visualization (AST -> DOT) ---

function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Generates a GraphViz DOT string from the AST. */
export function ast2dot(root: AST): string {
    const lines: string[] = [
        'digraph AST {',
        '  node [fontname="Helvetica", fontsize=10, style="filled"];',
        '  edge [fontname="Helvetica", fontsize=9];',
        '  splines=false;',
        ''
    ];

    let idCounter = 0;

    function traverse(node: AST): number {
        const id = idCounter++;
        const myName = `n${id}`;
        
        let label = "";
        let color = "#ffffff";
        let shape = "box"; 
        let extraAttrs = ""; 
        let isBold = true; // Standard: Operationen sind fett
        
        const edges: { target: number, label?: string }[] = [];

        // --- LEAVES (Daten) -> Kreise, fixe Größe, NICHT fett ---

        if (node instanceof NumNode) {
            label = node.value.toString();
            color = "#ffffff"; 
            shape = "circle";
            extraAttrs = ', width=0.5, fixedsize=true';
            isBold = false;
        } 
        else if (node instanceof VarNode) {
            label = node.name;
            color = "#ffffff";
            shape = "circle";
            extraAttrs = ', width=0.5, fixedsize=true';
            isBold = false;
        }
        else if (node instanceof NilNode) {
            label = "∅";
            color = "#ffffff";
            shape = "circle";
            extraAttrs = ', width=0.5, fixedsize=true';
            isBold = false;
        }

        // --- INNER NODES (Operationen) -> Boxen, fett ---

        else if (node instanceof BinaryExpr) {
            label = escapeHtml(node.op);
            color = "#d1e7dd"; 
            edges.push({ target: traverse(node.left), label: "L" });
            edges.push({ target: traverse(node.right), label: "R" });
        }
        else if (node instanceof AssignNode) {
            label = ":=";
            color = "#cfe2ff"; 
            const idLeaf = idCounter++;
            lines.push(`  n${idLeaf} [label=<${node.id}>, shape=circle, fillcolor="white", width=0.5, fixedsize=true];`);
            
            edges.push({ target: idLeaf, label: "id" });
            edges.push({ target: traverse(node.expr), label: "val" });
        }
        else if (node instanceof IfNode) {
            label = "IF";
            color = "#f8d7da"; 
            edges.push({ target: traverse(node.cond), label: "cond" });
            edges.push({ target: traverse(node.thenB), label: "then" });
            if (!(node.elseB instanceof NilNode)) {
                edges.push({ target: traverse(node.elseB), label: "else" });
            }
        }
        else if (node instanceof WhileNode) {
            label = "WHILE";
            color = "#f8d7da"; 
            edges.push({ target: traverse(node.cond), label: "cond" });
            edges.push({ target: traverse(node.body), label: "do" });
        }
        else if (node instanceof CallNode) {
            label = `${node.fn}()`;
            color = "#e0cffc"; 
            node.args.forEach((arg, i) => {
                edges.push({ target: traverse(arg), label: `${i}` });
            });
        }
        else if (node instanceof ExprStmtNode) {
            label = "expr";
            color = "#fdfdfe"; 
            edges.push({ target: traverse(node.expr) });
        }
        else if (node instanceof BlockNode) {
            label = "{...}";
            color = "#f8f9fa"; 
            node.statements.forEach((stmt, i) => {
                edges.push({ target: traverse(stmt), label: `${i}` });
            });
        }

        // Finales Label bauen: Nur Boxen bekommen <b>Tags</b>
        const finalLabel = isBold ? `<b>${label}</b>` : label;
        
        lines.push(`  ${myName} [label=<${finalLabel}>, fillcolor="${color}", shape="${shape}"${extraAttrs}];`);

        for (const e of edges) {
            const attr = e.label ? ` [label="${e.label}"]` : "";
            lines.push(`  ${myName} -> n${e.target}${attr};`);
        }

        return id;
    }

    traverse(root);
    lines.push('}');
    return lines.join('\n');
}


// --- 5. CST to AST Generic Mapper ---

export type TransformRule = (children: AST[], text: string) => AST;

export interface ParserConfig {
    ignore: Set<string>;
    rules: Record<string, TransformRule>;
}

export function cstToAST(
    cursor: TreeCursor,
    source: string,
    config: ParserConfig
): AST {
    const kind = cursor.name;
    const text = source.slice(cursor.from, cursor.to);

    const children: AST[] = [];
    if (cursor.firstChild()) {
        do {
            if (!config.ignore.has(cursor.name)) {
                children.push(cstToAST(cursor, source, config));
            }
        } while (cursor.nextSibling());
        cursor.parent();
    }

    const rule = config.rules[kind];
    if (rule) return rule(children, text);

    // Auto-unwrap for non-rule intermediate nodes
    if (children.length === 1) return children[0];

    throw new Error(`Parsing failed: No rule or unwrap path for CST node '${kind}' ("${text}")`);
}
