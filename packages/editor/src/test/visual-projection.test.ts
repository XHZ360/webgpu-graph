import { describe, expect, it } from "vitest";
import { createVisualProjection } from "editor";
import { createPbfSimulationSchema } from "schema/examples/pbf-simulation";

describe("visual projection", () => {
  it("projects representative PBF nodes with stable source references and metadata", () => {
    const projection = createVisualProjection(createPbfSimulationSchema());

    expect(projection).toMatchObject({
      sourceOfTruth: "schema",
      derivedFrom: "inspectSchema",
      severity: "none",
      capabilities: {
        selectable: true,
        inspectable: true,
        editable: false,
        connectable: false,
        draggable: false,
        persistableLayout: false,
      },
      editability: { readonly: true },
    });
    expect(projection.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "group:resources", kind: "resources" }),
        expect.objectContaining({ id: "group:graphs", kind: "graphs" }),
      ]),
    );
    expect(projection.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "buffer:positions",
          kind: "buffer",
          groupId: "group:resources",
          sourceRef: {
            id: "buffer:positions",
            entityType: "buffer",
            schemaPath: "buffers.positions",
          },
          metadata: expect.objectContaining({
            kind: "buffer",
            properties: expect.objectContaining({ size: 9600, bufferType: "storage" }),
          }),
        }),
        expect.objectContaining({
          id: "renderGraph:main-simulation-graph",
          kind: "renderGraph",
          groupId: "group:graphs",
          sourceRef: {
            id: "renderGraph:main-simulation-graph",
            entityType: "renderGraph",
            schemaPath: "renderGraphs.main-simulation-graph",
          },
          badges: expect.arrayContaining([expect.objectContaining({ label: "main" })]),
        }),
      ]),
    );
  });

  it("projects semantic edges with stable ids and renderer-neutral meanings", () => {
    const projection = createVisualProjection(createPbfSimulationSchema());

    expect(projection.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge:layout:layout-shared->bindGroup:bg-shared:uses-layout:uses-layout",
          from: "layout:layout-shared",
          to: "bindGroup:bg-shared",
          label: "uses layout",
          meaning: "uses-layout",
          sourceRef: expect.objectContaining({ entityType: "edge" }),
        }),
        expect.objectContaining({
          id: "edge:buffer:positions->bindGroup:bg-shared:binds-resource:binding-0",
          meaning: "binds-resource",
        }),
        expect.objectContaining({
          id: "edge:pipeline:pipeline-prologue->shader:shader-prologue:uses-shader:shader",
          meaning: "uses-shader",
        }),
        expect.objectContaining({
          id: "edge:renderGraph:main-simulation-graph->renderGraph:pbf-iteration-graph:contains-subgraph:subgraph-node-pbf-iterations",
          meaning: "contains-subgraph",
        }),
        expect.objectContaining({
          id: "edge:pass:pass-prologue->renderGraph:pbf-iteration-graph:depends-on:depends-node-prologue",
          meaning: "depends-on",
        }),
      ]),
    );
  });

  it("surfaces validation diagnostics as canvas-level severity", () => {
    const schema = createPbfSimulationSchema();
    schema.passes["pass-prologue"].pipelineRef = "missing-pipeline";

    const projection = createVisualProjection(schema);

    expect(projection.severity).toBe("error");
    expect(projection.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          rule: "MISSING_REF",
          sourceRef: expect.objectContaining({ entityType: "schema" }),
        }),
      ]),
    );
    expect(projection.nodes.find((node) => node.id === "pass:pass-prologue")?.severity).toBe(
      "error",
    );
  });

  it("keeps schema data as source of truth and avoids renderer state", () => {
    const schema = createPbfSimulationSchema();
    const projection = createVisualProjection(schema);

    projection.nodes.find((node) => node.id === "buffer:positions")!.metadata.properties.size = 1;

    expect(schema.buffers.positions.size).toBe(9600);
    expect(Object.keys(projection.nodes[0]!)).not.toEqual(
      expect.arrayContaining(["position", "data", "sourcePosition", "targetPosition"]),
    );
    expect(JSON.stringify(projection)).not.toMatch(/reactflow|xyflow/i);
  });
});
