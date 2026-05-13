import { describe, expect, it } from "vitest";
import { getNodeDetail, inspectSchema } from "editor";
import { createPbfSimulationSchema } from "schema/examples/pbf-simulation";

describe("schema inspection", () => {
  const schema = createPbfSimulationSchema();

  it("summarizes the PBF schema", () => {
    const inspection = inspectSchema(schema);

    expect(inspection.summary).toMatchObject({
      name: "PBF-WebGPU-Simulation",
      version: "1.0.0",
      bufferCount: 10,
      bindGroupLayoutCount: 1,
      bindGroupCount: 1,
      shaderCount: 7,
      pipelineCount: 7,
      passCount: 7,
      renderGraphCount: 2,
      mainGraphRef: "main-simulation-graph",
    });
    expect(inspection.summary.pipelineTypes).toEqual({ compute: 7, render: 0 });
    expect(inspection.summary.passTypes).toEqual({ compute: 7, render: 0 });
  });

  it("maps PBF schema objects into stable graph nodes and edges", () => {
    const { graph } = inspectSchema(schema);

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "buffer:positions", type: "buffer", label: "positions" }),
        expect.objectContaining({ id: "layout:layout-shared", type: "layout" }),
        expect.objectContaining({ id: "bindGroup:bg-shared", type: "bindGroup" }),
        expect.objectContaining({ id: "shader:shader-prologue", type: "shader" }),
        expect.objectContaining({ id: "pipeline:pipeline-prologue", type: "pipeline" }),
        expect.objectContaining({ id: "pass:pass-prologue", type: "pass" }),
        expect.objectContaining({ id: "renderGraph:main-simulation-graph", type: "renderGraph" }),
        expect.objectContaining({ id: "renderGraph:pbf-iteration-graph", type: "renderGraph" }),
      ]),
    );

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { from: "layout:layout-shared", to: "bindGroup:bg-shared", label: "uses layout" },
        { from: "buffer:positions", to: "bindGroup:bg-shared", label: "binding 0" },
        { from: "pipeline:pipeline-prologue", to: "shader:shader-prologue", label: "shader" },
        { from: "pass:pass-prologue", to: "pipeline:pipeline-prologue", label: "uses pipeline" },
        { from: "renderGraph:main-simulation-graph", to: "pass:pass-prologue", label: "contains" },
        {
          from: "renderGraph:main-simulation-graph",
          to: "renderGraph:pbf-iteration-graph",
          label: "subgraph node-pbf-iterations",
        },
        {
          from: "pass:pass-prologue",
          to: "renderGraph:pbf-iteration-graph",
          label: "depends node-prologue",
        },
      ]),
    );
  });

  it("returns typed node details for inspector selections", () => {
    expect(getNodeDetail(schema, "buffer:positions")).toMatchObject({
      id: "buffer:positions",
      type: "buffer",
      properties: { size: 9600, bufferType: "storage", mappable: false },
    });
    expect(getNodeDetail(schema, "layout:layout-shared")).toMatchObject({
      type: "layout",
      properties: { bindings: expect.arrayContaining([expect.objectContaining({ binding: 0 })]) },
    });
    expect(getNodeDetail(schema, "bindGroup:bg-shared")).toMatchObject({
      type: "bindGroup",
      properties: { layout: "layout-shared" },
    });
    expect(getNodeDetail(schema, "shader:shader-prologue")).toMatchObject({
      type: "shader",
      properties: { entryPoint: "main" },
    });
    expect(getNodeDetail(schema, "pipeline:pipeline-prologue")).toMatchObject({
      type: "pipeline",
      properties: { shader: "shader-prologue" },
    });
    expect(getNodeDetail(schema, "pass:pass-prologue")).toMatchObject({
      type: "pass",
      properties: { pipelineRef: "pipeline-prologue" },
    });
    expect(getNodeDetail(schema, "renderGraph:main-simulation-graph")).toMatchObject({
      type: "renderGraph",
      properties: {
        nodes: expect.arrayContaining([
          expect.objectContaining({ name: "node-prologue", kind: "pass" }),
          expect.objectContaining({
            name: "node-pbf-iterations",
            kind: "subgraph",
            graphRef: "pbf-iteration-graph",
          }),
        ]),
      },
    });
    expect(getNodeDetail(schema, "unknown:node")).toBeNull();
  });
});
