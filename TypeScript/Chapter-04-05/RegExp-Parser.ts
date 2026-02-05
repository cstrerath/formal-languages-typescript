import {
    RegExp,
    EmptySet,
    Epsilon,
    CharNode,
    Star,
    Concat,
    Union
} from "./03-RegExp-2-NFA";

type ParseTree = RegExp;
type ParseResult = [ParseTree, string[]];

function error(msg: string, tokens: string[]): never {
    throw new Error(
        `Parse Error: ${msg}. Remaining tokens: ${JSON.stringify(tokens)}`,
    );
}

let parseRegExp: (tokens: string[]) => ParseResult;
let parseProduct: (tokens: string[]) => ParseResult;
let parseFactor: (tokens: string[]) => ParseResult;
let parseAtom: (tokens: string[]) => ParseResult;

parseRegExp = () => { throw "Not implemented"; };
parseProduct = () => { throw "Not implemented"; };
parseFactor = () => { throw "Not implemented"; };
parseAtom = () => { throw "Not implemented"; };

function tokenize(s: string): string[] {
    const tokenRegex = /[+*()]|[a-zA-Z]|∅|ε/g;
    const matches = s.match(tokenRegex);

    return matches ? matches : [];
}

parseRegExp = function (tokens: string[]): ParseResult {
    let [result, rest] = parseProduct(tokens);

    while (rest.length > 0 && rest[0] === "+") {
        const nextTokens = rest.slice(1);
        const [right, rightRest] = parseProduct(nextTokens);

        result = new Union(result, right);
        rest = rightRest;
    }

    return [result, rest];
};

parseProduct = function (tokens: string[]): ParseResult {
    let [result, rest] = parseFactor(tokens);

    const isAtomStart = (t: string) => /^[a-zA-Z(∅ε]$/.test(t);

    while (rest.length > 0 && isAtomStart(rest[0])) {
        const [right, rightRest] = parseFactor(rest);

        result = new Concat(result, right);
        rest = rightRest;
    }

    return [result, rest];
};

parseFactor = function (tokens: string[]): ParseResult {
    let [atom, rest] = parseAtom(tokens);

    if (rest.length > 0 && rest[0] === "*") {
        atom = new Star(atom);
        rest = rest.slice(1);
    }

    return [atom, rest];
};

parseAtom = function (tokens: string[]): ParseResult {
    if (tokens.length === 0) {
        error("Unexpected end of input", tokens);
    }

    const t = tokens[0];
    const rest = tokens.slice(1);

    if (t === "(") {
        const [expr, afterExpr] = parseRegExp(rest);

        if (afterExpr.length === 0 || afterExpr[0] !== ")") {
            error("Expected ')'", afterExpr);
        }
        return [expr, afterExpr.slice(1)];
    }

    if (t === "∅") return [new EmptySet(), rest];

    if (t === "ε") return [new Epsilon(), rest];

    if (/^[a-zA-Z]$/.test(t)) return [new CharNode(t), rest];

    error(`Unexpected token '${t}'`, tokens);
    return [new EmptySet(), []];
};

function parse(s: string): ParseTree {
    const tokens = tokenize(s);
    const [result, rest] = parseRegExp(tokens);

    if (rest.length > 0) {
        error("Unexpected trailing tokens", rest);
    }

    return result;
}

export {parse}