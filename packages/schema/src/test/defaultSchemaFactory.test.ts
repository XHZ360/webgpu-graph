import { describe, expect, it, vi } from "vitest";
import { DefaultSchemaFactory } from "../factory/defaultSchemaFactory.ts";
import type { WebGpuSimulationSchema } from "../types/simulation.ts";

describe("DefaultSchemaFactory", () => {
  it("uses shader entryPoint when creating pipelines", () => {
    const createComputePipeline = vi.fn(() => ({}) as GPUComputePipeline);
    const createRenderPipeline = vi.fn(() => ({}) as GPURenderPipeline);

    const device = {
      createPipelineLayout: vi.fn(() => ({}) as GPUPipelineLayout),
      createComputePipeline,
      createRenderPipeline,
    } as unknown as GPUDevice;

    const shaderModules = new Map<string, GPUShaderModule>([
      ["compute-shader", {} as GPUShaderModule],
      ["vertex-shader", {} as GPUShaderModule],
      ["fragment-shader", {} as GPUShaderModule],
    ]);

    const schema: WebGpuSimulationSchema = {
      name: "test-schema",
      version: "1.0.0",
      buffers: {},
      bindGroupLayouts: {
        shared: { name: "shared", bindings: [] },
      },
      bindGroups: {},
      shaders: {
        "compute-shader": {
          name: "compute-shader",
          source: "",
          entryPoint: "computeEntry",
        },
        "vertex-shader": {
          name: "vertex-shader",
          source: "",
          entryPoint: "vertexEntry",
        },
        "fragment-shader": {
          name: "fragment-shader",
          source: "",
          entryPoint: "fragmentEntry",
        },
      },
      pipelines: {
        compute: {
          name: "compute",
          type: "compute",
          shader: "compute-shader",
          bindGroups: [{ group: 0, layout: "shared" }],
        },
        render: {
          name: "render",
          type: "render",
          vertexShader: "vertex-shader",
          fragmentShader: "fragment-shader",
          bindGroups: [{ group: 0, layout: "shared" }],
          vertexInput: { buffers: [] },
          fragmentOutput: { targets: [] },
        },
      },
      passes: {},
      renderGraphs: {
        main: { name: "main", nodes: [] },
      },
      mainGraphRef: "main",
    };

    const factory = new DefaultSchemaFactory();
    const bindGroupLayouts = new Map<string, GPUBindGroupLayout>([
      ["shared", {} as GPUBindGroupLayout],
    ]);

    factory.createPipelines(schema, device, shaderModules, bindGroupLayouts);

    expect(createComputePipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        compute: expect.objectContaining({ entryPoint: "computeEntry" }),
      }),
    );
    expect(createRenderPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        vertex: expect.objectContaining({ entryPoint: "vertexEntry" }),
        fragment: expect.objectContaining({ entryPoint: "fragmentEntry" }),
      }),
    );
  });
});
