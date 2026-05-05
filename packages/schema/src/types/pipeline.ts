import type { PipelineBindGroupRef } from "./binding.ts";
import type { WorkgroupSize } from "./shader.ts";

export interface ComputePipelineSchema {
  name: string;
  type: "compute";
  shader: string;
  bindGroups: PipelineBindGroupRef[];
  workgroupSize?: WorkgroupSize;
}

export interface RenderPipelineSchema {
  name: string;
  type: "render";
  vertexShader: string;
  fragmentShader?: string;
  bindGroups: PipelineBindGroupRef[];
  vertexInput: {
    buffers: GPUVertexBufferLayout[];
  };
  fragmentOutput?: {
    targets: GPUColorTargetState[];
  };
  depthStencil?: GPUDepthStencilState;
  primitive?: GPUPrimitiveState;
  multisample?: GPUMultisampleState;
}

export type PipelineSchema = ComputePipelineSchema | RenderPipelineSchema;
