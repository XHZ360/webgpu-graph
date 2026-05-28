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

export const requestDevice = async (requiredLimits?: GPUSupportedLimits): Promise<GPUDevice> => {
  if (!("gpu" in navigator)) {
    throw new Error("WebGPU is not supported in this browser.");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("No suitable GPU adapter found.");
  }

  if (requiredLimits) {
    if (
      requiredLimits.maxStorageBuffersPerShaderStage !== undefined &&
      adapter.limits.maxStorageBuffersPerShaderStage <
        requiredLimits.maxStorageBuffersPerShaderStage
    ) {
      throw new Error("This adapter does not satisfy the schema-required WebGPU limits.");
    }

    if (requiredLimits.maxStorageBuffersPerShaderStage !== undefined) {
      return adapter.requestDevice({
        requiredLimits: {
          maxStorageBuffersPerShaderStage: requiredLimits.maxStorageBuffersPerShaderStage,
        },
      });
    }
  }

  return adapter.requestDevice();
};
