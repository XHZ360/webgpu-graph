import { describe, it, expect } from "vitest";
import { pbfSimulationSchema, createPbfSimulationSchema } from "../examples/pbf-simulation.ts";
import { DefaultSchemaValidator } from "../validator/index.ts";

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
    expect(Object.keys(schema.bindGroupLayouts)).toHaveLength(2);
  });

  it("has correct number of bind groups", () => {
    expect(Object.keys(schema.bindGroups)).toHaveLength(2);
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

  it("layout-shared has 9 bindings", () => {
    const layout = schema.bindGroupLayouts["layout-shared"];
    expect(layout).toBeDefined();
    expect(layout.bindings).toHaveLength(9);
  });

  it("layout-pbf has 1 binding", () => {
    const layout = schema.bindGroupLayouts["layout-pbf"];
    expect(layout).toBeDefined();
    expect(layout.bindings).toHaveLength(1);
  });

  it("bositions buffer is mappable", () => {
    expect(schema.buffers["positions"].mappable).toBe(true);
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

    expect(nodeMap.get("node-clear-grid")!.dependencies).toBeUndefined();
    expect(nodeMap.get("node-prologue")!.dependencies).toEqual(["node-clear-grid"]);
    expect(nodeMap.get("node-build-grid")!.dependencies).toEqual(["node-prologue"]);
    expect(nodeMap.get("node-pbf-lambda")!.dependencies).toEqual(["node-build-grid"]);
    expect(nodeMap.get("node-pbf-delta")!.dependencies).toEqual(["node-pbf-lambda"]);
    expect(nodeMap.get("node-apply-delta")!.dependencies).toEqual(["node-pbf-delta"]);
    expect(nodeMap.get("node-epilogue")!.dependencies).toEqual(["node-apply-delta"]);
  });

  it("pbf-lambda pipeline uses both layouts", () => {
    const pipeline = schema.pipelines["pipeline-pbf-lambda"];
    expect(pipeline.type).toBe("compute");
    expect(pipeline.bindGroups).toHaveLength(2);
    expect(pipeline.bindGroups[0]).toEqual({ group: 0, layout: "layout-shared" });
    expect(pipeline.bindGroups[1]).toEqual({ group: 1, layout: "layout-pbf" });
  });

  it("pbf-lambda pass uses both bind groups", () => {
    const pass = schema.passes["pass-pbf-lambda"];
    expect(pass.type).toBe("compute");
    expect(pass.bindGroups).toHaveLength(2);
    expect(pass.bindGroups[0]).toEqual({ group: 0, bindGroupRef: "bg-shared" });
    expect(pass.bindGroups[1]).toEqual({ group: 1, bindGroupRef: "bg-pbf" });
  });

  it("builder creates identical schema", () => {
    const builderSchema = createPbfSimulationSchema();
    expect(builderSchema).toEqual(schema);
  });
});
