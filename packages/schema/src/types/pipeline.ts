import type { PipelineBindGroupRef } from "./binding.ts";
import type { WorkgroupSize } from "./shader.ts";

export interface ComputePipelineSchema {
  name: string;
  type: "compute";
  shader: string;
  bindGroups: PipelineBindGroupRef[];
  workgroupSize?: WorkgroupSize;
}
