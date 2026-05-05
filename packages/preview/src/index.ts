export { GraphExecutor } from "./graphExecutor.ts";
export type { GraphExecutorOptions } from "./graphExecutor.ts";
export { SimulationRunner } from "./simulationRunner.ts";
export type { SimulationRunnerOptions } from "./simulationRunner.ts";

export type PreviewFrame = {
  html: string;
};

export function createPreviewFrame(html: string): PreviewFrame {
  return { html };
}
