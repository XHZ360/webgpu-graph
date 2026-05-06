export { GraphExecutor } from "./graphExecutor.ts";
export type { GraphExecutorOptions } from "./graphExecutor.ts";
export { SimulationRunner } from "./simulationRunner.ts";
export type { SimulationRunnerOptions } from "./simulationRunner.ts";
export {
  createDispatchExecutionContext,
  evaluateDispatchExpression,
} from "./dispatchExecutionContext.ts";
export type { CreateDispatchExecutionContextOptions } from "./dispatchExecutionContext.ts";
export { getRequiredDeviceLimits } from "./deviceLimits.ts";

export type PreviewFrame = {
  html: string;
};

export function createPreviewFrame(html: string): PreviewFrame {
  return { html };
}
