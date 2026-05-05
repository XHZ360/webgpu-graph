import type { WebGpuSimulationSchema } from "../../types/simulation.ts";
import type { ValidationError } from "../types.ts";

const ALLOWED_CHARS = /^[a-zA-Z0-9\s+\-*/().,%[\]_]+$/;

function checkBalancedParens(expr: string): boolean {
  let depth = 0;
  for (const ch of expr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function checkBalancedBrackets(expr: string): boolean {
  let depth = 0;
  for (const ch of expr) {
    if (ch === "[") depth++;
    if (ch === "]") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

export function checkDispatchExpressionValidity(schema: WebGpuSimulationSchema): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [passName, pass] of Object.entries(schema.passes)) {
    if (pass.type !== "compute") continue;
    if (typeof pass.dispatch === "number") continue;
    if (Array.isArray(pass.dispatch)) continue;

    const expr = pass.dispatch.expr;

    if (!expr || expr.trim().length === 0) {
      errors.push({
        rule: "DISPATCH_EXPR_INVALID",
        message: `Pass "${passName}" dispatch expression is empty`,
        path: `passes.${passName}.dispatch`,
      });
      continue;
    }

    if (!ALLOWED_CHARS.test(expr)) {
      errors.push({
        rule: "DISPATCH_EXPR_INVALID",
        message: `Pass "${passName}" dispatch expression contains invalid characters: "${expr}"`,
        path: `passes.${passName}.dispatch`,
      });
    }

    if (!checkBalancedParens(expr)) {
      errors.push({
        rule: "DISPATCH_EXPR_INVALID",
        message: `Pass "${passName}" dispatch expression has unbalanced parentheses: "${expr}"`,
        path: `passes.${passName}.dispatch`,
      });
    }

    if (!checkBalancedBrackets(expr)) {
      errors.push({
        rule: "DISPATCH_EXPR_INVALID",
        message: `Pass "${passName}" dispatch expression has unbalanced brackets: "${expr}"`,
        path: `passes.${passName}.dispatch`,
      });
    }
  }

  return errors;
}
