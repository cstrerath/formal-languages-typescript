// Define the allowed operators
export type Operator =
    | "+"
    | "-"
    | "*"
    | "/"
    | "%"
    | "=="
    | "!="
    | "<="
    | ">="
    | "<"
    | ">";

// Base Interface for all complex nodes
interface BaseNode {
    kind: string;
}

// Specific Node Types
export interface ProgramNode extends BaseNode {
    kind: "Program" | "Block";
    statements: AST[];
}

export interface AssignNode extends BaseNode {
    kind: "Assignment";
    id: string;
    expr: AST;
}

export interface ControlNode extends BaseNode {
    kind: "If" | "While";
    condition: AST;
    body: AST;
}

export interface ExprStmtNode extends BaseNode {
    kind: "ExprStmt";
    expr: AST;
}

export interface BinaryNode extends BaseNode {
    kind: "BinaryExpr";
    op: Operator;
    left: AST;
    right: AST;
}

export interface CallNode extends BaseNode {
    kind: "Call";
    funcName: string;
    args: AST[];
}

// The recursive AST Union Type
export type AST =
    | number
    | string
    | ProgramNode
    | AssignNode
    | ControlNode
    | ExprStmtNode
    | BinaryNode
    | CallNode;

import { TreeCursor } from "@lezer/common";

// --- Helper Types for the Mapper ---

// Intermediate result: Can be a single AST node OR a list of nodes
export type Mapped =
    | { kind: "one"; value: AST }
    | { kind: "many"; value: AST[] };

// Helper Constructors with explicit return types
export const one = (value: AST): Mapped => ({ kind: "one", value });
export const many = (value: AST[]): Mapped => ({ kind: "many", value });

// Runtime Assertions (to safely unwrap Mapped values)
export function asOne(x: Mapped, ctx: string): AST {
    if (x.kind !== "one") throw new Error(`[${ctx}] Expected single node.`);
    return x.value;
}

export function asMany(x: Mapped, ctx: string): AST[] {
    if (x.kind !== "many") throw new Error(`[${ctx}] Expected list.`);
    return x.value;
}

export function asString(x: Mapped, ctx: string): string {
    const val: AST = asOne(x, ctx);
    if (typeof val !== "string") throw new Error(`[${ctx}] Expected string.`);
    return val;
}

// --- The Transformation Logic ---

// A Rule transforms children and text into a Mapped result
export type NodeTransform = (ctx: {
    children: Mapped[];
    text: string;
}) => Mapped;

export interface ASTConfig {
    ignore: Set<string>;
    rules: Record<string, NodeTransform>;
    treatAsLiteral?: RegExp;
}

export function genericLezerToAST(
    cursor: TreeCursor,
    source: string,
    config: ASTConfig,
): Mapped {
    const name: string = cursor.name;
    const text: string = source.slice(cursor.from, cursor.to);

    // 1. Collect Children (Recursion)
    const children: Mapped[] = [];
    if (cursor.firstChild()) {
        do {
            const childName: string = cursor.name;
            if (!config.ignore.has(childName)) {
                children.push(genericLezerToAST(cursor, source, config));
            }
        } while (cursor.nextSibling());
        cursor.parent();
    }

    // 2. Apply Specific Rule
    const rule: NodeTransform | undefined = config.rules[name];
    if (rule) {
        return rule({ children, text });
    }

    // 3. Literal Extraction (Regex)
    if (config.treatAsLiteral && config.treatAsLiteral.test(name)) {
        return one(text);
    }

    // 4. Default Fallback (Unwrap)
    if (children.length === 1) return children[0];
    if (children.length > 1) return children[0]; // Ambiguous fallback

    return one(text); // Leaf fallback
}

// Helper to escape characters for GraphViz HTML-Labels
function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function ast2dot(tree: AST): string {
    const lines: string[] = [
        "digraph AST {",
        '  node [shape=box, fontname=Helvetica, fontsize=10, style=filled, fillcolor="#f0f0f0"];',
        "  edge [fontname=Helvetica, fontsize=9];",
    ];
    let idCounter: number = 0;

    // Helper to draw a leaf node immediately
    function drawLeaf(val: string | number, color: string = "white"): number {
        const id: number = idCounter++;
        lines.push(
            `  node${id} [label="${val}", shape=ellipse, fillcolor="${color}"];`,
        );
        return id;
    }

    // Recursive Traversal Function
    function traverse(node: AST): number {
        // 1. Primitive Leaves
        if (typeof node === "number") return drawLeaf(node);
        if (typeof node === "string") return drawLeaf(node);

        // 2. Complex Nodes
        const myId: number = idCounter++;
        const name: string = `node${myId}`;

        let label: string = "";
        let color: string = "#f0f0f0";

        // Structure to hold edges to be drawn
        const children: { edgeLabel?: string; id: number }[] = [];

        // Determine Layout based on Node Kind
        switch (node.kind) {
            case "Program":
            case "Block":
                label = ".";
                color = "#ffeeba";
                node.statements.forEach((stmt: AST, i: number) => {
                    children.push({ edgeLabel: `${i}`, id: traverse(stmt) });
                });
                break;

            case "Assignment":
                label = ":=";
                color = "#b8daff";
                children.push({ edgeLabel: "id", id: drawLeaf(node.id) });
                children.push({ edgeLabel: "expr", id: traverse(node.expr) });
                break;

            case "BinaryExpr":
                label = escapeHtml(node.op);
                color = "#b8daff";
                children.push({ edgeLabel: "left", id: traverse(node.left) });
                children.push({ edgeLabel: "right", id: traverse(node.right) });
                break;

            case "If":
                label = "if";
                color = "#d4edda";
                children.push({
                    edgeLabel: "cond",
                    id: traverse(node.condition),
                });
                children.push({ edgeLabel: "body", id: traverse(node.body) });
                break;

            case "While":
                label = "while";
                color = "#d4edda";
                children.push({
                    edgeLabel: "cond",
                    id: traverse(node.condition),
                });
                children.push({ edgeLabel: "body", id: traverse(node.body) });
                break;

            case "Call":
                label = "call";
                color = "#f5c6cb";
                children.push({ edgeLabel: "fn", id: drawLeaf(node.funcName) });
                node.args.forEach((arg: AST, i: number) => {
                    children.push({ edgeLabel: `arg${i}`, id: traverse(arg) });
                });
                break;

            case "ExprStmt":
                label = "expr";
                children.push({ edgeLabel: "", id: traverse(node.expr) });
                break;

            default:
                // Fallback for unexpected nodes
                label = (node as any).kind;
        }

        // Draw the Node Definition
        lines.push(
            `  ${name} [label=<<b>${label}</b>>, fillcolor="${color}"];`,
        );

        // Draw the Edges
        children.forEach((child) => {
            const edgeAttr: string = child.edgeLabel
                ? ` [label="${child.edgeLabel}"]`
                : "";
            lines.push(`  ${name} -> node${child.id}${edgeAttr};`);
        });

        return myId;
    }

    // Start Traversal
    traverse(tree);
    lines.push("}");
    return lines.join("\n");
}
