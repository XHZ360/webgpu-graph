import type { DispatchValue, SchemaExecutionContext } from "schema";

export interface CreateDispatchExecutionContextOptions {
  params?: Record<string, number>;
  fallbackDispatch?: DispatchValue;
  reportError?: (message: string) => void;
}

type Token =
  | { type: "number"; value: number }
  | { type: "identifier"; value: string }
  | { type: "operator"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" }
  | { type: "bracket"; value: "[" | "]" }
  | { type: "comma" };

const DEFAULT_FALLBACK_DISPATCH: DispatchValue = 1;

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expr.length) {
    const char = expr[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let end = index + 1;
      while (end < expr.length && /[0-9.]/.test(expr[end])) {
        end += 1;
      }
      const value = Number(expr.slice(index, end));
      if (!Number.isFinite(value)) {
        throw new Error(`Invalid number literal near "${expr.slice(index, end)}"`);
      }
      tokens.push({ type: "number", value });
      index = end;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1;
      while (end < expr.length && /[A-Za-z0-9_]/.test(expr[end])) {
        end += 1;
      }
      tokens.push({ type: "identifier", value: expr.slice(index, end) });
      index = end;
      continue;
    }

    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }

    if (char === "[" || char === "]") {
      tokens.push({ type: "bracket", value: char });
      index += 1;
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "comma" });
      index += 1;
      continue;
    }

    throw new Error(`Unsupported token "${char}"`);
  }

  return tokens;
}

class DispatchExpressionParser {
  private readonly tokens: Token[];
  private readonly params: Record<string, number>;
  private index = 0;

  constructor(tokens: Token[], params: Record<string, number>) {
    this.tokens = tokens;
    this.params = params;
  }

  parseDispatch(): DispatchValue {
    if (this.peek()?.type === "bracket") {
      return this.parseTuple();
    }

    const value = this.parseExpression();
    this.expectEnd();
    return this.normalizeNumber(value);
  }

  private parseTuple(): [number, number, number] {
    this.expectBracket("[");
    const values: number[] = [this.normalizeNumber(this.parseExpression())];

    while (this.matchComma()) {
      values.push(this.normalizeNumber(this.parseExpression()));
    }

    this.expectBracket("]");
    this.expectEnd();

    if (values.length === 0 || values.length > 3) {
      throw new Error(`Dispatch tuple must contain 1 to 3 values, received ${values.length}`);
    }

    return [values[0] ?? 1, values[1] ?? 1, values[2] ?? 1];
  }

  private parseExpression(): number {
    let value = this.parseTerm();

    while (true) {
      const token = this.peek();
      if (token?.type !== "operator" || (token.value !== "+" && token.value !== "-")) {
        return value;
      }

      this.index += 1;
      const rhs = this.parseTerm();
      value = token.value === "+" ? value + rhs : value - rhs;
    }
  }

  private parseTerm(): number {
    let value = this.parseFactor();

    while (true) {
      const token = this.peek();
      if (token?.type !== "operator" || (token.value !== "*" && token.value !== "/")) {
        return value;
      }

      this.index += 1;
      const rhs = this.parseFactor();
      value = token.value === "*" ? value * rhs : value / rhs;
    }
  }

  private parseFactor(): number {
    const token = this.peek();
    if (!token) {
      throw new Error("Unexpected end of expression");
    }

    if (token.type === "operator" && token.value === "-") {
      this.index += 1;
      return -this.parseFactor();
    }

    if (token.type === "number") {
      this.index += 1;
      return token.value;
    }

    if (token.type === "identifier") {
      if (token.value === "ceil") {
        return this.parseCeil();
      }

      this.index += 1;
      const value = this.params[token.value];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`Unknown numeric parameter "${token.value}"`);
      }
      return value;
    }

    if (token.type === "paren" && token.value === "(") {
      this.index += 1;
      const value = this.parseExpression();
      this.expectParen(")");
      return value;
    }

    throw new Error(`Unexpected token while parsing expression`);
  }

  private parseCeil(): number {
    this.expectIdentifier("ceil");
    this.expectParen("(");
    const value = Math.ceil(this.parseExpression());
    this.expectParen(")");
    return value;
  }

  private normalizeNumber(value: number): number {
    if (!Number.isFinite(value)) {
      throw new Error("Dispatch expression produced a non-finite result");
    }

    return Math.max(0, Math.floor(value));
  }

  private expectIdentifier(value: string): void {
    const token = this.peek();
    if (token?.type !== "identifier" || token.value !== value) {
      throw new Error(`Expected identifier "${value}"`);
    }
    this.index += 1;
  }

  private expectParen(value: "(" | ")"): void {
    const token = this.peek();
    if (token?.type !== "paren" || token.value !== value) {
      throw new Error(`Expected "${value}"`);
    }
    this.index += 1;
  }

  private expectBracket(value: "[" | "]"): void {
    const token = this.peek();
    if (token?.type !== "bracket" || token.value !== value) {
      throw new Error(`Expected "${value}"`);
    }
    this.index += 1;
  }

  private matchComma(): boolean {
    if (this.peek()?.type !== "comma") {
      return false;
    }
    this.index += 1;
    return true;
  }

  private expectEnd(): void {
    if (this.peek()) {
      throw new Error("Unexpected trailing tokens in dispatch expression");
    }
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }
}

function formatDispatchValue(value: DispatchValue): string {
  return typeof value === "number" ? `${value}` : `[${value.join(", ")}]`;
}

export function evaluateDispatchExpression(
  expr: string,
  params: Record<string, number> = {},
): DispatchValue {
  const parser = new DispatchExpressionParser(tokenize(expr), params);
  return parser.parseDispatch();
}

export function createDispatchExecutionContext(
  options: CreateDispatchExecutionContextOptions = {},
): SchemaExecutionContext {
  const params = options.params ?? {};
  const fallbackDispatch = options.fallbackDispatch ?? DEFAULT_FALLBACK_DISPATCH;
  const reportError = options.reportError ?? (() => {});

  return {
    params,
    evaluateDispatch(expr: string): DispatchValue {
      try {
        return evaluateDispatchExpression(expr, params);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reportError(
          `Failed to evaluate dispatch expression "${expr}": ${message}. Falling back to ${formatDispatchValue(fallbackDispatch)}.`,
        );
        return fallbackDispatch;
      }
    },
    reportError,
  };
}
