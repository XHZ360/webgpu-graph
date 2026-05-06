import type {
  BindingSchema,
  BufferBindingSchema,
  PipelineSchema,
  WebGpuSimulationSchema,
} from "schema";

const DEFAULT_MAX_STORAGE_BUFFERS_PER_SHADER_STAGE = 8;
const SHADER_STAGE = {
  VERTEX: 0x1,
  FRAGMENT: 0x2,
  COMPUTE: 0x4,
} as const;

export interface PreviewRequiredDeviceLimits {
  maxStorageBuffersPerShaderStage?: number;
}

function usesStorageBuffer(
  binding: BindingSchema,
  buffers: Record<string, BufferBindingSchema>,
): boolean {
  if (binding.resourceType !== "buffer") {
    return false;
  }

  const buffer = buffers[binding.resource];
  if (!buffer) {
    return false;
  }

  return buffer.type !== "uniform";
}

function countStageStorageBuffers(
  pipeline: PipelineSchema,
  schema: WebGpuSimulationSchema,
  stage: GPUShaderStageFlags,
): number {
  let count = 0;

  for (const bindGroupRef of pipeline.bindGroups) {
    const layout = schema.bindGroupLayouts[bindGroupRef.layout];
    if (!layout) {
      continue;
    }

    for (const binding of layout.bindings) {
      if ((binding.visibility & stage) === 0) {
        continue;
      }

      if (usesStorageBuffer(binding, schema.buffers)) {
        count += 1;
      }
    }
  }

  return count;
}

export function getRequiredDeviceLimits(
  schema: WebGpuSimulationSchema,
): PreviewRequiredDeviceLimits {
  let maxStorageBuffersPerShaderStage = 0;

  for (const pipeline of Object.values(schema.pipelines)) {
    maxStorageBuffersPerShaderStage = Math.max(
      maxStorageBuffersPerShaderStage,
      countStageStorageBuffers(pipeline, schema, SHADER_STAGE.COMPUTE),
      countStageStorageBuffers(pipeline, schema, SHADER_STAGE.VERTEX),
      countStageStorageBuffers(pipeline, schema, SHADER_STAGE.FRAGMENT),
    );
  }

  if (maxStorageBuffersPerShaderStage > DEFAULT_MAX_STORAGE_BUFFERS_PER_SHADER_STAGE) {
    return { maxStorageBuffersPerShaderStage };
  }

  return {};
}
