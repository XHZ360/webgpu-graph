import type { BufferBindingSchema } from "../types/buffer.ts";
import type { BindGroupLayoutSchema, BindGroupSchema } from "../types/binding.ts";
import type { ShaderSchema } from "../types/shader.ts";
import type { ComputePipelineSchema } from "../types/pipeline.ts";
import type { ComputePassSchema } from "../types/pass.ts";
import type { RenderGraphSchema } from "../types/renderGraph.ts";
import type { WebGpuSimulationSchema } from "../types/simulation.ts";

export class DefaultSchemaBuilder {
  private buffers = new Map<string, BufferBindingSchema>();
  private bindGroupLayouts = new Map<string, BindGroupLayoutSchema>();
  private bindGroups = new Map<string, BindGroupSchema>();
  private shaders = new Map<string, ShaderSchema>();
  private pipelines = new Map<string, ComputePipelineSchema>();
  private passes = new Map<string, ComputePassSchema>();
  private renderGraphs = new Map<string, RenderGraphSchema>();
  private _mainGraphRef: string | undefined;

  addBuffer(buffer: BufferBindingSchema): this {
    if (this.buffers.has(buffer.name)) {
      throw new Error(`Duplicate buffer: ${buffer.name}`);
    }
    this.buffers.set(buffer.name, buffer);
    return this;
  }

  addBindGroupLayout(layout: BindGroupLayoutSchema): this {
    if (this.bindGroupLayouts.has(layout.name)) {
      throw new Error(`Duplicate bind group layout: ${layout.name}`);
    }
    this.bindGroupLayouts.set(layout.name, layout);
    return this;
  }

  addBindGroup(bindGroup: BindGroupSchema): this {
    if (this.bindGroups.has(bindGroup.name)) {
      throw new Error(`Duplicate bind group: ${bindGroup.name}`);
    }
    this.bindGroups.set(bindGroup.name, bindGroup);
    return this;
  }

  addShader(shader: ShaderSchema): this {
    if (this.shaders.has(shader.name)) {
      throw new Error(`Duplicate shader: ${shader.name}`);
    }
    this.shaders.set(shader.name, shader);
    return this;
  }

  addPipeline(pipeline: ComputePipelineSchema): this {
    if (this.pipelines.has(pipeline.name)) {
      throw new Error(`Duplicate pipeline: ${pipeline.name}`);
    }
    this.pipelines.set(pipeline.name, pipeline);
    return this;
  }

  addPass(pass: ComputePassSchema): this {
    if (this.passes.has(pass.name)) {
      throw new Error(`Duplicate pass: ${pass.name}`);
    }
    this.passes.set(pass.name, pass);
    return this;
  }

  addRenderGraph(renderGraph: RenderGraphSchema): this {
    if (this.renderGraphs.has(renderGraph.name)) {
      throw new Error(`Duplicate render graph: ${renderGraph.name}`);
    }
    this.renderGraphs.set(renderGraph.name, renderGraph);
    if (this._mainGraphRef === undefined) {
      this._mainGraphRef = renderGraph.name;
    }
    return this;
  }

  setMainGraphRef(name: string): this {
    this._mainGraphRef = name;
    return this;
  }

  build(name: string, version: string): WebGpuSimulationSchema {
    if (!name) {
      throw new Error("name is required");
    }
    if (!version) {
      throw new Error("version is required");
    }

    const mainGraphRef = this._mainGraphRef;
    if (!mainGraphRef) {
      throw new Error("No render graph registered: mainGraphRef is required");
    }
    if (!this.renderGraphs.has(mainGraphRef)) {
      throw new Error(`mainGraphRef "${mainGraphRef}" not found in renderGraphs`);
    }

    return {
      name,
      version,
      buffers: Object.fromEntries(this.buffers),
      bindGroupLayouts: Object.fromEntries(this.bindGroupLayouts),
      bindGroups: Object.fromEntries(this.bindGroups),
      shaders: Object.fromEntries(this.shaders),
      pipelines: Object.fromEntries(this.pipelines),
      passes: Object.fromEntries(this.passes),
      renderGraphs: Object.fromEntries(this.renderGraphs),
      mainGraphRef,
    };
  }
}
