import { describe, it, expect } from "vitest";
import type { ComputePassSchema } from "../types/pass.ts";
import type { PassSchema } from "../types/pass.ts";
import type { ComputePipelineSchema } from "../types/pipeline.ts";
import type { PipelineSchema } from "../types/pipeline.ts";
import {
  pbfSimulationSchema,
  createPbfSimulationSchema,
  PBF_GRID_HEIGHT,
  PBF_GRID_WIDTH,
  PBF_NUM_PARTICLES,
  PBF_SIM_PARAMS_FLOAT_COUNT,
  PBF_SIM_PARAMS_SIZE,
  PBF_SIMULATION_METADATA,
  PBF_WORKGROUP_SIZE,
  createPbfInitialParticleState,
  createPbfInitialPositions,
  createPbfInitialVelocities,
  packPbfSimulationParams,
} from "../examples/pbf-simulation.ts";
import { DefaultSchemaValidator } from "../validator/index.ts";

function expectComputePipeline(pipeline: PipelineSchema): ComputePipelineSchema {
  expect(pipeline.type).toBe("compute");
  if (pipeline.type !== "compute") {
    throw new Error("Expected compute pipeline");
  }
  return pipeline;
}

function expectComputePass(pass: PassSchema): ComputePassSchema {
  expect(pass.type).toBe("compute");
  if (pass.type !== "compute") {
    throw new Error("Expected compute pass");
  }
  return pass;
}

describe("PBF Simulation Schema", () => {
  const schema = pbfSimulationSchema;
  const validator = new DefaultSchemaValidator();

  it("passes validation", () => {
    const result = validator.validate(schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("has correct number of buffers", () => {
    expect(Object.keys(schema.buffers)).toHaveLength(10);
  });

  it("has correct number of bind group layouts", () => {
    expect(Object.keys(schema.bindGroupLayouts)).toHaveLength(1);
  });

  it("has correct number of bind groups", () => {
    expect(Object.keys(schema.bindGroups)).toHaveLength(1);
  });

  it("has correct number of shaders", () => {
    expect(Object.keys(schema.shaders)).toHaveLength(7);
  });

  it("has correct number of pipelines", () => {
    expect(Object.keys(schema.pipelines)).toHaveLength(7);
  });

  it("has correct number of passes", () => {
    expect(Object.keys(schema.passes)).toHaveLength(7);
  });

  it("has correct number of render graphs", () => {
    expect(Object.keys(schema.renderGraphs)).toHaveLength(1);
  });

  it("has correct main graph reference", () => {
    expect(schema.mainGraphRef).toBe("main-simulation-graph");
  });

  it("layout-shared has 10 bindings", () => {
    const layout = schema.bindGroupLayouts["layout-shared"];
    expect(layout).toBeDefined();
    expect(layout.bindings).toHaveLength(10);
  });

  it("positions buffer is not directly mappable", () => {
    expect(schema.buffers["positions"].mappable).toBeUndefined();
  });

  it("simParams buffer is uniform type", () => {
    expect(schema.buffers["simParams"].type).toBe("uniform");
  });

  it("render graph has 7 nodes", () => {
    const graph = schema.renderGraphs["main-simulation-graph"];
    expect(graph.nodes).toHaveLength(7);
  });

  it("render graph nodes have correct dependency chain", () => {
    const graph = schema.renderGraphs["main-simulation-graph"];
    const nodeMap = new Map(graph.nodes.map((n) => [n.name, n]));

    expect(nodeMap.get("node-prologue")!.dependencies).toBeUndefined();
    expect(nodeMap.get("node-clear-grid")!.dependencies).toEqual(["node-prologue"]);
    expect(nodeMap.get("node-build-grid")!.dependencies).toEqual(["node-clear-grid"]);
    expect(nodeMap.get("node-pbf-lambda")!.dependencies).toEqual(["node-build-grid"]);
    expect(nodeMap.get("node-pbf-delta")!.dependencies).toEqual(["node-pbf-lambda"]);
    expect(nodeMap.get("node-apply-delta")!.dependencies).toEqual(["node-pbf-delta"]);
    expect(nodeMap.get("node-epilogue")!.dependencies).toEqual(["node-apply-delta"]);
  });

  it("pbf-lambda pipeline uses the shared layout", () => {
    const computePipeline = expectComputePipeline(schema.pipelines["pipeline-pbf-lambda"]);
    expect(computePipeline.bindGroups).toHaveLength(1);
    expect(computePipeline.bindGroups[0]).toEqual({ group: 0, layout: "layout-shared" });
  });

  it("pbf-lambda pass uses the shared bind group", () => {
    const computePass = expectComputePass(schema.passes["pass-pbf-lambda"]);
    expect(computePass.bindGroups).toHaveLength(1);
    expect(computePass.bindGroups[0]).toEqual({ group: 0, bindGroupRef: "bg-shared" });
  });

  it("builder creates identical schema", () => {
    const builderSchema = createPbfSimulationSchema();
    expect(builderSchema).toEqual(schema);
  });

  it("exports simulation metadata consistent with schema", () => {
    expect(PBF_SIMULATION_METADATA).toEqual({
      particleCount: PBF_NUM_PARTICLES,
      gridWidth: PBF_GRID_WIDTH,
      gridHeight: PBF_GRID_HEIGHT,
      maxParticlesPerCell: 100,
      maxNeighbors: 100,
      pbfIterations: 5,
      workgroupSize: PBF_WORKGROUP_SIZE,
      simParamsFloatCount: PBF_SIM_PARAMS_FLOAT_COUNT,
      simParamsSize: PBF_SIM_PARAMS_SIZE,
    });
    expect(schema.buffers["simParams"].size).toBe(PBF_SIM_PARAMS_SIZE);
    expect(expectComputePipeline(schema.pipelines["pipeline-prologue"]).workgroupSize).toEqual([
      PBF_WORKGROUP_SIZE,
      1,
      1,
    ]);
    expect(expectComputePass(schema.passes["pass-prologue"]).dispatch).toEqual({
      expr: `ceil(${PBF_NUM_PARTICLES} / ${PBF_WORKGROUP_SIZE})`,
    });
  });

  it("creates deterministic initial particle buffers", () => {
    const positionsA = createPbfInitialPositions();
    const positionsB = createPbfInitialPositions();
    const velocities = createPbfInitialVelocities();
    const velocitiesB = createPbfInitialVelocities();
    const state = createPbfInitialParticleState();

    expect(positionsA).toEqual(positionsB);
    expect(positionsA).toHaveLength(PBF_NUM_PARTICLES * 2);
    expect(velocities).toHaveLength(PBF_NUM_PARTICLES * 2);
    expect(velocities).toEqual(velocitiesB);
    expect(state.positions).toEqual(positionsA);
    expect(state.oldPositions).toEqual(positionsA);
    expect(state.oldPositions).not.toBe(state.positions);
    expect(state.velocities).toEqual(velocities);
    expect(positionsA[0]).toBeCloseTo(13.6);
    expect(positionsA[1]).toBeCloseTo(40);
    expect(positionsA[positionsA.length - 2]).toBeCloseTo(65.52);
    expect(positionsA[positionsA.length - 1]).toBeCloseTo(23.28);
    expect(Array.from(velocities)).toSatisfy((values: number[]) =>
      values.every((value: number) => value >= -2 && value <= 2),
    );
  });

  it("packs simulation params into the exact WGSL float layout", () => {
    const packed = packPbfSimulationParams();
    const bytes = new Uint8Array(packed.buffer);

    expect(packed).toHaveLength(PBF_SIM_PARAMS_FLOAT_COUNT);
    expect(bytes.byteLength).toBe(PBF_SIM_PARAMS_SIZE);
    expect(packed[0]).toBe(PBF_NUM_PARTICLES);
    expect(packed[1]).toBe(PBF_GRID_WIDTH);
    expect(packed[2]).toBe(PBF_GRID_HEIGHT);
    expect(packed[3]).toBe(100);
    expect(packed[4]).toBe(100);
    expect(packed[5]).toBe(5);
    expect(packed[6]).toBeCloseTo(1 / 20);
    expect(packed[7]).toBeCloseTo(1.1);
    expect(packed[10]).toBeCloseTo(80);
    expect(packed[11]).toBeCloseTo(40);
    expect(packed[12]).toBeCloseTo(0.3);
    expect(packed[15]).toBeCloseTo(1.1 * 1.05);
    expect(packed[20]).toBeCloseTo(1 / 2.51);
    expect(packed[21]).toBe(0);
    expect(packed[22]).toBe(1);
    expect(packed[23]).toBeCloseTo(40);
    expect(packed[24]).toBe(0);
    expect(packed[25]).toBeCloseTo(0);
    expect(packed[26]).toBeCloseTo(20);
    expect(packed[27]).toBeCloseTo(18);
    expect(packed[28]).toBeCloseTo(20);
    expect(packed[29]).toBeCloseTo(80);
    expect(packed[30]).toBeCloseTo(80);
    expect(packed[33]).toBe(0);
    expect(packed[34]).toBeCloseTo(-9.8);
    expect(packed[35]).toBeCloseTo(0.985);
  });

  it("recomputes derived params when overrides change domain scale", () => {
    const packed = packPbfSimulationParams({
      h: 0.2,
      boundaryX: 8,
      boundaryY: 4,
    });

    expect(packed[7]).toBeCloseTo(0.2);
    expect(packed[18]).toBeCloseTo(315 / (64 * Math.PI * Math.pow(0.2, 9)));
    expect(packed[19]).toBeCloseTo(-45 / (Math.PI * Math.pow(0.2, 6)));
    expect(packed[20]).toBeCloseTo(4);
    expect(packed[23]).toBeCloseTo(4);
    expect(packed[26]).toBeCloseTo(2);
    expect(packed[27]).toBeCloseTo(1.7);
    expect(packed[28]).toBeCloseTo(3.6);
    expect(packed[29]).toBeCloseTo(6.4);
    expect(packed[30]).toBeCloseTo(6.4);
  });
});
