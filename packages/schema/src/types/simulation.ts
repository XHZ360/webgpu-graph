import type { BufferBindingSchema } from "./buffer.ts";
import type { BindGroupLayoutSchema, BindGroupSchema } from "./binding.ts";
import type { ShaderSchema } from "./shader.ts";
import type { PipelineSchema } from "./pipeline.ts";
import type { PassSchema } from "./pass.ts";
import type { RenderGraphSchema } from "./renderGraph.ts";

export type BuffersSchemaMap = Record<string, BufferBindingSchema>;
export type BindGroupLayoutsSchemaMap = Record<string, BindGroupLayoutSchema>;
export type BindGroupsSchemaMap = Record<string, BindGroupSchema>;
export type ShadersSchemaMap = Record<string, ShaderSchema>;
export type PipelinesSchemaMap = Record<string, PipelineSchema>;
export type PassesSchemaMap = Record<string, PassSchema>;
export type RenderGraphsSchemaMap = Record<string, RenderGraphSchema>;

export interface WebGpuSimulationSchema {
  name: string;
  version: string;
  buffers: BuffersSchemaMap;
  bindGroupLayouts: BindGroupLayoutsSchemaMap;
  bindGroups: BindGroupsSchemaMap;
  shaders: ShadersSchemaMap;
  pipelines: PipelinesSchemaMap;
  passes: PassesSchemaMap;
  renderGraphs: RenderGraphsSchemaMap;
  mainGraphRef: string;
}
