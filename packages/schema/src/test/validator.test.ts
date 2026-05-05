import { describe, it, expect } from "vitest";
import { DefaultSchemaValidator } from "../validator/defaultSchemaValidator.ts";
import { DefaultSchemaBuilder } from "../builder/defaultSchemaBuilder.ts";
import {
  createStorageBufferSchema,
  createUniformBufferSchema,
  createIndexBufferSchema,
} from "../types/buffer.ts";
import { createBindingSchema, createBindGroupLayoutSchema } from "../types/binding.ts";
import { SHADER_STAGE } from "../types/basic.ts";
import type { ShaderSchema } from "../types/shader.ts";
import type { ComputePipelineSchema } from "../types/pipeline.ts";
import type { ComputePassSchema } from "../types/pass.ts";
import type { RenderGraphSchema } from "../types/renderGraph.ts";
import type { WebGpuSimulationSchema } from "../types/simulation.ts";

function buildMinimalSchema(overrides?: Partial<WebGpuSimulationSchema>): WebGpuSimulationSchema {
  const base = new DefaultSchemaBuilder()
    .addBuffer(createStorageBufferSchema("positions", 1200))
    .addBuffer(createUniformBufferSchema("params", 64))
    .addBindGroupLayout(
      createBindGroupLayoutSchema("layout-main", [
        createBindingSchema(0, "positions", "buffer", SHADER_STAGE.COMPUTE),
        createBindingSchema(1, "params", "buffer", SHADER_STAGE.COMPUTE),
      ]),
    )
    .addBindGroup({
      name: "bg-main",
      layout: "layout-main",
      bindings: [
        { binding: 0, resourceRef: "positions" },
        { binding: 1, resourceRef: "params" },
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
    .build("Test", "1.0.0");

  return { ...base, ...overrides };
}

describe("DefaultSchemaValidator", () => {
  it("validates a correct schema", () => {
    const schema = buildMinimalSchema();
    const result = new DefaultSchemaValidator().validate(schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  describe("MISSING_REF", () => {
    it("detects missing pipeline shader", () => {
      const schema = buildMinimalSchema({
        pipelines: {
          "sim-pipeline": {
            name: "sim-pipeline",
            type: "compute",
            shader: "nonexistent",
            bindGroups: [{ group: 0, layout: "layout-main" }],
          },
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "MISSING_REF")).toBe(true);
    });

    it("detects missing pass pipeline", () => {
      const schema = buildMinimalSchema({
        passes: {
          "sim-pass": {
            name: "sim-pass",
            type: "compute",
            pipelineRef: "nonexistent",
            bindGroups: [{ group: 0, bindGroupRef: "bg-main" }],
            dispatch: [64, 1, 1],
          },
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "MISSING_REF")).toBe(true);
    });

    it("detects missing bindGroup in pass", () => {
      const schema = buildMinimalSchema({
        passes: {
          "sim-pass": {
            name: "sim-pass",
            type: "compute",
            pipelineRef: "sim-pipeline",
            bindGroups: [{ group: 0, bindGroupRef: "nonexistent" }],
            dispatch: [64, 1, 1],
          },
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "MISSING_REF")).toBe(true);
    });

    it("detects missing mainGraphRef", () => {
      const schema = buildMinimalSchema({
        mainGraphRef: "nonexistent",
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "MISSING_REF")).toBe(true);
    });
  });

  describe("RENDER_GRAPH_CYCLE", () => {
    it("detects a cycle in render graph", () => {
      const schema = buildMinimalSchema({
        renderGraphs: {
          "main-graph": {
            name: "main-graph",
            nodes: [
              { name: "a", passRef: "sim-pass", dependencies: ["b"] },
              { name: "b", passRef: "sim-pass", dependencies: ["a"] },
            ],
          },
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "RENDER_GRAPH_CYCLE")).toBe(true);
    });

    it("allows a valid DAG", () => {
      const schema = buildMinimalSchema({
        renderGraphs: {
          "main-graph": {
            name: "main-graph",
            nodes: [
              { name: "a", passRef: "sim-pass" },
              { name: "b", passRef: "sim-pass", dependencies: ["a"] },
              { name: "c", passRef: "sim-pass", dependencies: ["a", "b"] },
            ],
          },
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.errors.some((e) => e.rule === "RENDER_GRAPH_CYCLE")).toBe(false);
    });
  });

  describe("BUFFER_ALIGNMENT", () => {
    it("detects misaligned uniform buffer", () => {
      const schema = buildMinimalSchema({
        buffers: {
          "bad-uniform": createUniformBufferSchema("bad-uniform", 30),
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.rule === "BUFFER_ALIGNMENT" && e.path?.includes("bad-uniform")),
      ).toBe(true);
    });

    it("detects misaligned index buffer", () => {
      const schema = buildMinimalSchema({
        buffers: {
          "bad-index": createIndexBufferSchema("bad-index", 3),
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.rule === "BUFFER_ALIGNMENT" && e.path?.includes("bad-index")),
      ).toBe(true);
    });
  });

  describe("PIPELINE_GROUP_DUPLICATE", () => {
    it("detects duplicate group in pipeline", () => {
      const schema = buildMinimalSchema({
        pipelines: {
          "sim-pipeline": {
            name: "sim-pipeline",
            type: "compute",
            shader: "sim-shader",
            bindGroups: [
              { group: 0, layout: "layout-main" },
              { group: 0, layout: "layout-main" },
            ],
          },
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.rule === "PIPELINE_GROUP_DUPLICATE")).toBe(true);
    });
  });

  describe("DISPATCH_EXPR_INVALID", () => {
    it("detects expression with invalid characters", () => {
      const schema = buildMinimalSchema({
        passes: {
          "sim-pass": {
            name: "sim-pass",
            type: "compute",
            pipelineRef: "sim-pipeline",
            bindGroups: [],
            dispatch: { expr: "eval('bad')" },
          },
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.errors.some((e) => e.rule === "DISPATCH_EXPR_INVALID")).toBe(true);
    });

    it("detects unbalanced parentheses", () => {
      const schema = buildMinimalSchema({
        passes: {
          "sim-pass": {
            name: "sim-pass",
            type: "compute",
            pipelineRef: "sim-pipeline",
            bindGroups: [],
            dispatch: { expr: "ceil(n / 64" },
          },
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.errors.some((e) => e.rule === "DISPATCH_EXPR_INVALID")).toBe(true);
    });

    it("accepts valid expression", () => {
      const schema = buildMinimalSchema({
        passes: {
          "sim-pass": {
            name: "sim-pass",
            type: "compute",
            pipelineRef: "sim-pipeline",
            bindGroups: [],
            dispatch: { expr: "ceil(particleCount / 256)" },
          },
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.errors.some((e) => e.rule === "DISPATCH_EXPR_INVALID")).toBe(false);
    });
  });

  describe("BINDGROUP_LAYOUT_MISMATCH", () => {
    it("detects bindGroup with binding not in layout", () => {
      const schema = buildMinimalSchema({
        bindGroups: {
          "bg-main": {
            name: "bg-main",
            layout: "layout-main",
            bindings: [
              { binding: 0, resourceRef: "positions" },
              { binding: 1, resourceRef: "params" },
              { binding: 99, resourceRef: "positions" },
            ],
          },
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.errors.some((e) => e.rule === "BINDGROUP_LAYOUT_MISMATCH")).toBe(true);
    });
  });

  describe("PASS_PIPELINE_CONSISTENCY", () => {
    it("detects pass bindGroup group not in pipeline", () => {
      const schema = buildMinimalSchema({
        passes: {
          "sim-pass": {
            name: "sim-pass",
            type: "compute",
            pipelineRef: "sim-pipeline",
            bindGroups: [{ group: 1, bindGroupRef: "bg-main" }],
            dispatch: [64, 1, 1],
          },
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.errors.some((e) => e.rule === "PASS_PIPELINE_CONSISTENCY")).toBe(true);
    });

    it("detects pass missing bindGroup required by pipeline", () => {
      const schema = buildMinimalSchema({
        passes: {
          "sim-pass": {
            name: "sim-pass",
            type: "compute",
            pipelineRef: "sim-pipeline",
            bindGroups: [],
            dispatch: [64, 1, 1],
          },
        },
      });
      const result = new DefaultSchemaValidator().validate(schema);
      expect(result.errors.some((e) => e.rule === "PASS_PIPELINE_CONSISTENCY")).toBe(true);
    });
  });
});
