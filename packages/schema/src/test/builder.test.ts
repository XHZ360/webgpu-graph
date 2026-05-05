import { describe, it, expect } from "vitest";
import { DefaultSchemaBuilder } from "../builder/defaultSchemaBuilder.ts";
import { createStorageBufferSchema, createUniformBufferSchema } from "../types/buffer.ts";
import { createBindingSchema, createBindGroupLayoutSchema } from "../types/binding.ts";
import { SHADER_STAGE } from "../types/basic.ts";
import type { ShaderSchema } from "../types/shader.ts";
import type { ComputePipelineSchema } from "../types/pipeline.ts";
import type { ComputePassSchema } from "../types/pass.ts";
import type { RenderGraphSchema } from "../types/renderGraph.ts";

describe("DefaultSchemaBuilder", () => {
  it("builds a minimal schema with compute pipeline", () => {
    const schema = new DefaultSchemaBuilder()
      .addBuffer(createStorageBufferSchema("positions", 1200))
      .addBuffer(createStorageBufferSchema("velocities", 1200))
      .addBuffer(createUniformBufferSchema("params", 64))
      .addBindGroupLayout(
        createBindGroupLayoutSchema("layout-main", [
          createBindingSchema(0, "positions", "buffer", SHADER_STAGE.COMPUTE),
          createBindingSchema(1, "velocities", "buffer", SHADER_STAGE.COMPUTE),
          createBindingSchema(2, "params", "buffer", SHADER_STAGE.COMPUTE),
        ]),
      )
      .addBindGroup({
        name: "bg-main",
        layout: "layout-main",
        bindings: [
          { binding: 0, resourceRef: "positions" },
          { binding: 1, resourceRef: "velocities" },
          { binding: 2, resourceRef: "params" },
        ],
      })
      .addShader({
        name: "sim-shader",
        source: "@compute fn main() {}",
        entryPoint: "main",
      } satisfies ShaderSchema)
      .addPipeline({
        name: "sim-pipeline",
        type: "compute",
        shader: "sim-shader",
        bindGroups: [{ group: 0, layout: "layout-main" }],
      } satisfies ComputePipelineSchema)
      .addPass({
        name: "sim-pass",
        type: "compute",
        pipelineRef: "sim-pipeline",
        bindGroups: [{ group: 0, bindGroupRef: "bg-main" }],
        dispatch: [64, 1, 1],
      } satisfies ComputePassSchema)
      .addRenderGraph({
        name: "main-graph",
        nodes: [{ name: "node-0", passRef: "sim-pass" }],
      } satisfies RenderGraphSchema)
      .build("MySimulation", "1.0.0");

    expect(schema.name).toBe("MySimulation");
    expect(schema.version).toBe("1.0.0");
    expect(Object.keys(schema.buffers)).toHaveLength(3);
    expect(Object.keys(schema.bindGroupLayouts)).toHaveLength(1);
    expect(Object.keys(schema.bindGroups)).toHaveLength(1);
    expect(Object.keys(schema.shaders)).toHaveLength(1);
    expect(Object.keys(schema.pipelines)).toHaveLength(1);
    expect(Object.keys(schema.passes)).toHaveLength(1);
    expect(Object.keys(schema.renderGraphs)).toHaveLength(1);
    expect(schema.mainGraphRef).toBe("main-graph");
  });

  it("auto-selects first render graph as mainGraphRef", () => {
    const schema = new DefaultSchemaBuilder()
      .addRenderGraph({
        name: "graph-a",
        nodes: [],
      })
      .addRenderGraph({
        name: "graph-b",
        nodes: [],
      })
      .build("Test", "1.0.0");

    expect(schema.mainGraphRef).toBe("graph-a");
  });

  it("allows explicit mainGraphRef", () => {
    const schema = new DefaultSchemaBuilder()
      .addRenderGraph({ name: "graph-a", nodes: [] })
      .addRenderGraph({ name: "graph-b", nodes: [] })
      .setMainGraphRef("graph-b")
      .build("Test", "1.0.0");

    expect(schema.mainGraphRef).toBe("graph-b");
  });

  it("throws on duplicate buffer name", () => {
    const builder = new DefaultSchemaBuilder().addBuffer(
      createStorageBufferSchema("positions", 1200),
    );

    expect(() => builder.addBuffer(createStorageBufferSchema("positions", 2400))).toThrow(
      "Duplicate buffer: positions",
    );
  });

  it("throws on duplicate shader name", () => {
    const builder = new DefaultSchemaBuilder().addShader({
      name: "s",
      source: "",
      entryPoint: "main",
    });

    expect(() => builder.addShader({ name: "s", source: "", entryPoint: "main" })).toThrow(
      "Duplicate shader: s",
    );
  });

  it("throws on build without render graph", () => {
    expect(() => new DefaultSchemaBuilder().build("Test", "1.0.0")).toThrow(
      "No render graph registered",
    );
  });

  it("throws on build with empty name", () => {
    const builder = new DefaultSchemaBuilder().addRenderGraph({
      name: "g",
      nodes: [],
    });

    expect(() => builder.build("", "1.0.0")).toThrow("name is required");
  });

  it("throws on build with empty version", () => {
    const builder = new DefaultSchemaBuilder().addRenderGraph({
      name: "g",
      nodes: [],
    });

    expect(() => builder.build("Test", "")).toThrow("version is required");
  });

  it("throws on invalid explicit mainGraphRef", () => {
    expect(() =>
      new DefaultSchemaBuilder()
        .addRenderGraph({ name: "g", nodes: [] })
        .setMainGraphRef("nonexistent")
        .build("Test", "1.0.0"),
    ).toThrow('mainGraphRef "nonexistent" not found');
  });

  it("chains add methods fluently", () => {
    const builder = new DefaultSchemaBuilder();
    const returned = builder
      .addBuffer(createStorageBufferSchema("b", 64))
      .addShader({ name: "s", source: "", entryPoint: "main" });

    expect(returned).toBe(builder);
  });
});
