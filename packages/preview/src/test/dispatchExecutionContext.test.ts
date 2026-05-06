import { describe, expect, it, vi } from "vitest";
import {
  createDispatchExecutionContext,
  evaluateDispatchExpression,
} from "../dispatchExecutionContext.ts";

describe("dispatch execution context", () => {
  it("evaluates numeric expressions", () => {
    expect(evaluateDispatchExpression("4 + 2 * 3")).toBe(10);
    expect(evaluateDispatchExpression("particleCount / 8", { particleCount: 64 })).toBe(8);
  });

  it("supports ceil and tuple dispatch syntax", () => {
    expect(
      evaluateDispatchExpression("ceil(particleCount / 128)", {
        particleCount: 257,
      }),
    ).toBe(3);
    expect(evaluateDispatchExpression("[ceil(n / 128), 1, 1]", { n: 129 })).toEqual([2, 1, 1]);
    expect(evaluateDispatchExpression("[8] ")).toEqual([8, 1, 1]);
  });

  it("reports failures and returns the fallback dispatch", () => {
    const reportError = vi.fn();
    const context = createDispatchExecutionContext({
      params: { particleCount: 64 },
      fallbackDispatch: [1, 1, 1],
      reportError,
    });

    expect(context.evaluateDispatch("ceil(missing / 64)")).toEqual([1, 1, 1]);
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0]?.[0]).toContain(
      'Failed to evaluate dispatch expression "ceil(missing / 64)"',
    );
  });
});
